import time

from src.agents.state import AgentState
from src.config import get_settings
from src.db.models import AgentRun
from src.db.session import AsyncSessionLocal
from src.repositories.conversation_repo import (
    create_agent_run,
    create_citations,
    create_message,
    finish_agent_run,
    get_or_create_conversation,
    get_recent_messages,
)


async def save_user_message_node(state: AgentState) -> dict:
    if state.get("error") or state.get("metadata", {}).get("skip_persistence"):
        return {}

    # KHÔNG gọi init_db() ở đây: schema đã được tạo/nâng cấp lúc khởi động (lifespan).
    # Gọi mỗi tin nhắn sẽ chạy DDL trên bảng users → khóa bảng → mọi request xác thực
    # (chat, kho tài liệu, stats) bị treo trên môi trường 1-worker.
    settings = get_settings()
    async with AsyncSessionLocal() as session:
        conversation = await get_or_create_conversation(
            session,
            state.get("conversation_id"),
            title=state["query"][:80],
            user_id=state.get("user_id"),
        )
        # Lấy lịch sử TRƯỚC khi lưu câu hỏi hiện tại (để không gồm chính nó).
        history = [
            {"role": m.role, "content": m.content}
            for m in await get_recent_messages(session, conversation.id, limit=6)
        ]
        user_message = await create_message(
            session,
            conversation_id=conversation.id,
            role="user",
            content=state["query"],
        )
        run = await create_agent_run(
            session,
            conversation_id=conversation.id,
            user_message_id=user_message.id,
            model_name=settings.model_name,
            embedding_model=settings.embedding_model,
        )
        await session.commit()

    metadata = {**state.get("metadata", {}), "started_at": time.perf_counter()}
    return {
        "conversation_id": conversation.id,
        "user_message_id": user_message.id,
        "agent_run_id": run.id,
        "history": history,
        "metadata": metadata,
    }


async def save_assistant_message_node(state: AgentState) -> dict:
    if state.get("metadata", {}).get("skip_persistence") or not state.get("conversation_id"):
        return {}

    started_at = float(state.get("metadata", {}).get("started_at", time.perf_counter()))
    latency_ms = int((time.perf_counter() - started_at) * 1000)
    async with AsyncSessionLocal() as session:
        assistant_message = await create_message(
            session,
            conversation_id=state["conversation_id"],
            role="assistant",
            content=state.get("response", ""),
            metadata={
                "sources": state.get("sources", []),
                "confidence": state.get("confidence"),
            },
        )
        if state.get("sources"):
            await create_citations(
                session,
                message_id=assistant_message.id,
                sources=state["sources"],
            )
        if state.get("agent_run_id"):
            run = await session.get(AgentRun, state["agent_run_id"])
            if run is not None:
                await finish_agent_run(
                    session,
                    run,
                    status="failed" if state.get("error") else "completed",
                    assistant_message_id=assistant_message.id,
                    latency_ms=latency_ms,
                    error=state.get("error", ""),
                )
        await session.commit()
    return {"assistant_message_id": assistant_message.id}
