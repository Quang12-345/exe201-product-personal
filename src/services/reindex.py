"""Đồng bộ lại Qdrant TỪ kho tài liệu trên cloud (DB + R2) — chạy được trên deploy
mà KHÔNG cần file ở máy local.

Vì sao hoạt động khi deploy:
- Nội dung đã trích xuất của mỗi tài liệu (chunks) ĐƯỢC LƯU trong Postgres (bảng
  document_chunks). Nên chỉ cần re-embed các chunks này rồi upsert lên Qdrant là
  khôi phục được khả năng truy hồi — không phụ thuộc file local.
- File GỐC nằm trên Cloudflare R2 (metadata_json.r2_key). Nếu một tài liệu vì lý do
  nào đó KHÔNG còn chunks trong DB, tool sẽ TẢI file gốc từ R2 về và xử lý lại
  (lightweight extract → chunk → lưu DB → embed → upsert Qdrant).

Dùng qua endpoint: POST /api/v1/admin/reindex  (admin).
"""

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories import document_repo
from src.services import object_storage
from src.services.embeddings import embed_documents
from src.services.vector_store import delete_orphan_points, upsert_chunks

_EMBED_BATCH = 128


async def _reembed_from_db(session: AsyncSession, document) -> int:
    """Re-embed các chunks ĐÃ CÓ trong DB rồi upsert Qdrant. Trả về số điểm."""
    chunks = await document_repo.list_chunks_by_document(session, document.id)
    chunks = [c for c in chunks if (c.content or "").strip()]
    if not chunks:
        return 0
    meta = document.metadata_json or {}
    total = 0
    # Embed theo lô để an toàn với tài liệu nhiều chunks.
    for i in range(0, len(chunks), _EMBED_BATCH):
        batch = chunks[i : i + _EMBED_BATCH]
        vectors = await embed_documents([c.content for c in batch])
        total += await upsert_chunks(
            vectors=vectors,
            chunks=[
                {
                    "qdrant_point_id": c.qdrant_point_id,
                    "chunk_id": c.id,
                    "document_id": document.id,
                    "title": document.title,
                    "page_number": c.page_number,
                    "file_type": document.file_type,
                    "scope": meta.get("scope", "school"),
                    "owner_id": meta.get("owner_id") or "",
                    "category": meta.get("category", "syllabus"),
                    "metadata": c.metadata_json,
                }
                for c in batch
            ],
        )
    return total


async def _recover_from_r2(session: AsyncSession, document) -> dict:
    """Tài liệu không còn chunks trong DB nhưng có file gốc trên R2 → tải về, xử lý
    lại (lightweight) vào CHÍNH document đó (khớp theo storage_path, không tạo trùng)."""
    meta = document.metadata_json or {}
    r2_key = meta.get("r2_key")
    if not r2_key or not object_storage.is_enabled():
        return {"chunks": 0, "points": 0, "recovered": False}

    # ingest_document_file khớp tài liệu theo storage_path → tải file gốc về đúng path.
    from src.services.ingestion import ingest_document_file

    path = Path(document.storage_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not await object_storage.download_file(r2_key, path):
            return {"chunks": 0, "points": 0, "recovered": False}
        stats = await ingest_document_file(
            session,
            path,
            dataset_name="uploads",
            scope=meta.get("scope", "school"),
            owner_id=meta.get("owner_id"),
            subject=meta.get("subject"),
            category=meta.get("category", "syllabus"),
            r2_key=r2_key,
            force=True,
        )
        return {
            "chunks": stats.get("chunks", 0),
            "points": stats.get("points", 0),
            "recovered": stats.get("documents", 0) > 0,
        }
    finally:
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass


async def _recover_youtube(session: AsyncSession, document) -> dict:
    """Tài liệu YouTube không còn chunks → lấy lại transcript (kèm timestamp)."""
    meta = document.metadata_json or {}
    url = meta.get("url") or meta.get("video_url")
    from src.services import youtube

    if not url or not youtube.is_youtube_url(url):
        return {"chunks": 0, "points": 0, "recovered": False}
    try:
        result = await youtube.ingest_youtube_transcript(
            session,
            document,
            url,
            scope=meta.get("scope", "school"),
            owner_id=meta.get("owner_id"),
            category=meta.get("category", "syllabus"),
        )
        return {"chunks": result["chunks"], "points": result["points"], "recovered": True}
    except youtube.YoutubeTranscriptError:
        return {"chunks": 0, "points": 0, "recovered": False}


async def reindex_all(session: AsyncSession, *, recover_from_r2: bool = True) -> dict:
    documents = await document_repo.list_documents(session)
    stats = {
        "documents_total": len(documents),
        "reindexed_from_db": 0,
        "recovered_from_r2": 0,
        "recovered_youtube": 0,
        "chunks": 0,
        "points": 0,
        "skipped_no_content": 0,
        "errors": 0,
    }

    for document in documents:
        try:
            points = await _reembed_from_db(session, document)
            if points:
                stats["reindexed_from_db"] += 1
                stats["points"] += points
                continue
            # Tài liệu YouTube chưa có chunks → lấy transcript trực tiếp.
            meta = document.metadata_json or {}
            if meta.get("kind") == "youtube" or document.file_type == "youtube":
                yt = await _recover_youtube(session, document)
                if yt["recovered"]:
                    stats["recovered_youtube"] += 1
                    stats["chunks"] += yt["chunks"]
                    stats["points"] += yt["points"]
                    continue
            # Không có chunks trong DB → thử khôi phục từ R2 (file gốc).
            if recover_from_r2:
                rec = await _recover_from_r2(session, document)
                if rec["recovered"]:
                    stats["recovered_from_r2"] += 1
                    stats["chunks"] += rec["chunks"]
                    stats["points"] += rec["points"]
                    continue
            stats["skipped_no_content"] += 1
        except Exception:  # noqa: BLE001 — một tài liệu lỗi không làm hỏng cả mẻ
            stats["errors"] += 1

    # Dọn điểm Qdrant mồ côi (document không còn trong DB).
    valid_ids = set(await document_repo.list_document_ids(session))
    stats["deleted_orphan_points"] = await delete_orphan_points(valid_ids)
    return stats
