import json
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.models.chat import (
    ChatRequest,
    ChatResponse,
    FeedbackRequest,
    FeedbackResponse,
    FeedbackSummary,
    SignalRequest,
    SignalsSummary,
)
from src.models.dataset import IngestResponse
from src.repositories import feedback_repo
from src.services.chat_stream import stream_chat_events


async def chat_controller(
    request: ChatRequest,
    agent_instance: Any,
    *,
    user_id: str | None = None,
    user_role: str | None = None,
    session: AsyncSession | None = None,
) -> ChatResponse:
    # Endpoint này còn là "lưới an toàn" (fallback) cho chat streaming khi SSE bị
    # proxy chặn/đứt trên môi trường deploy. Vì vậy KHÔNG để nó ném 500: mọi lỗi
    # đều suy biến thành câu trả lời lịch sự để người dùng không bị "không trả lời".
    try:
        result = await agent_instance.ainvoke(
            {
                "query": request.message,
                "conversation_id": request.conversation_id,
                "top_k": request.top_k,
                "user_id": user_id,
                "user_role": user_role,
            }
        )
        response_text = result.get("response", "") or (
            "Xin lỗi, hiện chưa tạo được câu trả lời. Vui lòng thử lại."
        )
        from src.config import get_settings
        from src.services.confidence import assess_answer

        sources = result.get("sources", [])
        settings = get_settings()
        assessment = assess_answer(
            response_text,
            [s if isinstance(s, dict) else s.model_dump() for s in sources],
            rag_min_score=settings.rag_min_score,
            rag_fallback_min_score=settings.rag_fallback_min_score,
        )

        # Ghi nhận số token tiêu thụ thực tế nếu có session
        if user_id and session:
            try:
                from src.services.billing import record_token_usage
                from src.services.llm import count_text_tokens

                prompt_tokens = count_text_tokens(request.message) + sum(
                    count_text_tokens(getattr(s, "quote", "") or "") for s in sources
                )
                completion_tokens = count_text_tokens(response_text)
                total_tokens = prompt_tokens + completion_tokens
                if total_tokens > 0:
                    await record_token_usage(
                        session,
                        user_id=user_id,
                        tokens=total_tokens,
                        request_id=request.request_id,
                    )
            except Exception:
                pass

        return ChatResponse(
            response=response_text,
            conversation_id=result.get("conversation_id"),
            sources=sources,
            grounded=assessment["grounded"],
            confidence=assessment["confidence"],
            confidence_level=assessment["level"],
        )
    except Exception:
        return ChatResponse(
            response=(
                "Xin lỗi, trợ lý AI đang gặp sự cố tạm thời. Vui lòng thử lại sau giây lát."
            ),
            conversation_id=request.conversation_id,
            sources=[],
        )


async def ingest_sample_dataset_controller(
    session: AsyncSession,
    ingest_func: Callable[..., Awaitable[dict[str, Any]]],
    *,
    force: bool = False,
) -> IngestResponse:
    try:
        result = await ingest_func(session, force=force)
        return IngestResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def chat_stream_controller(
    request: ChatRequest, *, user_id: str | None = None, user_role: str | None = None
) -> StreamingResponse:
    events: AsyncIterator[str] = stream_chat_events(
        query=request.message,
        conversation_id=request.conversation_id,
        user_id=user_id,
        user_role=user_role,
        top_k=request.top_k,
        request_id=request.request_id,
    )
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def agent_status_controller() -> dict[str, str]:
    return {"status": "ready", "agent": "RAG Agent v1.0"}


# ---- Feedback loop (Product AI) ----
async def submit_feedback_controller(
    request: FeedbackRequest, session: AsyncSession, user: User
) -> FeedbackResponse:
    if not await feedback_repo.message_exists(session, request.message_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy câu trả lời để đánh giá.")
    fb = await feedback_repo.upsert_feedback(
        session,
        message_id=request.message_id,
        user_id=getattr(user, "id", None),
        rating=request.rating,
        reason=request.reason.strip(),
    )
    return FeedbackResponse(ok=True, rating=fb.rating)


async def delete_feedback_controller(
    message_id: str, session: AsyncSession, user: User
) -> FeedbackResponse:
    if not await feedback_repo.message_exists(session, message_id):
        raise HTTPException(status_code=404, detail="KhÃ´ng tÃ¬m tháº¥y cÃ¢u tráº£ lá»i Ä‘á»ƒ Ä‘Ã¡nh giÃ¡.")
    await feedback_repo.delete_feedback(
        session,
        message_id=message_id,
        user_id=getattr(user, "id", None),
    )
    return FeedbackResponse(ok=True, rating=None)


async def feedback_summary_controller(session: AsyncSession) -> FeedbackSummary:
    return FeedbackSummary(**await feedback_repo.summary(session))


# ---- Implicit + System signals ----
async def submit_signal_controller(
    request: SignalRequest, session: AsyncSession, user: User
) -> dict:
    if not await feedback_repo.message_exists(session, request.message_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy câu trả lời.")
    await feedback_repo.record_signal(
        session,
        message_id=request.message_id,
        user_id=getattr(user, "id", None),
        kind=request.kind,
        name=request.name,
        value=request.value,
    )
    return {"ok": True}


async def signals_summary_controller(session: AsyncSession) -> SignalsSummary:
    return SignalsSummary(**await feedback_repo.signals_summary(session))


# ---- AI Evaluation (Product AI): đọc báo cáo offline từ evaluate_rag_sample.py ----
_EVAL_REPORT = Path("eval/results/rag_report.json")


async def eval_report_controller() -> dict:
    """Trả về summary của lần đánh giá RAG gần nhất (eval/results/rag_report.json)."""
    if not _EVAL_REPORT.exists():
        return {"available": False, "summary": None, "generated_at": None}
    try:
        data = json.loads(_EVAL_REPORT.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {"available": False, "summary": None, "generated_at": None}
    generated_at = datetime.fromtimestamp(
        _EVAL_REPORT.stat().st_mtime, tz=UTC
    ).isoformat()
    return {"available": True, "summary": data.get("summary", {}), "generated_at": generated_at}
