from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import AgentRun, Citation, Conversation, Document, Message, Role, User


async def get_recent_messages(
    session: AsyncSession,
    conversation_id: str,
    *,
    limit: int = 6,
) -> list[Message]:
    """Trả về `limit` message gần nhất của hội thoại, theo thứ tự thời gian tăng dần."""
    result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(result.scalars().all())
    messages.reverse()
    return messages


async def get_or_create_conversation(
    session: AsyncSession,
    conversation_id: str | None,
    *,
    title: str | None = None,
    user_id: str | None = None,
) -> Conversation:
    if conversation_id:
        conversation = await session.get(Conversation, conversation_id)
        if conversation is not None:
            return conversation

    conversation = Conversation(title=title, user_id=user_id)
    session.add(conversation)
    await session.flush()
    return conversation


async def list_conversations_by_user(session: AsyncSession, user_id: str) -> list[Conversation]:
    result = await session.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_conversation(session: AsyncSession, conversation_id: str) -> Conversation | None:
    return await session.get(Conversation, conversation_id)


async def list_messages(session: AsyncSession, conversation_id: str) -> list[Message]:
    result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def last_message(session: AsyncSession, conversation_id: str) -> Message | None:
    result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def count_messages(session: AsyncSession, conversation_id: str) -> int:
    result = await session.execute(
        select(func.count()).select_from(Message).where(Message.conversation_id == conversation_id)
    )
    return int(result.scalar_one())


async def rename_conversation(session: AsyncSession, conversation: Conversation, title: str) -> None:
    conversation.title = title
    await session.flush()


async def delete_conversation(session: AsyncSession, conversation: Conversation) -> None:
    # ORM cascade (all, delete-orphan) tự xóa messages + citations liên quan.
    await session.delete(conversation)
    await session.flush()


async def count_conversations(session: AsyncSession, *, user_id: str | None = None) -> int:
    stmt = select(func.count()).select_from(Conversation)
    if user_id is not None:
        stmt = stmt.where(Conversation.user_id == user_id)
    result = await session.execute(stmt)
    return int(result.scalar_one())


async def count_agent_runs(session: AsyncSession) -> int:
    result = await session.execute(select(func.count()).select_from(AgentRun))
    return int(result.scalar_one())


async def list_agent_runs_since(session: AsyncSession, since: datetime) -> list[AgentRun]:
    result = await session.execute(
        select(AgentRun)
        .where(AgentRun.created_at >= since)
        .order_by(AgentRun.created_at)
    )
    return list(result.scalars().all())


async def count_agent_runs_by_role(
    session: AsyncSession,
    *,
    since: datetime | None = None,
) -> list[tuple[str, int]]:
    stmt = (
        select(Role.name, func.count(AgentRun.id))
        .select_from(AgentRun)
        .outerjoin(Conversation, AgentRun.conversation_id == Conversation.id)
        .outerjoin(User, Conversation.user_id == User.id)
        .outerjoin(Role, User.role_id == Role.id)
    )
    if since is not None:
        stmt = stmt.where(AgentRun.created_at >= since)
    stmt = stmt.group_by(Role.name).order_by(func.count(AgentRun.id).desc())
    result = await session.execute(stmt)
    return [(role or "unknown", int(count)) for role, count in result.all()]


async def list_unanswered_queries(
    session: AsyncSession,
    *,
    since: datetime,
    limit: int | None = None,
) -> list[tuple[str, int, datetime]]:
    unanswered = or_(
        AgentRun.status != "completed",
        AgentRun.error != "",
        Citation.id.is_(None),
    )
    count_expr = func.count(func.distinct(AgentRun.id))
    latest_expr = func.max(AgentRun.created_at)
    stmt = (
        select(Message.content, count_expr, latest_expr)
        .select_from(AgentRun)
        .join(Message, AgentRun.user_message_id == Message.id)
        .outerjoin(Citation, AgentRun.assistant_message_id == Citation.message_id)
        .where(AgentRun.created_at >= since, Message.role == "user", unanswered)
        .group_by(Message.content)
        .order_by(latest_expr.desc(), count_expr.desc())
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    result = await session.execute(stmt)
    return [(content, int(count), latest) for content, count, latest in result.all()]


async def list_cited_document_metadata(
    session: AsyncSession,
    *,
    since: datetime,
    limit: int = 2000,
) -> list[dict]:
    result = await session.execute(
        select(Document.metadata_json)
        .select_from(AgentRun)
        .join(Citation, AgentRun.assistant_message_id == Citation.message_id)
        .join(Document, Citation.document_id == Document.id)
        .where(AgentRun.created_at >= since, AgentRun.status == "completed")
        .limit(limit)
    )
    return [metadata or {} for metadata in result.scalars().all()]


async def create_message(
    session: AsyncSession,
    *,
    conversation_id: str,
    role: str,
    content: str,
    metadata: dict | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        metadata_json=metadata or {},
    )
    session.add(message)
    await session.flush()
    return message


async def create_agent_run(
    session: AsyncSession,
    *,
    conversation_id: str | None,
    user_message_id: str | None,
    model_name: str,
    embedding_model: str,
) -> AgentRun:
    run = AgentRun(
        conversation_id=conversation_id,
        user_message_id=user_message_id,
        model_name=model_name,
        embedding_model=embedding_model,
    )
    session.add(run)
    await session.flush()
    return run


async def finish_agent_run(
    session: AsyncSession,
    run: AgentRun,
    *,
    status: str,
    assistant_message_id: str | None = None,
    latency_ms: int = 0,
    error: str = "",
) -> None:
    run.status = status
    run.assistant_message_id = assistant_message_id
    run.latency_ms = latency_ms
    run.error = error
    await session.flush()


async def create_citations(
    session: AsyncSession,
    *,
    message_id: str,
    sources: list[dict],
) -> list[Citation]:
    citations: list[Citation] = []
    for source in sources:
        citation = Citation(
            message_id=message_id,
            document_id=source["document_id"],
            chunk_id=source["chunk_id"],
            page_number=source.get("page_number"),
            quote=source.get("quote", ""),
            score=float(source.get("score", 0.0)),
        )
        session.add(citation)
        citations.append(citation)
    await session.flush()
    return citations
