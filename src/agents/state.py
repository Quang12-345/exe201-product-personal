from __future__ import annotations

from typing import TypedDict


class AgentState(TypedDict, total=False):
    """State schema cho LangGraph agent.

    Mỗi node đọc và ghi vào state này.
    total=False cho phép tất cả fields là optional.
    """

    query: str
    search_query: str
    history: list[dict]
    user_id: str
    user_role: str
    conversation_id: str
    user_message_id: str
    assistant_message_id: str
    agent_run_id: str
    top_k: int
    query_embedding: list[float]
    retrieved_chunks: list[dict]
    context: str
    sources: list[dict]
    doc_info: dict
    response: str
    error: str
    metadata: dict
