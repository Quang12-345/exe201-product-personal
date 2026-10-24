from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest

from src.agents.nodes import embed_node, retrieve_node
from src.services.vector_store import VectorSearchResult


@pytest.mark.asyncio
async def test_embed_node_soft_fails_on_exception(monkeypatch):
    async def boom(_query):
        raise RuntimeError("OpenAI down")

    monkeypatch.setattr(embed_node, "embed_query", boom)

    result = await embed_node.embed_query_node({"query": "hi"})

    assert "error" in result
    assert "Embedding service error" in result["error"]
    assert "query_embedding" not in result


@pytest.mark.asyncio
async def test_embed_node_short_circuits_on_existing_error():
    result = await embed_node.embed_query_node({"query": "hi", "error": "earlier"})
    assert result == {}


@pytest.mark.asyncio
async def test_retrieve_node_soft_fails_on_exception(monkeypatch):
    async def boom(*, query_vector, top_k):
        raise RuntimeError("Qdrant unreachable")

    monkeypatch.setattr(retrieve_node, "search_similar", boom)

    result = await retrieve_node.retrieve_context_node(
        {"query_embedding": [0.1] * 1536, "top_k": 5}
    )

    assert "error" in result
    assert "Vector search error" in result["error"]


@pytest.mark.asyncio
async def test_retrieve_node_short_circuits_on_existing_error():
    result = await retrieve_node.retrieve_context_node({"error": "earlier"})
    assert result == {}


@pytest.mark.asyncio
async def test_retrieve_node_falls_back_to_lower_threshold(monkeypatch):
    """Khi ngưỡng chính không ra chunk nào, phải truy hồi lại với ngưỡng dự phòng
    để tài liệu đã lập chỉ mục (điểm cosine vừa phải) vẫn trả lời được."""
    calls: list[float | None] = []

    async def fake_search(*, query_vector, top_k, score_threshold=None, query_filter=None):
        calls.append(score_threshold)
        # Vòng 1 (ngưỡng cao) rỗng; vòng 2 (ngưỡng thấp) trả 1 chunk liên quan vừa phải.
        if len(calls) == 1:
            return []
        return [
            VectorSearchResult(
                chunk_id="c1",
                document_id="d1",
                score=0.28,
                payload={"title": "Quy chế đào tạo", "metadata": {}},
            )
        ]

    async def fake_get_chunks(_session, chunk_ids):
        return [
            SimpleNamespace(
                id="c1",
                document_id="d1",
                content="Sinh viên được nghỉ tối đa 20% số tiết.",
                page_number=3,
                metadata_json={"section_title": "Điểm danh"},
            )
        ]

    @asynccontextmanager
    async def fake_session():
        yield object()

    monkeypatch.setattr(retrieve_node, "search_similar", fake_search)
    monkeypatch.setattr(retrieve_node, "get_chunks_by_ids", fake_get_chunks)
    monkeypatch.setattr(retrieve_node, "AsyncSessionLocal", fake_session)

    result = await retrieve_node.retrieve_context_node(
        {"query_embedding": [0.1] * 1536, "top_k": 5, "user_role": "student", "user_id": "s1"}
    )

    # Đã gọi 2 lần: ngưỡng chính rồi ngưỡng dự phòng (thấp hơn).
    assert len(calls) == 2
    assert calls[0] > calls[1]
    assert "error" not in result
    assert len(result["retrieved_chunks"]) == 1
    assert "20%" in result["context"]
