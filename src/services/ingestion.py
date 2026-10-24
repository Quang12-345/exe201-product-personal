from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.session import init_db
from src.repositories import document_repo
from src.services.data_pipeline import (
    DEFAULT_DATASET_DIR,
    DEFAULT_PROCESSED_DIR,
    PIPELINE_VERSION,
    PLAIN_TEXT_EXTENSIONS,
    DatasetPipelineError,
    DatasetValidationError,
    DoclingRunner,
    EmptyDocumentTextError,
    ValidatedDocument,
    collect_dataset_documents,
    lightweight_convert,
    process_document_for_rag,
    validate_document_file,
)
from src.services.embeddings import embed_documents
from src.services.vector_store import (
    count_points_for_document,
    delete_orphan_points,
    delete_points,
    delete_points_for_document,
    upsert_chunks,
)

DATASET_DIR = DEFAULT_DATASET_DIR


async def ingest_rag_sample(session: AsyncSession, *, force: bool = False) -> dict:
    return await ingest_dataset(
        session,
        dataset_dir=DATASET_DIR,
        dataset_name="docs",
        force=force,
        cleanup_orphans=True,
    )


async def ingest_dataset(
    session: AsyncSession,
    *,
    dataset_dir: Path = DATASET_DIR,
    dataset_name: str = "docs",
    force: bool = False,
    cleanup_orphans: bool = False,
) -> dict:
    await init_db()
    document_files = collect_dataset_documents(Path(dataset_dir))
    stats = {
        "documents": 0,
        "chunks": 0,
        "points": 0,
        "failed_documents": 0,
        "skipped_documents": 0,
        "deleted_stale_documents": 0,
        "deleted_orphan_points": 0,
        "dataset_dir": str(dataset_dir),
    }
    seen_hashes: dict[str, Path] = {}
    for document_file in document_files:
        doc_stats = await ingest_document_file(
            session,
            document_file,
            dataset_name=dataset_name,
            seen_hashes=seen_hashes,
            force=force,
        )
        stats["documents"] += doc_stats["documents"]
        stats["chunks"] += doc_stats["chunks"]
        stats["points"] += doc_stats["points"]
        stats["failed_documents"] += doc_stats["failed_documents"]
        stats["skipped_documents"] += doc_stats.get("skipped_documents", 0)

    if cleanup_orphans:
        stats["deleted_stale_documents"] = await _cleanup_missing_documents(session)
        valid_ids = set(await document_repo.list_document_ids(session))
        stats["deleted_orphan_points"] = await delete_orphan_points(valid_ids)
    return stats


async def _cleanup_missing_documents(session: AsyncSession) -> int:
    """Remove DB documents (and their vectors) whose source file disappeared."""
    removed = 0
    for document in await document_repo.list_documents(session):
        if Path(document.storage_path).exists():
            continue
        await delete_points_for_document(document.id)
        await document_repo.delete_document(session, document)
        removed += 1
    if removed:
        await session.commit()
    return removed


