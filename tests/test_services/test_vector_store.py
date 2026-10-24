from types import SimpleNamespace

import pytest

from src.services import vector_store


@pytest.mark.asyncio
async def test_ensure_collection_skips_existing_collection(monkeypatch):
    class FakeClient:
        async def collection_exists(self, collection_name):
            assert collection_name == "project-db"
            return True

        async def create_collection(self, **kwargs):
            raise AssertionError("existing collection should not be recreated")

        async def create_payload_index(self, **kwargs):
            assert kwargs["collection_name"] == "project-db"
            assert kwargs["field_name"] in {"document_id", "scope", "owner_id"}

    monkeypatch.setattr(
        vector_store,
        "get_settings",
        lambda: SimpleNamespace(
            qdrant_collection_name="project-db",
            embedding_dimension=1536,
        ),
    )
    monkeypatch.setattr(vector_store, "get_qdrant_client", lambda *args, **kwargs: FakeClient())

    await vector_store.ensure_collection()


@pytest.mark.asyncio
async def test_search_similar_uses_qdrant_query_points(monkeypatch):
    class FakeClient:
        async def query_points(self, **kwargs):
            assert kwargs["collection_name"] == "project-db"
            assert kwargs["query"] == [0.1] * 1536
            assert kwargs["limit"] == 5
            assert kwargs["with_payload"] is True
            return SimpleNamespace(
                points=[
                    SimpleNamespace(
                        payload={"chunk_id": "chunk-1", "document_id": "doc-1"},
                        score=0.91,
                    )
                ]
            )

    async def fake_ensure_collection():
        return None

    monkeypatch.setattr(
        vector_store,
        "get_settings",
        lambda: SimpleNamespace(qdrant_collection_name="project-db"),
    )
    monkeypatch.setattr(vector_store, "get_qdrant_client", lambda *args, **kwargs: FakeClient())
    monkeypatch.setattr(vector_store, "ensure_collection", fake_ensure_collection)

    results = await vector_store.search_similar(query_vector=[0.1] * 1536, top_k=5)

    assert len(results) == 1
    assert results[0].chunk_id == "chunk-1"
    assert results[0].document_id == "doc-1"
    assert results[0].score == 0.91


@pytest.mark.asyncio
async def test_upsert_chunks_includes_metadata_payload(monkeypatch):
    captured = {}

    class FakeClient:
        async def upsert(self, **kwargs):
            captured["points"] = kwargs["points"]

    async def fake_ensure_collection():
        return None

    monkeypatch.setattr(
        vector_store,
        "get_settings",
        lambda: SimpleNamespace(qdrant_collection_name="project-db"),
    )
    monkeypatch.setattr(vector_store, "get_qdrant_client", lambda *args, **kwargs: FakeClient())
    monkeypatch.setattr(vector_store, "ensure_collection", fake_ensure_collection)

    count = await vector_store.upsert_chunks(
        vectors=[[0.1, 0.2]],
        chunks=[
            {
                "qdrant_point_id": "11111111-1111-1111-1111-111111111111",
                "chunk_id": "chunk-1",
                "document_id": "doc-1",
                "title": "Lecture",
                "page_number": 2,
                "file_type": "pdf",
                "metadata": {"section_title": "Intro"},
            }
        ],
    )

    assert count == 1
    assert captured["points"][0].payload["metadata"]["section_title"] == "Intro"


@pytest.mark.asyncio
async def test_upsert_chunks_batches_points(monkeypatch):
    upsert_calls = []

    class FakeClient:
        async def upsert(self, **kwargs):
            upsert_calls.append(kwargs["points"])

    async def fake_ensure_collection():
        return None

    monkeypatch.setattr(
        vector_store,
        "get_settings",
        lambda: SimpleNamespace(qdrant_collection_name="project-db"),
    )
    monkeypatch.setattr(vector_store, "get_qdrant_client", lambda *args, **kwargs: FakeClient())
    monkeypatch.setattr(vector_store, "ensure_collection", fake_ensure_collection)

    vectors = [[0.1, 0.2]] * 120
    chunks = [
        {
            "qdrant_point_id": f"11111111-1111-1111-1111-1111111111{i:02d}",
            "chunk_id": f"chunk-{i}",
            "document_id": "doc-1",
            "title": "Lecture",
            "page_number": 2,
            "file_type": "pdf",
            "metadata": {"section_title": "Intro"},
        }
        for i in range(120)
    ]

    count = await vector_store.upsert_chunks(
        vectors=vectors,
        chunks=chunks,
    )

    assert count == 120
    assert len(upsert_calls) == 3
    assert len(upsert_calls[0]) == 50
    assert len(upsert_calls[1]) == 50
    assert len(upsert_calls[2]) == 20


def test_build_access_filter_shared_corpus_for_all_roles():
    """Chatbot là kho dùng chung: mọi vai trò retrieval trên cùng tập tài liệu →
    không lọc theo vai trò (None). Đảm bảo student và lecturer hỏi được như nhau."""
    assert vector_store.build_access_filter("admin", "u1") is None
    assert vector_store.build_access_filter("lecturer", "u1") is None
    assert vector_store.build_access_filter("student", "u1") is None
    assert vector_store.build_access_filter(None, None) is None
