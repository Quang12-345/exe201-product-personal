"""Lưu/đọc feedback của người dùng cho câu trả lời AI (Product AI feedback loop)."""
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from src.db.models import AgentRun, Message, MessageFeedback, MessageSignal


async def upsert_feedback(
    session: AsyncSession,
    *,
    message_id: str,
    user_id: str | None,
    rating: str,
    reason: str = "",
) -> MessageFeedback:
    """Tạo mới hoặc cập nhật feedback của 1 user cho 1 message (1 đánh giá/người/message)."""
    result = await session.execute(
        select(MessageFeedback).where(
            MessageFeedback.message_id == message_id,
            MessageFeedback.user_id == user_id,
        )
    )
    fb = result.scalar_one_or_none()
    if fb is None:
        fb = MessageFeedback(
            message_id=message_id, user_id=user_id, rating=rating, reason=reason
        )
        session.add(fb)
    else:
        fb.rating = rating
        fb.reason = reason
    await session.commit()
    await session.refresh(fb)
    return fb


async def delete_feedback(
    session: AsyncSession,
    *,
    message_id: str,
    user_id: str | None,
) -> bool:
    """Xóa feedback của 1 user cho 1 message. Trả True nếu có dòng bị xóa."""
    result = await session.execute(
        delete(MessageFeedback).where(
            MessageFeedback.message_id == message_id,
            MessageFeedback.user_id == user_id,
        )
    )
    await session.commit()
    return bool(result.rowcount)


async def message_exists(session: AsyncSession, message_id: str) -> bool:
    result = await session.execute(select(Message.id).where(Message.id == message_id))
    return result.scalar_one_or_none() is not None


async def ratings_by_user(
    session: AsyncSession, *, message_ids: list[str], user_id: str | None
) -> dict[str, str]:
    """Đánh giá 👍/👎 CỦA 1 user cho danh sách message → {message_id: 'up'|'down'}.

    Dùng khi tải lại hội thoại để khôi phục trạng thái like/dislike đã bấm."""
    if not message_ids or user_id is None:
        return {}
    result = await session.execute(
        select(MessageFeedback.message_id, MessageFeedback.rating).where(
            MessageFeedback.message_id.in_(message_ids),
            MessageFeedback.user_id == user_id,
        )
    )
    return {message_id: rating for message_id, rating in result.all()}


async def summary(
    session: AsyncSession, *, recent_limit: int = 10, bad_questions_limit: int = 50
) -> dict:
    """Tổng hợp feedback toàn hệ thống cho dashboard admin."""
    counts = await session.execute(
        select(MessageFeedback.rating, func.count()).group_by(MessageFeedback.rating)
    )
    up = down = 0
    for rating, n in counts.all():
        if rating == "up":
            up = n
        elif rating == "down":
            down = n
    total = up + down

    recent_rows = await session.execute(
        select(MessageFeedback)
        .where(MessageFeedback.reason != "")
        .order_by(MessageFeedback.updated_at.desc())
        .limit(recent_limit)
    )
    recent = [
        {
            "rating": fb.rating,
            "reason": fb.reason,
            "created_at": fb.updated_at.isoformat() if fb.updated_at else None,
        }
        for fb in recent_rows.scalars().all()
    ]

    assistant_message = aliased(Message)
    user_message = aliased(Message)
    down_rows = await session.execute(
        select(MessageFeedback, assistant_message, user_message)
        .join(assistant_message, MessageFeedback.message_id == assistant_message.id)
        .outerjoin(AgentRun, AgentRun.assistant_message_id == assistant_message.id)
        .outerjoin(user_message, AgentRun.user_message_id == user_message.id)
        .where(MessageFeedback.rating == "down")
        .order_by(MessageFeedback.updated_at.desc())
        .limit(bad_questions_limit)
    )
    bad_questions = []
    for fb, assistant_msg, question_msg in down_rows.all():
        bad_questions.append(
            {
                "message_id": fb.message_id,
                "conversation_id": assistant_msg.conversation_id,
                "question": question_msg.content if question_msg else "",
                "answer": assistant_msg.content,
                "reason": fb.reason,
                "created_at": fb.updated_at.isoformat() if fb.updated_at else None,
            }
        )

    return {
        "total": total,
        "up": up,
        "down": down,
        "helpful_rate": round(up / total, 3) if total else 0.0,
        "recent": recent,
        "bad_questions": bad_questions,
    }


# ---- Tín hiệu implicit + system ----
async def record_signal(
    session: AsyncSession,
    *,
    message_id: str,
    user_id: str | None,
    kind: str,
    name: str,
    value: float | None = None,
) -> None:
    """Ghi 1 tín hiệu; dedupe theo (message, name, user) để đếm theo câu trả lời."""
    result = await session.execute(
        select(MessageSignal).where(
            MessageSignal.message_id == message_id,
            MessageSignal.name == name,
            MessageSignal.user_id == user_id,
        )
    )
    sig = result.scalar_one_or_none()
    if sig is None:
        session.add(
            MessageSignal(message_id=message_id, user_id=user_id, kind=kind, name=name, value=value)
        )
    else:
        sig.value = value
    await session.commit()


async def signals_summary(session: AsyncSession) -> dict:
    async def _distinct(name: str) -> int:
        r = await session.execute(
            select(func.count(func.distinct(MessageSignal.message_id))).where(
                MessageSignal.name == name
            )
        )
        return int(r.scalar() or 0)

    async def _avg(name: str) -> float:
        r = await session.execute(
            select(func.avg(MessageSignal.value)).where(MessageSignal.name == name)
        )
        return round(float(r.scalar() or 0.0), 3)

    sys_count = await session.execute(
        select(func.count(func.distinct(MessageSignal.message_id))).where(
            MessageSignal.kind == "system"
        )
    )
    return {
        "answers_with_system": int(sys_count.scalar() or 0),
        "grounded_rate": await _avg("grounded"),
        "avg_confidence": await _avg("confidence"),
        "opened_source": await _distinct("opened_source"),
        "copied": await _distinct("copied"),
        "saved": await _distinct("saved"),
    }