async def ingest_document_file(
    session: AsyncSession,
    document_file: Path,
    *,
    dataset_name: str = "docs",
    processed_root: Path = DEFAULT_PROCESSED_DIR,
    seen_hashes: dict[str, Path] | None = None,
    docling_runner: DoclingRunner | None = None,
    force: bool = False,
    scope: str = "school",
    owner_id: str | None = None,
    subject: str | None = None,
    category: str = "syllabus",
    r2_key: str | None = None,
) -> dict:
    import os
    settings = get_settings()
    try:
        validation = validate_document_file(document_file, seen_hashes=seen_hashes)
    except DatasetValidationError:
        return {
            "documents": 0,
            "chunks": 0,
            "points": 0,
            "failed_documents": 1,
            "skipped_documents": 0,
        }

    if not force:
        existing = await document_repo.get_document_by_storage_path(session, str(document_file))
        if await _is_document_up_to_date(existing, validation.file_hash):
            return {
                "documents": 0,
                "chunks": 0,
                "points": 0,
                "failed_documents": 0,
                "skipped_documents": 1,
            }

    document = await document_repo.upsert_document(
        session,
        title=_title_from_file(document_file),
        file_path=document_file,
        metadata=_processing_metadata(
            validation=validation,
            dataset_name=dataset_name,
            processed_root=processed_root,
            scope=scope,
            owner_id=owner_id,
            subject=subject,
            category=category,
            r2_key=r2_key,
        ),
        uploaded_by=owner_id,
    )
    previous_chunk_count = int(getattr(document, "total_chunks", 0) or 0)
    document_id = document.id
    await session.commit()


    # Tự động phát hiện dung lượng RAM thấp của hệ thống
    is_low_ram = False
    try:
        if os.path.exists("/proc/meminfo"):
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        parts = line.split()
                        if len(parts) >= 2:
                            mem_total_kb = int(parts[1])
                            # RAM < 2.5 GB (~2.621.440 KB)
                            if mem_total_kb < 2621440:
                                is_low_ram = True
    except Exception:
        pass

    # Kiểm tra xem docling có thực sự được cài đặt không
    has_docling = False
    try:
        import docling  # noqa: F401
        has_docling = True
    except ImportError:
        has_docling = False

    # Chọn bộ chuyển đổi: docling hoặc trích xuất nhẹ.
    # Nếu chưa truyền runner: kiểm tra xem có docling không, RAM thấp hoặc cấu hình USE_DOCLING
    runner = docling_runner
    if runner is None:
        if not has_docling:
            runner = lightweight_convert
        elif is_low_ram:
            print(f"[warning] Phát hiện hệ thống RAM thấp ({mem_total_kb // 1024} MB). Tự động hạ cấp sang parser nhẹ cho {document_file.name} để tránh OOM.")
            runner = lightweight_convert
        elif (
            not settings.use_docling
            or document_file.suffix.lower() in PLAIN_TEXT_EXTENSIONS
        ):
            runner = lightweight_convert

    try:
        processed = process_document_for_rag(
            document_file,
            dataset_name=dataset_name,
            processed_root=processed_root,
            model_name=settings.embedding_model,
            validation=validation,
            docling_runner=runner,
        )
        if not processed.chunks:
            raise EmptyDocumentTextError("No chunks were produced from the cleaned markdown.")

        # Lấy lại document bằng session mới
        document = await document_repo.get_document(session, document_id)
        if document is None:
            raise DatasetPipelineError("Document record was deleted during processing.")

        await document_repo.update_document_metadata(
            session,
            document,
            {
                **processed.document_metadata,
                "scope": scope,
                "owner_id": owner_id,
                "subject": subject,
                "category": category,
                "r2_key": r2_key,
            },
        )
        chunk_dicts = [
            {
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "page_number": chunk.page_number,
                "token_count": chunk.token_count,
                "qdrant_point_id": str(uuid5(NAMESPACE_URL, f"{document.id}:{chunk.chunk_index}")),
                "metadata": {
                    **chunk.metadata,
                    "dataset": dataset_name,
                    "file_hash": validation.file_hash,
                    "pipeline_version": PIPELINE_VERSION,
                    "processed_dir": str(processed.processed_dir),
                },
            }
            for chunk in processed.chunks
        ]
        db_chunks = await document_repo.replace_document_chunks(
            session,
            document_id=document.id,
            chunks=chunk_dicts,
        )
        await session.commit()

        # Lưu lại thông tin cần thiết của chunks để chạy Embedding và Qdrant ngoài session
        chunks_info = [
            {
                "qdrant_point_id": chunk.qdrant_point_id,
                "id": chunk.id,
                "content": chunk.content,
                "page_number": chunk.page_number,
                "metadata_json": chunk.metadata_json,
            }
            for chunk in db_chunks
        ]
        doc_title = document.title
        doc_file_type = document.file_type

        vectors = await embed_documents([c["content"] for c in chunks_info])
        points = await upsert_chunks(
            vectors=vectors,
            chunks=[
                {
                    "qdrant_point_id": c["qdrant_point_id"],
                    "chunk_id": c["id"],
                    "document_id": document_id,
                    "title": doc_title,
                    "page_number": c["page_number"],
                    "file_type": doc_file_type,
                    "scope": scope,
                    "owner_id": owner_id or "",
                    "category": category,
                    "metadata": c["metadata_json"],
                }
                for c in chunks_info
            ],
        )
        if previous_chunk_count > len(chunks_info):
            stale_point_ids = [
                str(uuid5(NAMESPACE_URL, f"{document_id}:{chunk_index}"))
                for chunk_index in range(len(chunks_info), previous_chunk_count)
            ]
            await delete_points(stale_point_ids)

        # Lấy lại document để đánh dấu ready
        document = await document_repo.get_document(session, document_id)
        if document is None:
            raise DatasetPipelineError("Document record was deleted during vector ingestion.")

        await document_repo.mark_document_ready(
            session,
            document,
            total_pages=int(processed.document_metadata.get("page_count") or 0),
            total_chunks=len(chunks_info),
        )
        await session.commit()
        return {
            "documents": 1,
            "chunks": len(chunks_info),
            "points": points,
            "failed_documents": 0,
            "skipped_documents": 0,
        }
    except EmptyDocumentTextError as exc:
        try:
            document = await document_repo.get_document(session, document_id)
            if document is not None:
                await document_repo.mark_document_failed(
                    session,
                    document,
                    str(exc),
                    status="failed_empty_text",
                )
                await session.commit()
        except Exception:
            pass
        return {
            "documents": 0,
            "chunks": 0,
            "points": 0,
            "failed_documents": 1,
            "skipped_documents": 0,
        }
    except DatasetPipelineError as exc:
        try:
            document = await document_repo.get_document(session, document_id)
            if document is not None:
                await document_repo.mark_document_failed(session, document, str(exc))
                await session.commit()
        except Exception:
            pass
        return {
            "documents": 0,
            "chunks": 0,
            "points": 0,
            "failed_documents": 1,
            "skipped_documents": 0,
        }
    except Exception as exc:
        try:
            document = await document_repo.get_document(session, document_id)
            if document is not None:
                await document_repo.mark_document_failed(session, document, str(exc))
                await session.commit()
        except Exception:
            pass
        return {
            "documents": 0,
            "chunks": 0,
            "points": 0,
            "failed_documents": 1,
            "skipped_documents": 0,
        }


