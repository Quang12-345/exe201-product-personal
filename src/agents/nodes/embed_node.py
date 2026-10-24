from src.agents.state import AgentState
from src.services.embeddings import embed_query
from src.services.llm import contextualize_query, needs_diacritic_restore, restore_diacritics


async def embed_query_node(state: AgentState) -> dict:
    if state.get("error"):
        return {}
    try:
        # Follow-up: viết lại câu hỏi thành câu độc lập theo lịch sử để truy hồi đúng.
        search_query = await contextualize_query(state["query"], state.get("history"))
        # Câu tiếng Việt KHÔNG DẤU → khôi phục dấu cho SEARCH QUERY (embedding khớp
        # tài liệu có dấu tốt hơn hẳn). Câu hỏi gốc gửi cho LLM giữ nguyên.
        if needs_diacritic_restore(search_query):
            search_query = await restore_diacritics(search_query)
        embedding = await embed_query(search_query)
    except Exception as exc:
        # Soft-fail so the graph still reaches the persistence node and the
        # AgentRun is marked failed instead of being stuck at "running".
        return {"error": f"Embedding service error: {exc}"}
    return {"query_embedding": embedding, "search_query": search_query}
