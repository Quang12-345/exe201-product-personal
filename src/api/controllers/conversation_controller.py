"""Lịch sử hội thoại Chat AI — list / messages / rename / delete.

Mỗi người dùng chỉ thấy & thao tác hội thoại của chính mình; admin xem tất cả.
"""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.models.chat import Source
from src.models.conversation import (
    ConversationSummary,
    DeleteConversationResponse,
    MessageItem,
)
from src.repositories import conversation_repo


def _role_name(user: User) -> str | None:
    return user.role.name if getattr(user, "role", None) else None


def _preview(text: str, limit: int = 70) -> str:
    text = (text or "").strip().replace("\n", " ")
    return text[:limit] + "…" if len(text) > limit else text


async def list_conversations_controller(
    session: AsyncSession, user: User
) -> list[ConversationSummary]:
    conversations = await conversation_repo.list_conversations_by_user(session, user.id)
    summaries: list[ConversationSummary] = []
    for conv in conversations:
        last = await conversation_repo.last_message(session, conv.id)
        count = await conversation_repo.count_messages(session, conv.id)
        summaries.append(
            ConversationSummary(
                id=conv.id,
                title=conv.title,
                preview=_preview(last.content) if last else "",
                message_count=count,
                updated_at=conv.updated_at,
            )
        )
    return summaries


async def _require_conversation(session: AsyncSession, user: User, conversation_id: str):
    conversation = await conversation_repo.get_conversation(session, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy hội thoại.")
    if _role_name(user) != "admin" and conversation.user_id != user.id:
        raise HTTPException(status_code=403, detail="Không có quyền với hội thoại này.")
    return conversation


async def get_messages_controller(
    session: AsyncSession, user: User, conversation_id: str
) -> list[MessageItem]:
    await _require_conversation(session, user, conversation_id)
    messages = await conversation_repo.list_messages(session, conversation_id)
    # Khôi phục trạng thái 👍/👎 user này đã bấm (giữ qua reload trang).
    # Soft-fail: lỗi đọc feedback không được làm hỏng việc đọc hội thoại.
    from src.repositories import feedback_repo

    assistant_ids = [m.id for m in messages if m.role == "assistant"]
    try:
        my_ratings = await feedback_repo.ratings_by_user(
            session, message_ids=assistant_ids, user_id=user.id
        )
    except Exception:  # noqa: BLE001
        my_ratings = {}
    items: list[MessageItem] = []
    for m in messages:
        meta = m.metadata_json or {}
        raw_sources = meta.get("sources", []) if m.role == "assistant" else []
        sources = [Source(**s) for s in raw_sources if isinstance(s, dict)]
        confidence = meta.get("confidence") if m.role == "assistant" else None
        items.append(
            MessageItem(
                id=m.id,
                role=m.role,
                content=m.content,
                sources=sources,
                confidence=confidence if isinstance(confidence, dict) else None,
                my_rating=my_ratings.get(m.id),
                created_at=m.created_at,
            )
        )
    return items


async def rename_conversation_controller(
    session: AsyncSession, user: User, conversation_id: str, title: str
) -> ConversationSummary:
    conversation = await _require_conversation(session, user, conversation_id)
    await conversation_repo.rename_conversation(session, conversation, title.strip())
    await session.commit()
    count = await conversation_repo.count_messages(session, conversation.id)
    last = await conversation_repo.last_message(session, conversation.id)
    return ConversationSummary(
        id=conversation.id,
        title=conversation.title,
        preview=_preview(last.content) if last else "",
        message_count=count,
        updated_at=conversation.updated_at,
    )


async def delete_conversation_controller(
    session: AsyncSession, user: User, conversation_id: str
) -> DeleteConversationResponse:
    conversation = await _require_conversation(session, user, conversation_id)
    await conversation_repo.delete_conversation(session, conversation)
    await session.commit()
    return DeleteConversationResponse(id=conversation_id, deleted=True)