async def ingest_pdf_file(
    session: AsyncSession,
    pdf_file: Path,
    *,
    dataset_name: str = "docs",
    processed_root: Path = DEFAULT_PROCESSED_DIR,
    seen_hashes: dict[str, Path] | None = None,
    marker_runner: DoclingRunner | None = None,
    docling_runner: DoclingRunner | None = None,
) -> dict:
    return await ingest_document_file(
        session,
        pdf_file,
        dataset_name=dataset_name,
        processed_root=processed_root,
        seen_hashes=seen_hashes,
        docling_runner=docling_runner or marker_runner,
    )


async def _is_document_up_to_date(document, file_hash: str) -> bool:
    """A document can be skipped only when DB metadata matches the source file
    AND its vectors are actually present in Qdrant (self-healing re-ingest)."""
    if document is None or document.status != "ready":
        return False
    metadata = document.metadata_json or {}
    if metadata.get("file_hash") != file_hash:
        return False
    if metadata.get("pipeline_version") != PIPELINE_VERSION:
        return False
    total_chunks = int(document.total_chunks or 0)
    if total_chunks <= 0:
        return False
    try:
        point_count = await count_points_for_document(document.id)
    except Exception:
        return False
    return point_count >= total_chunks


def _title_from_file(file_path: Path) -> str:
    return file_path.stem.replace("-", " ").replace("_", " ").strip().title()


def _processing_metadata(
    *,
    validation: ValidatedDocument,
    dataset_name: str,
    processed_root: Path,
    scope: str = "school",
    owner_id: str | None = None,
    subject: str | None = None,
    category: str = "syllabus",
    r2_key: str | None = None,
) -> dict:
    return {
        "dataset": dataset_name,
        "source_path": str(validation.file_path),
        "file_type": validation.file_path.suffix.lstrip(".").lower(),
        "file_hash": validation.file_hash,
        "file_size_bytes": validation.file_size_bytes,
        "processed_dir": str(processed_root / validation.document_key),
        "parser": "docling",
        "pipeline_version": PIPELINE_VERSION,
        "language": "unknown",
        "page_count": 0,
        "section_count": 0,
        "scope": scope,
        "owner_id": owner_id,
        "subject": subject,
        "category": category,
        "r2_key": r2_key,
        "processing_status": "processing",
        "processing_error": "",
    }
