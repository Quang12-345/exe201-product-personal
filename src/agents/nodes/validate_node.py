from src.agents.state import AgentState


async def validate_input_node(state: AgentState) -> dict:
    query = state.get("query", "").strip()
    if not query:
        return {"error": "Message cannot be empty."}
    top_k = int(state.get("top_k") or 5)
    top_k = max(1, min(top_k, 20))
    return {"query": query, "top_k": top_k}
