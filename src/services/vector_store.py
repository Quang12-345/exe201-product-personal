from dataclasses import dataclass

from src.config import get_settings


@dataclass(frozen=True)
class VectorSearchResult:
    chunk_id: str
    document_id: str
    score: float
    payload: dict


def get_qdrant_client(timeout: float = 60.0):
    from qdrant_client import AsyncQdrantClient

    settings = get_settings()
    return AsyncQdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key or None,
        timeout=timeout,
    )


async def ensure_collection() -> None:
    from qdrant_client import models

    settings = get_settings()
    client = get_qdrant_client()
    if await client.collection_exists(settings.qdrant_collection_name):
        await _ensure_payload_indexes(client, settings.qdrant_collection_name)
        return

    try:
        await client.create_collection(
            collection_name=settings.qdrant_collection_name,
            vectors_config=models.VectorParams(
                size=settings.embedding_dimension,
                distance=models.Distance.COSINE,
            ),
        )
    except Exception as exc:
        message = str(exc).lower()
        if "already exists" not in message and "409" not in message:
            raise
    await _ensure_payload_indexes(client, settings.qdrant_collection_name)


async def _ensure_payload_indexes(client, collection_name: str) -> None:
    from qdrant_client import models

    # Qdrant Cloud (strict mode) refuses filtered count/search on unindexed keys.
    for field_name in ("document_id", "scope", "owner_id"):
        try:
            await client.create_payload_index(
                collection_name=collection_name,
                field_name=field_name,
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
        except Exception as exc:
            message = str(exc).lower()
            if "already exists" not in message and "409" not in message:
                raise


def build_access_filter(role: str | None, user_id: str | None):
    """Filter Qdrant cho RETRIEVAL của chatbot.

    Chủ đích: chatbot là KHO TRI THỨC DÙNG CHUNG — mọi vai trò (admin/lecturer/
    student) đều hỏi-đáp trên CÙNG MỘT tập tài liệu để trải nghiệm đồng nhất. Vì
    vậy KHÔNG lọc theo vai trò ở tầng truy hồi (trả về None = xem tất cả).

    Lưu ý: phân quyền HIỂN THỊ vẫn được giữ riêng ở tầng THƯ VIỆN
    (list_available_documents_controller): student không thấy quy định trong thư
    viện, lecturer thấy tài liệu của mình... — đó là việc liệt kê tài liệu, tách
    bạch với việc chatbot được phép tham chiếu nội dung để trả lời.

    `role`/`user_id` giữ trong chữ ký để có thể siết lại sau này nếu cần.
    """
    return None


async def recreate_collection() -> None:
    """Drop and recreate the collection. Use together with a forced re-ingest."""
    settings = get_settings()
    client = get_qdrant_client()
    if await client.collection_exists(settings.qdrant_collection_name):
        await client.delete_collection(settings.qdrant_collection_name)
    await ensure_collection()


async def delete_points(point_ids: list[str]) -> int:
    from qdrant_client import models

    if not point_ids:
        return 0
    settings = get_settings()
    client = get_qdrant_client()
    await client.delete(
        collection_name=settings.qdrant_collection_name,
        points_selector=models.PointIdsList(points=point_ids),
    )
    return len(point_ids)


async def count_points_for_document(document_id: str) -> int:
    from qdrant_client import models

    settings = get_settings()
    client = get_qdrant_client()
    if not await client.collection_exists(settings.qdrant_collection_name):
        return 0
    result = await client.count(
        collection_name=settings.qdrant_collection_name,
        count_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="document_id",
                    match=models.MatchValue(value=document_id),
                )
            ]
        ),
        exact=True,
    )
    return int(result.count)


async def delete_points_for_document(document_id: str) -> None:
    from qdrant_client import models

    settings = get_settings()
    client = get_qdrant_client()
    if not await client.collection_exists(settings.qdrant_collection_name):
        return
    await client.delete(
        collection_name=settings.qdrant_collection_name,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id),
                    )
                ]
            )
        ),
    )


async def delete_orphan_points(valid_document_ids: set[str]) -> int:
    """Remove points whose document no longer exists in the database."""
    settings = get_settings()
    client = get_qdrant_client()
    if not await client.collection_exists(settings.qdrant_collection_name):
        return 0

    orphan_ids: list = []
    offset = None
    while True:
        points, offset = await client.scroll(
            collection_name=settings.qdrant_collection_name,
            limit=256,
            offset=offset,
            with_payload=["document_id"],
            with_vectors=False,
        )
        for point in points:
            document_id = str((point.payload or {}).get("document_id", ""))
            if document_id not in valid_document_ids:
                orphan_ids.append(point.id)
        if offset is None:
            break

    return await delete_points(orphan_ids)


async def upsert_chunks(
    *,
    vectors: list[list[float]],
    chunks: list[dict],
) -> int:
    from qdrant_client import models

    if not vectors or not chunks:
        return 0
    if len(vectors) != len(chunks):
        raise ValueError("vectors and chunks must have the same length")

    settings = get_settings()
    client = get_qdrant_client(timeout=60.0)
    await ensure_collection()

    points = [
        models.PointStruct(
            id=chunk["qdrant_point_id"],
            vector=vector,
            payload={
                "chunk_id": chunk["chunk_id"],
                "document_id": chunk["document_id"],
                "title": chunk["title"],
                "page_number": chunk.get("page_number"),
                "file_type": chunk.get("file_type", "pdf"),
                "scope": chunk.get("scope", "school"),
                "owner_id": chunk.get("owner_id") or "",
                "category": chunk.get("category", "syllabus"),
                "metadata": chunk.get("metadata", {}),
            },
        )
        for vector, chunk in zip(vectors, chunks, strict=True)
    ]

    batch_size = 50
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]
        await client.upsert(collection_name=settings.qdrant_collection_name, points=batch)

    return len(points)


async def search_similar(
    *,
    query_vector: list[float],
    top_k: int = 5,
    score_threshold: float | None = None,
    query_filter=None,
) -> list[VectorSearchResult]:
    settings = get_settings()
    client = get_qdrant_client()
    await ensure_collection()

    response = await client.query_points(
        collection_name=settings.qdrant_collection_name,
        query=query_vector,
        limit=top_k,
        score_threshold=score_threshold,
        query_filter=query_filter,
        with_payload=True,
    )
    results = getattr(response, "points", response)
    return [
        VectorSearchResult(
            chunk_id=str((item.payload or {}).get("chunk_id", "")),
            document_id=str((item.payload or {}).get("document_id", "")),
            score=float(getattr(item, "score", 0.0) or 0.0),
            payload=dict(item.payload or {}),
        )
        for item in results
    ]
