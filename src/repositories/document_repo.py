from collections.abc import Iterable
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Document, DocumentChunk, DocumentView


async def get_document_by_storage_path(session: AsyncSession, storage_path: str) -> Document | None:
    result = await session.execute(select(Document).where(Document.storage_path == storage_path))
    return result.scalar_one_or_none()


async def upsert_document(
    session: AsyncSession,
    *,
    title: str,
    file_path: Path,
    metadata: dict,
    uploaded_by: str | None = None,
    classroom_id: str | None = None,
) -> Document:
    storage_path = str(file_path)
    document = await get_document_by_storage_path(session, storage_path)
    if document is None:
        document = Document(
            uploaded_by=uploaded_by,
            title=title,
            file_name=file_path.name,
            file_type=file_path.suffix.lstrip(".").lower() or "pdf",
            storage_path=storage_path,
            status="processing",
            metadata_json=metadata,
            classroom_id=classroom_id,
        )
        session.add(document)
        await session.flush()
        return document

    document.uploaded_by = uploaded_by
    document.title = title
    document.file_name = file_path.name
    document.file_type = file_path.suffix.lstrip(".").lower() or "pdf"
    document.status = "processing"
    # Hợp nhất metadata hiện tại với metadata mới để không mất thông tin lớp học
    merged_metadata = dict(document.metadata_json or {})
    merged_metadata.update(metadata)
    document.metadata_json = merged_metadata
    if classroom_id is not None:
        document.classroom_id = classroom_id
    await session.flush()
    return document


async def replace_document_chunks(
    session: AsyncSession,
    *,
    document_id: str,
    chunks: Iterable[dict],
) -> list[DocumentChunk]:
    await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
    db_chunks: list[DocumentChunk] = []
    for chunk in chunks:
        values = {
            "document_id": document_id,
            "chunk_index": chunk["chunk_index"],
            "content": chunk["content"],
            "page_number": chunk.get("page_number"),
            "token_count": chunk.get("token_count", 0),
            "metadata_json": chunk.get("metadata", {}),
        }
        if chunk.get("qdrant_point_id"):
            values["qdrant_point_id"] = chunk["qdrant_point_id"]
        db_chunk = DocumentChunk(**values)
        session.add(db_chunk)
        db_chunks.append(db_chunk)
    await session.flush()
    return db_chunks


async def mark_document_ready(
    session: AsyncSession,
    document: Document,
    *,
    total_pages: int,
    total_chunks: int,
) -> None:
    document.status = "ready"
    document.total_pages = total_pages
    document.total_chunks = total_chunks
    await session.flush()


async def update_document_metadata(
    session: AsyncSession,
    document: Document,
    metadata: dict,
) -> None:
    document.metadata_json = metadata
    await session.flush()


async def mark_document_failed(
    session: AsyncSession,
    document: Document,
    error: str,
    *,
    status: str = "failed",
) -> None:
    document.status = status
    document.metadata_json = {
        **(document.metadata_json or {}),
        "processing_status": status,
        "processing_error": error,
        "error": error,
    }
    await session.flush()


async def get_chunks_by_ids(session: AsyncSession, chunk_ids: list[str]) -> list[DocumentChunk]:
    if not chunk_ids:
        return []
    result = await session.execute(select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)))
    chunks = list(result.scalars().all())
    by_id = {chunk.id: chunk for chunk in chunks}
    return [by_id[chunk_id] for chunk_id in chunk_ids if chunk_id in by_id]


async def list_documents_by_ids(session: AsyncSession, document_ids: list[str]) -> list[Document]:
    if not document_ids:
        return []
    result = await session.execute(select(Document).where(Document.id.in_(document_ids)))
    return list(result.scalars().all())


async def get_neighbor_chunks(
    session: AsyncSession, pairs: list[tuple[str, int]]
) -> dict[tuple[str, int], DocumentChunk]:
    """Lấy các chunk theo cặp (document_id, chunk_index) — dùng mở rộng ngữ cảnh
    sang đoạn liền kề khi truy hồi."""
    if not pairs:
        return {}
    doc_ids = {doc_id for doc_id, _ in pairs}
    indexes = {idx for _, idx in pairs if idx >= 0}
    if not indexes:
        return {}
    result = await session.execute(
        select(DocumentChunk).where(
            DocumentChunk.document_id.in_(doc_ids),
            DocumentChunk.chunk_index.in_(indexes),
        )
    )
    wanted = set(pairs)
    return {
        (c.document_id, c.chunk_index): c
        for c in result.scalars().all()
        if (c.document_id, c.chunk_index) in wanted
    }


async def list_chunks_by_document(session: AsyncSession, document_id: str) -> list[DocumentChunk]:
    result = await session.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
    )
    return list(result.scalars().all())


async def list_document_ids(session: AsyncSession) -> list[str]:
    result = await session.execute(select(Document.id))
    return [str(document_id) for document_id in result.scalars().all()]


async def list_documents_by_status(session: AsyncSession, status: str) -> list[Document]:
    result = await session.execute(
        select(Document).where(Document.status == status).order_by(Document.created_at.asc())
    )
    return list(result.scalars().all())


async def list_documents(session: AsyncSession) -> list[Document]:
    result = await session.execute(
        select(Document)
        .options(selectinload(Document.classroom))
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def list_documents_by_classroom(
    session: AsyncSession, classroom_id: str
) -> list[Document]:
    result = await session.execute(
        select(Document)
        .options(selectinload(Document.classroom))
        .where(Document.classroom_id == classroom_id)
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def list_documents_by_owner(
    session: AsyncSession, owner_id: str, *, classroom_id: str | None = None
) -> list[Document]:
    stmt = (
        select(Document)
        .options(selectinload(Document.classroom))
        .where(Document.uploaded_by == owner_id)
    )
    if classroom_id is not None:
        stmt = stmt.where(Document.classroom_id == classroom_id)
    result = await session.execute(stmt.order_by(Document.created_at.desc()))
    return list(result.scalars().all())


async def get_document(session: AsyncSession, document_id: str) -> Document | None:
    result = await session.execute(
        select(Document)
        .options(selectinload(Document.classroom))
        .where(Document.id == document_id)
    )
    return result.scalar_one_or_none()



async def list_viewed_document_ids(session: AsyncSession, user_id: str) -> set[str]:
    result = await session.execute(
        select(DocumentView.document_id).where(DocumentView.user_id == user_id)
    )
    return {str(document_id) for document_id in result.scalars().all()}


async def mark_document_viewed(session: AsyncSession, *, document_id: str, user_id: str) -> DocumentView:
    result = await session.execute(
        select(DocumentView).where(
            DocumentView.document_id == document_id,
            DocumentView.user_id == user_id,
        )
    )
    view = result.scalar_one_or_none()
    if view is None:
        view = DocumentView(document_id=document_id, user_id=user_id)
        session.add(view)
    await session.flush()
    return view


async def delete_document(session: AsyncSession, document: Document) -> None:
    await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
    await session.delete(document)
    await session.flush()


async def count_documents(session: AsyncSession) -> int:
    result = await session.execute(select(func.count()).select_from(Document))
    return int(result.scalar_one())


async def count_chunks(session: AsyncSession) -> int:
    result = await session.execute(select(func.count()).select_from(DocumentChunk))
    return int(result.scalar_one())
