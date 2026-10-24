from src.agents.state import AgentState
from src.config import get_settings
from src.db.session import AsyncSessionLocal
from src.repositories.document_repo import (
    get_chunks_by_ids,
    get_neighbor_chunks,
    list_documents_by_ids,
)
from src.services.retrieval import hybrid_rerank
from src.services.vector_store import build_access_filter, search_similar

# Số ký tự tối đa lấy thêm từ mỗi đoạn LIỀN KỀ (trước/sau) để ngữ cảnh liền mạch.
_NEIGHBOR_CHARS = 350


async def retrieve_context_node(state: AgentState) -> dict:
    if state.get("error"):
        return {}

    # Câu chào hỏi/xã giao/hỏi về trợ lý → KHÔNG truy hồi tài liệu: trả lời tự nhiên,
    # không có CONTEXT đánh số nên không thể sinh trích dẫn [n] sai chỗ.
    from src.services.citations import is_smalltalk

    if is_smalltalk(state.get("query", "")):
        return {"retrieved_chunks": [], "context": "", "sources": [], "doc_info": {}}

    settings = get_settings()
    top_k = int(state.get("top_k") or 5)
    # Truy hồi rộng hơn top_k để bước rerank chọn lại; áp ngưỡng điểm ngay tại
    # Qdrant để loại các chunk kém liên quan (chống bịa).
    candidate_limit = top_k * settings.rag_candidate_multiplier
    # Lọc theo quyền: student chỉ tài liệu nhà trường; lecturer thêm tài liệu của mình.
    access_filter = build_access_filter(state.get("user_role"), state.get("user_id"))

    try:
        query_vector = state.get("query_embedding", [])
        # Truy hồi 2 tầng: ưu tiên ngưỡng cao (chắc chắn liên quan); nếu RỖNG mới
        # hạ xuống ngưỡng dự phòng. Nhờ vậy tài liệu đã lập chỉ mục luôn trả lời
        # được dù điểm cosine chỉ ở mức vừa phải (tiếng Việt/đoạn ngắn) — đồng thời
        # vẫn loại nhiễu thật sự (dưới fallback) để không bịa khi hỏi ngoài phạm vi.
        results = await search_similar(
            query_vector=query_vector,
            top_k=candidate_limit,
            score_threshold=settings.rag_min_score,
            query_filter=access_filter,
        )
        if not results and settings.rag_fallback_min_score < settings.rag_min_score:
            results = await search_similar(
                query_vector=query_vector,
                top_k=candidate_limit,
                score_threshold=settings.rag_fallback_min_score,
                query_filter=access_filter,
            )
        candidate_ids = [r.chunk_id for r in results if r.chunk_id]
        score_by_chunk_id = {r.chunk_id: r.score for r in results}
        payload_by_chunk_id = {r.chunk_id: r.payload for r in results}

        async with AsyncSessionLocal() as session:
            db_chunks = await get_chunks_by_ids(session, candidate_ids)
    except Exception as exc:
        # Soft-fail: let the graph reach persistence so the run is finalized.
        return {"error": f"Vector search error: {exc}"}

    # Loại chunk TRÙNG NỘI DUNG (tài liệu nạp 2 lần / đoạn lặp) — giữ bản điểm cao
    # nhất, để top_k không bị bản sao chiếm chỗ của thông tin khác.
    seen_contents: set[str] = set()
    unique_chunks = []
    for chunk in db_chunks:
        fingerprint = " ".join((chunk.content or "").lower().split())[:300]
        if fingerprint in seen_contents:
            continue
        seen_contents.add(fingerprint)
        unique_chunks.append(chunk)

    # Hybrid rerank (dense + BM25 RRF) trên tập ứng viên, rồi lấy top_k.
    candidates = [
        {
            "chunk_id": chunk.id,
            "content": chunk.content,
            "dense_score": float(score_by_chunk_id.get(chunk.id, 0.0)),
            "_chunk": chunk,
        }
        for chunk in unique_chunks
    ]
    rerank_query = state.get("search_query") or state.get("query", "")
    reranked = hybrid_rerank(rerank_query, candidates)[:top_k]

    # Nâng chất lượng ngữ cảnh (best-effort, lỗi thì bỏ qua):
    # - doc_info: metadata tài liệu (tổng trang, loại) → trả lời đúng câu hỏi chung
    #   về tài liệu, không đoán số trang từ vài đoạn trích.
    # - neighbors: nối thêm phần đầu/cuối của đoạn LIỀN KỀ để ý không bị cắt cụt.
    doc_info: dict[str, dict] = {}
    neighbors: dict[tuple[str, int], object] = {}
    try:
        top_doc_ids = list({c["_chunk"].document_id for c in reranked})
        pairs = []
        for c in reranked:
            ch = c["_chunk"]
            idx = getattr(ch, "chunk_index", None)
            if idx is not None:
                pairs += [(ch.document_id, idx - 1), (ch.document_id, idx + 1)]
        async with AsyncSessionLocal() as session:
            for d in await list_documents_by_ids(session, top_doc_ids):
                doc_info[d.id] = {
                    "title": d.title,
                    "file_type": d.file_type,
                    "total_pages": d.total_pages,
                    "total_chunks": d.total_chunks,
                }
            neighbors = await get_neighbor_chunks(session, pairs)
    except Exception:  # noqa: BLE001 — phần bổ trợ, không được làm hỏng truy hồi
        doc_info, neighbors = {}, {}

    retrieved_chunks: list[dict] = []
    sources: list[dict] = []
    for cand in reranked:
        chunk = cand["_chunk"]
        payload = payload_by_chunk_id.get(chunk.id, {})
        title = str(payload.get("title") or "Unknown document")
        score = cand["dense_score"]
        quote = chunk.content[:500]

        md = chunk.metadata_json if isinstance(chunk.metadata_json, dict) else {}
        section_title = md.get("section_title")
        if not section_title and isinstance(payload.get("metadata"), dict):
            section_title = payload.get("metadata", {}).get("section_title")

        # Nguồn YouTube: gắn timestamp + link nhảy thẳng tới đúng mốc thời gian.
        source_url = None
        timestamp = None
        if md.get("kind") == "youtube" and md.get("video_id"):
            start = int(md.get("start_seconds") or 0)
            timestamp = md.get("timestamp")
            source_url = f"https://www.youtube.com/watch?v={md['video_id']}&t={start}s"
        elif md.get("kind") == "web" and md.get("url"):
            # Nguồn trang web: link mở trang gốc.
            source_url = md.get("url")

        # Ngữ cảnh liền mạch: nối đuôi đoạn TRƯỚC + đầu đoạn SAU (nếu có) quanh chunk.
        content = chunk.content
        chunk_index = getattr(chunk, "chunk_index", None)
        if chunk_index is not None:
            prev = neighbors.get((chunk.document_id, chunk_index - 1))
            nxt = neighbors.get((chunk.document_id, chunk_index + 1))
            if prev is not None and (prev.content or "").strip():
                content = f"(...đoạn trước: {prev.content[-_NEIGHBOR_CHARS:].strip()})\n{content}"
            if nxt is not None and (nxt.content or "").strip():
                content = f"{content}\n(...đoạn sau: {nxt.content[:_NEIGHBOR_CHARS].strip()})"

        item = {
            "chunk_id": chunk.id,
            "document_id": chunk.document_id,
            "title": title,
            "page_number": chunk.page_number,
            "section_title": section_title,
            "content": content,
            "score": score,
            "quote": quote,
            "url": source_url,
            "timestamp": timestamp,
        }
        retrieved_chunks.append(item)
        sources.append(
            {
                "document_id": chunk.document_id,
                "title": title,
                "page_number": chunk.page_number,
                "section_title": section_title,
                "chunk_id": chunk.id,
                "score": score,
                "quote": quote,
                "url": source_url,
                "timestamp": timestamp,
            }
        )

    context = "\n\n".join(chunk["content"] for chunk in retrieved_chunks)
    return {
        "retrieved_chunks": retrieved_chunks,
        "context": context,
        "sources": sources,
        "doc_info": doc_info,
    }
