from src.agents.state import AgentState
from src.services.citations import select_cited_sources
from src.services.llm import generate_answer


async def generate_answer_node(state: AgentState) -> dict:
    if state.get("error"):
        error = str(state["error"])
        if "Embedding service error" in error:
            response = (
                "Xin lỗi, dịch vụ tạo embedding tạm thời không khả dụng. "
                "Vui lòng thử lại sau giây lát."
            )
        elif "Vector search error" in error:
            response = (
                "Xin lỗi, dịch vụ tìm kiếm tài liệu tạm thời không khả dụng "
                "do Qdrant chưa kết nối được. Vui lòng thử lại sau giây lát."
            )
        else:
            response = "Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau giây lát."
        return {"response": response}
    response = await generate_answer(
        question=state["query"],
        context_chunks=state.get("retrieved_chunks", []),
        history=state.get("history"),
        doc_info=state.get("doc_info"),
    )
    # Chỉ giữ nguồn thực sự được trích dẫn trong câu trả lời.
    sources = select_cited_sources(response, state.get("sources", []))
    return {"response": response, "sources": sources}
