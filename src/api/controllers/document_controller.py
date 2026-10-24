"""Quản lý tài liệu cho giảng viên & quản trị.

- Giảng viên/quản trị tải lên → tài liệu nhà trường (scope="school").
- Giảng viên chỉ thấy/xóa tài liệu của mình; quản trị thấy/xóa tất cả.
"""

import hashlib
import re
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.models import User
from src.db.session import AsyncSessionLocal
from src.models.dataset import (
    DeleteDocumentResponse,
    DocumentDownloadResponse,
    DocumentResponse,
    UpdateDocumentRequest,
    UploadDocumentResponse,
)
from src.repositories import classroom_repo, document_repo, user_repo
from src.services import object_storage
from src.services.data_pipeline import SUPPORTED_DOCUMENT_EXTENSIONS
from src.services.ingestion import ingest_document_file
from src.services.task_queue import enqueue_ingest
from src.services.vector_store import delete_points_for_document

UPLOAD_DIR = Path("datasets/uploads")
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB, khớp gợi ý trên giao diện.
MAX_VIDEO_BYTES = 500 * 1024 * 1024  # video cho phép lớn hơn (500MB).
# Phân loại tài liệu: "regulation" = quy định/quy chế trường; "syllabus" = giáo trình môn.
VALID_CATEGORIES = {"regulation", "syllabus"}
# Video: lưu + xem được nhưng KHÔNG trích xuất nội dung vào RAG (cần ASR riêng).
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".avi"}


def _role_name(user: User) -> str | None:
    return user.role.name if getattr(user, "role", None) else None


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(name).name).strip("_")
    return cleaned or "document"


def _scope_for_upload_role(role: str | None) -> str:
    return "school" if role in {"admin", "lecturer"} else "personal"


async def _find_owner_doc_by_hash(session: AsyncSession, owner_id: str, content_hash: str):
    """Tìm tài liệu CÙNG nội dung (theo sha256) mà người dùng này đã tải trước đó.

    Dùng để dedup: tải lại đúng 1 tệp sẽ GHI ĐÈ bản cũ thay vì tạo bản ghi trùng
    (mỗi lần upload sinh storage_path uuid khác nhau nên trước đây dễ bị nhân đôi).
    """
    for doc in await document_repo.list_documents_by_owner(session, owner_id):
        meta = doc.metadata_json or {}
        if content_hash in (meta.get("file_hash"), meta.get("content_hash")):
            return doc
    return None


def _to_response(document, owner_name: str | None = None, *, is_new: bool = False) -> DocumentResponse:
    metadata = document.metadata_json or {}
    cid = getattr(document, "classroom_id", None) or metadata.get("classroom_id")
    cname = metadata.get("classroom_name")
    if cid and not cname:
        classroom_obj = getattr(document, "__dict__", {}).get("classroom")
        if classroom_obj:
            cname = classroom_obj.name

    return DocumentResponse(
        id=document.id,
        title=document.title,
        file_name=document.file_name,
        file_type=document.file_type,
        scope=metadata.get("scope") or ("classroom" if cid else "school"),
        category=metadata.get("category") or "syllabus",
        subject=metadata.get("subject"),
        description=metadata.get("description"),
        kind=metadata.get("kind") or "file",
        url=metadata.get("url"),
        status=document.status,
        total_pages=int(document.total_pages or 0),
        total_chunks=int(document.total_chunks or 0),
        uploaded_by=document.uploaded_by,
        uploaded_by_name=owner_name,
        classroom_id=cid,
        classroom_name=cname,
        created_at=document.created_at,
        is_new=is_new,
    )


async def upload_document_controller(
    session: AsyncSession,
    user: User,
    *,
    file: UploadFile,
    subject: str | None = None,
    category: str | None = None,
    title: str | None = None,
    description: str | None = None,
    classroom_id: str | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> UploadDocumentResponse:
    classroom_name = None
    if classroom_id:
        from src.repositories import classroom_repo
        cls_obj = await classroom_repo.get_classroom(session, classroom_id)
        if cls_obj is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")
        classroom_name = cls_obj.name
        if not subject:
            subject = cls_obj.subject

    suffix = Path(file.filename or "").suffix.lower()
    is_video = suffix in VIDEO_EXTENSIONS
    if suffix not in SUPPORTED_DOCUMENT_EXTENSIONS and not is_video:
        allowed = ", ".join(sorted(SUPPORTED_DOCUMENT_EXTENSIONS | VIDEO_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng không hỗ trợ. Chỉ chấp nhận: {allowed}",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Tệp rỗng.")
    max_bytes = MAX_VIDEO_BYTES if is_video else MAX_UPLOAD_BYTES
    if len(content) > max_bytes:
        limit = "500MB" if is_video else "50MB"
        raise HTTPException(status_code=400, detail=f"Tệp vượt quá {limit}.")

    role = _role_name(user)
    scope = _scope_for_upload_role(role)
    # Phân loại: giảng viên luôn là giáo trình/tài liệu môn; admin tự chọn.
    doc_category = (category or "").strip().lower()
    if role != "admin":
        doc_category = "syllabus"
    elif doc_category not in VALID_CATEGORIES:
        doc_category = "regulation"

    content_hash = hashlib.sha256(content).hexdigest()
    # Dedup: nếu người dùng đã có tài liệu cùng nội dung → tái sử dụng bản ghi/đường dẫn
    # cũ (ghi đè) thay vì tạo bản trùng.
    existing_doc = (
        await _find_owner_doc_by_hash(session, user.id, content_hash)
        if session is not None
        else None
    )

    owner_dir = UPLOAD_DIR / user.id
    owner_dir.mkdir(parents=True, exist_ok=True)
    if (
        existing_doc is not None
        and Path(existing_doc.storage_path).suffix.lower() == suffix
    ):
        stored_path = Path(existing_doc.storage_path)
    else:
        existing_doc = None
        stored_path = owner_dir / f"{uuid4().hex[:8]}_{_safe_filename(file.filename or 'document')}"
    stored_path.write_bytes(content)

    # Đẩy bản gốc lên R2 (no-op nếu R2 tắt). Lưu key để truy xuất/xóa sau này.
    r2_key = f"documents/{user.id}/{stored_path.name}"
    try:
        uploaded_key = await object_storage.upload_file(stored_path, r2_key)
    except Exception:
        uploaded_key = None
    r2_key = uploaded_key  # None nếu R2 chưa bật

    # Video: không ingest vào RAG, chỉ lưu + đăng ký bản ghi để xem/phát.
    if is_video:
        document = await _register_media_document(
            session, stored_path, user, scope, doc_category, subject, r2_key,
            title=title, description=description, content_hash=content_hash,
            classroom_id=classroom_id, classroom_name=classroom_name,
        )
        return UploadDocumentResponse(
            document=_to_response(document, owner_name=getattr(user, "full_name", None)),
            chunks=0, points=0, failed=False, error=None,
        )

    job_payload = {
        "path": str(stored_path),
        "dataset_name": "uploads",
        "scope": scope,
        "owner_id": user.id,
        "subject": subject,
        "category": doc_category,
        "r2_key": r2_key,
        "classroom_id": classroom_id,
        "classroom_name": classroom_name,
    }

    # Chế độ bất đồng bộ: tạo bản ghi "queued" + đẩy job cho worker xử lý.
    if get_settings().ingest_async:
        job_id = await enqueue_ingest(job_payload)
        if job_id:
            document = await _register_queued_document(
                session, stored_path, user, scope, subject, doc_category, r2_key,
                title=title, description=description, content_hash=content_hash,
                classroom_id=classroom_id, classroom_name=classroom_name,
            )
            return UploadDocumentResponse(
                document=_to_response(document, owner_name=getattr(user, "full_name", None)),
                chunks=0,
                points=0,
                failed=False,
                error=None,
            )
        # Redis không sẵn sàng → tự động chuyển sang xử lý nền trong tiến trình.

    # Khi có BackgroundTasks: trả về NGAY với bản ghi "processing" rồi chạy ingest
    # (docling + embedding, vốn rất chậm) ở chế độ nền — tránh treo request đến mức
    # client timeout rồi báo "Lưu thất bại". Tài liệu sẽ tự chuyển sang "Đã lập chỉ mục".
    if background_tasks is not None:
        document = await _register_queued_document(
            session, stored_path, user, scope, subject, doc_category, r2_key,
            title=title, description=description, status="processing", content_hash=content_hash,
            classroom_id=classroom_id, classroom_name=classroom_name,
        )
        background_tasks.add_task(
            _run_background_ingest,
            stored_path=str(stored_path),
            scope=scope,
            owner_id=user.id,
            subject=subject,
            category=doc_category,
            r2_key=r2_key,
            title=title,
            description=description,
        )
        return UploadDocumentResponse(
            document=_to_response(document, owner_name=getattr(user, "full_name", None)),
            chunks=0, points=0, failed=False, error=None,
        )

    # Fallback (không có BackgroundTasks, ví dụ gọi trực tiếp trong test): xử lý inline.
    try:
        stats = await ingest_document_file(
            session,
            stored_path,
            dataset_name="uploads",
            scope=scope,
            owner_id=user.id,
            subject=subject,
            category=doc_category,
            r2_key=r2_key,
            force=True,
        )
    except Exception as exc:
        stored_path.unlink(missing_ok=True)
        if r2_key:
            await object_storage.delete_object(r2_key)
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý tài liệu: {exc}") from exc

    document = await document_repo.get_document_by_storage_path(session, str(stored_path))
    if document is None:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Không tạo được bản ghi tài liệu.")

    if classroom_id:
        document.classroom_id = classroom_id
        meta = dict(document.metadata_json or {})
        meta["classroom_id"] = classroom_id
        meta["classroom_name"] = classroom_name
        meta["scope"] = "classroom"
        document.metadata_json = meta

    if _apply_overrides(document, title, description):
        await session.commit()
    elif classroom_id:
        await session.commit()

    failed = stats.get("failed_documents", 0) > 0
    return UploadDocumentResponse(
        document=_to_response(document, owner_name=getattr(user, "full_name", None)),
        chunks=stats.get("chunks", 0),
        points=stats.get("points", 0),
        failed=failed,
        error=(document.metadata_json or {}).get("processing_error") if failed else None,
    )


async def _run_background_ingest(
    *,
    stored_path: str,
    scope: str,
    owner_id: str,
    subject: str | None,
    category: str,
    r2_key: str | None,
    title: str | None,
    description: str | None,
) -> None:
    """Chạy ingest (docling + embedding) ở nền với session DB riêng.

    Lỗi xử lý được `ingest_document_file` tự đánh dấu document = 'failed_*' nên giao
    diện sẽ hiển thị trạng thái "Lỗi" thay vì làm hỏng response upload.
    """
    path = Path(stored_path)
    async with AsyncSessionLocal() as session:
        try:
            await ingest_document_file(
                session,
                path,
                dataset_name="uploads",
                scope=scope,
                owner_id=owner_id,
                subject=subject,
                category=category,
                r2_key=r2_key,
                force=True,
            )
            document = await document_repo.get_document_by_storage_path(session, str(path))
            if document is not None and _apply_overrides(document, title, description):
                await session.commit()
        except Exception:
            # Không để background task ném ra ngoài; đánh dấu lỗi nếu có bản ghi.
            document = await document_repo.get_document_by_storage_path(session, str(path))
            if document is not None:
                await document_repo.mark_document_failed(session, document, "Lỗi xử lý nền")
                await session.commit()


async def suggest_metadata_controller(
    user: User,
    *,
    file: UploadFile | None = None,
    url: str | None = None,
) -> dict:
    """Gợi ý tiêu đề + mô tả cho tệp tải lên hoặc liên kết (AI auto-fill).

    Soft-fail: mọi lỗi trả về gợi ý rỗng để không chặn form tải lên.
    """
    import tempfile

    from src.services import metadata_suggester

    if file is not None and file.filename:
        # Lưu tệp ra file tạm để AI ĐỌC NỘI DUNG (không chỉ tên tệp) → gen tiêu đề + mô tả.
        data = await file.read()
        if not data:
            return await metadata_suggester.suggest_metadata_for_file(
                Path(file.filename), file.filename
            )
        suffix = Path(file.filename).suffix
        tmp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(data)
                tmp_path = Path(tmp.name)
            return await metadata_suggester.suggest_metadata_for_file(tmp_path, file.filename)
        finally:
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)

    clean_url = (url or "").strip()
    if re.match(r"^https?://", clean_url, re.IGNORECASE):
        return await metadata_suggester.suggest_metadata_for_link(clean_url)

    return {"title": "", "description": ""}


async def _register_queued_document(
    session: AsyncSession,
    stored_path: Path,
    user: User,
    scope: str,
    subject: str | None,
    category: str,
    r2_key: str | None,
    *,
    title: str | None = None,
    description: str | None = None,
    status: str = "queued",
    content_hash: str | None = None,
    classroom_id: str | None = None,
    classroom_name: str | None = None,
):
    """Tạo bản ghi tài liệu trạng thái 'queued'/'processing' để hiển thị ngay
    trước khi worker (hoặc background task) xử lý xong."""
    clean_title = (title or "").strip() or _title_from_filename(stored_path)
    metadata = {
        "scope": scope,
        "owner_id": user.id,
        "subject": subject,
        "category": category,
        "r2_key": r2_key,
        "processing_status": status,
        "content_hash": content_hash,
    }
    if classroom_id:
        metadata["classroom_id"] = classroom_id
    if classroom_name:
        metadata["classroom_name"] = classroom_name
    if (description or "").strip():
        metadata["description"] = description.strip()
    document = await document_repo.upsert_document(
        session,
        title=clean_title,
        file_path=stored_path,
        metadata=metadata,
        uploaded_by=user.id,
        classroom_id=classroom_id,
    )
    document.status = status
    await session.commit()
    return document


async def _register_media_document(
    session: AsyncSession,
    stored_path: Path,
    user: User,
    scope: str,
    category: str,
    subject: str | None,
    r2_key: str | None,
    *,
    title: str | None = None,
    description: str | None = None,
    content_hash: str | None = None,
    classroom_id: str | None = None,
    classroom_name: str | None = None,
):
    """Đăng ký 1 video: lưu file + bản ghi 'ready', kind='media'. Không ingest RAG."""
    metadata = {
        "scope": scope,
        "owner_id": user.id,
        "subject": subject,
        "category": category,
        "r2_key": r2_key,
        "kind": "media",
        "content_hash": content_hash,
    }
    if classroom_id:
        metadata["classroom_id"] = classroom_id
    if classroom_name:
        metadata["classroom_name"] = classroom_name
    if (description or "").strip():
        metadata["description"] = description.strip()
    document = await document_repo.upsert_document(
        session,
        title=(title or "").strip() or _title_from_filename(stored_path),
        file_path=stored_path,
        metadata=metadata,
        uploaded_by=user.id,
        classroom_id=classroom_id,
    )
    document.status = "ready"
    await session.commit()
    return document


def _apply_overrides(document, title: str | None, description: str | None) -> bool:
    """Ghi đè tiêu đề + mô tả do người dùng nhập (nếu có). Trả về True nếu có thay đổi."""
    changed = False
    clean_title = (title or "").strip()
    clean_desc = (description or "").strip()
    if clean_title and clean_title != document.title:
        document.title = clean_title
        changed = True
    if clean_desc:
        metadata = dict(document.metadata_json or {})
        metadata["description"] = clean_desc
        document.metadata_json = metadata
        changed = True
    return changed


async def register_link_document_controller(
    session: AsyncSession,
    user: User,
    *,
    url: str,
    title: str | None = None,
    description: str | None = None,
    category: str | None = None,
    subject: str | None = None,
) -> DocumentResponse:
    """Đăng ký 1 tài liệu dạng liên kết (URL). Lưu bản ghi để hiển thị/mở;
    chưa trích xuất nội dung vào RAG (cần web-fetcher riêng — việc về sau)."""
    clean_url = (url or "").strip()
    if not re.match(r"^https?://", clean_url, re.IGNORECASE):
        raise HTTPException(
            status_code=400,
            detail="Liên kết không hợp lệ. URL phải bắt đầu bằng http:// hoặc https://",
        )
    role = _role_name(user)
    scope = _scope_for_upload_role(role)
    doc_category = (category or "").strip().lower()
    if role != "admin":
        doc_category = "syllabus"
    elif doc_category not in VALID_CATEGORIES:
        doc_category = "regulation"
    clean_subject = (subject or "").strip() if doc_category == "syllabus" else None
    pseudo_path = UPLOAD_DIR / user.id / f"link_{uuid4().hex[:8]}.url"
    metadata = {
        "scope": scope,
        "owner_id": user.id,
        "category": doc_category,
        "subject": clean_subject,
        "kind": "link",
        "url": clean_url,
    }
    if (description or "").strip():
        metadata["description"] = description.strip()
    document = await document_repo.upsert_document(
        session,
        title=(title or "").strip() or clean_url,
        file_path=pseudo_path,
        metadata=metadata,
        uploaded_by=user.id,
    )
    document.file_type = "link"
    document.status = "ready"
    await session.commit()

    # Link YouTube: lấy transcript (kèm mốc thời gian) → nạp vào RAG để chatbot trả lời được.
    from src.services import youtube

    if youtube.is_youtube_url(clean_url):
        document.file_type = "youtube"
        metadata["kind"] = "youtube"
        metadata["video_id"] = youtube.extract_video_id(clean_url)
        await document_repo.update_document_metadata(session, document, metadata)
        try:
            await youtube.ingest_youtube_transcript(
                session,
                document,
                clean_url,
                scope=scope,
                owner_id=user.id,
                category=metadata["category"],
            )
        except Exception as exc:  # noqa: BLE001
            # Server không lấy được transcript (thường do YouTube chặn IP datacenter
            # của Render). KHÔNG xóa, KHÔNG báo lỗi — để TRẠNG THÁI CHỜ: máy có IP dân
            # dụng sẽ xử lý qua scripts/sync_pending_youtube.py (chế độ --watch tự động).
            await document_repo.mark_document_failed(
                session, document, str(exc), status="pending_transcript"
            )
            await session.commit()
        document = await document_repo.get_document(session, document.id)
    else:
        # Link web thường: đọc NỘI DUNG trang vào RAG (tiêu đề = h1, mô tả = AI) để
        # chatbot trả lời được + tab "Nội dung" hiển thị. Best-effort, không chặn nếu lỗi.
        from src.services import web_page

        try:
            await web_page.ingest_web_page(
                session,
                document,
                clean_url,
                scope=scope,
                owner_id=user.id,
                category=doc_category,
            )
            refreshed = await document_repo.get_document(session, document.id)
            if refreshed is not None:
                document = refreshed
        except Exception:  # noqa: BLE001 — lỗi tải/nạp trang → vẫn lưu link (ready)
            try:
                await session.rollback()
            except Exception:  # noqa: BLE001
                pass

    return _to_response(document, owner_name=getattr(user, "full_name", None))


def _title_from_filename(path: Path) -> str:
    # Bỏ tiền tố uuid8_ rồi chuẩn hóa thành tiêu đề.
    stem = path.stem
    if "_" in stem and len(stem.split("_", 1)[0]) == 8:
        stem = stem.split("_", 1)[1]
    return stem.replace("-", " ").replace("_", " ").strip().title() or "Document"


async def list_my_documents_controller(
    session: AsyncSession, user: User, *, classroom_id: str | None = None
) -> list[DocumentResponse]:
    if classroom_id:
        from src.api.controllers.classroom_controller import list_classroom_documents_controller
        return await list_classroom_documents_controller(session, user, classroom_id)

    if _role_name(user) == "admin":
        documents = await document_repo.list_documents(session)
        # Map id chủ sở hữu → tên hiển thị để admin biết tài liệu của ai.
        owners = {u.id: u.full_name for u in await user_repo.list_all(session)}
        return [_to_response(doc, owner_name=owners.get(doc.uploaded_by)) for doc in documents]

    documents = await document_repo.list_documents_by_owner(session, user.id)
    return [_to_response(doc, owner_name=getattr(user, "full_name", None)) for doc in documents]


async def list_available_documents_controller(
    session: AsyncSession, user: User, *, classroom_id: str | None = None
) -> list[DocumentResponse]:
    """Danh sách tài liệu hiển thị trong THƯ VIỆN của từng vai trò.

    3 kho đồng bộ trên cùng một nguồn (toàn bộ Document), khác nhau ở bộ lọc:
    - admin: tất cả (quản trị mọi tài liệu).
    - lecturer: tài liệu nhà trường (gồm cả quy định + giáo trình) + tài liệu của
      chính mình.
    - student: tài liệu nhà trường đã sẵn sàng, gồm cả giáo trình môn học và
      quy định/quy chế + tất cả tài liệu của các lớp học mà sinh viên đã tham gia.

    QUAN TRỌNG: Tài liệu thuộc lớp học riêng (classroom_id) được CÔ LẬP, chỉ hiển thị
    cho sinh viên đã tham gia lớp đó hoặc khi lọc chính xác theo classroom_id đó!
    """
    if classroom_id:
        from src.api.controllers.classroom_controller import list_classroom_documents_controller
        return await list_classroom_documents_controller(session, user, classroom_id)

    role = _role_name(user)
    documents = await document_repo.list_documents(session)
    owners = {u.id: u.full_name for u in await user_repo.list_all(session)}

    enrolled_classroom_ids: set[str] = set()
    if role == "student" and session is not None:
        try:
            enrolled_classrooms = await classroom_repo.list_student_enrolled_classrooms(session, user)
            enrolled_classroom_ids = {str(c.id) for c in enrolled_classrooms}
        except Exception:
            enrolled_classroom_ids = set()

    def visible(doc) -> bool:
        meta = doc.metadata_json or {}
        doc_classroom = getattr(doc, "classroom_id", None) or meta.get("classroom_id")
        scope = meta.get("scope", "school")
        if role == "admin":
            return True
        if role == "lecturer":
            # Giảng viên thấy tất cả tài liệu do mình tải lên (kể cả thuộc lớp của mình) + tài liệu chung trường
            if doc.uploaded_by == user.id:
                return True
            if doc_classroom or scope == "classroom":
                return False
            return scope == "school"
        # Sinh viên: thấy tài liệu do mình tải lên (nếu có), tài liệu của các lớp học đã tham gia, hoặc tài liệu chung trường (không thuộc lớp khác)
        if doc.uploaded_by == user.id and doc.status == "ready":
            return True
        if doc_classroom:
            return str(doc_classroom) in enrolled_classroom_ids and doc.status == "ready"
        if scope == "classroom":
            return False
        return scope == "school" and doc.status == "ready"

    visible_documents = [d for d in documents if visible(d)]
    viewed_ids = await document_repo.list_viewed_document_ids(session, user.id)
    return [
        _to_response(d, owner_name=owners.get(d.uploaded_by), is_new=d.id not in viewed_ids)
        for d in visible_documents
    ]


async def delete_document_controller(
    session: AsyncSession, user: User, document_id: str
) -> DeleteDocumentResponse:
    document = await document_repo.get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")

    # Giảng viên chỉ được xóa tài liệu của chính mình.
    if _role_name(user) != "admin" and document.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Không có quyền xóa tài liệu này.")

    await delete_points_for_document(document.id)
    storage_path = Path(document.storage_path)
    r2_key = (document.metadata_json or {}).get("r2_key")
    await document_repo.delete_document(session, document)
    await session.commit()

    # Xóa bản gốc trên R2 (no-op nếu R2 tắt hoặc không có key).
    if r2_key:
        try:
            await object_storage.delete_object(r2_key)
        except Exception:
            pass

    # Dọn file vật lý của tài liệu do người dùng tải lên.
    try:
        if UPLOAD_DIR in storage_path.parents and storage_path.exists():
            storage_path.unlink()
    except OSError:
        pass

    return DeleteDocumentResponse(id=document_id, deleted=True)


async def update_document_controller(
    session: AsyncSession,
    user: User,
    document_id: str,
    request: UpdateDocumentRequest,
) -> DocumentResponse:
    document = await document_repo.get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")

    if _role_name(user) != "admin" and document.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Không có quyền sửa tài liệu này.")

    updated_fields = request.model_fields_set
    if "title" in updated_fields and request.title is not None:
        document.title = request.title.strip()

    metadata = dict(document.metadata_json or {})
    if "category" in updated_fields and request.category is not None:
        category = request.category.strip().lower()
        if category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail="Phân loại tài liệu không hợp lệ.")
        metadata["category"] = category

    if "subject" in updated_fields:
        subject = (request.subject or "").strip()
        metadata["subject"] = subject or None

    document.metadata_json = metadata
    await session.commit()

    owner_name = getattr(user, "full_name", None)
    if document.uploaded_by and document.uploaded_by != user.id:
        owner = await user_repo.get_by_id(session, document.uploaded_by)
        owner_name = owner.full_name if owner else None
    return _to_response(document, owner_name=owner_name)


async def get_document_download_controller(
    session: AsyncSession, user: User, document_id: str
) -> DocumentDownloadResponse:
    """Trả URL tải xuống tạm thời (presigned) cho bản gốc lưu trên R2."""
    document = await document_repo.get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")

    await _authorize_view(session, user, document)

    r2_key = (document.metadata_json or {}).get("r2_key")
    if not r2_key:
        raise HTTPException(status_code=404, detail="Tài liệu chưa có bản gốc trên object store.")

    url = await object_storage.generate_presigned_url(r2_key, expires_in=3600)
    if not url:
        raise HTTPException(status_code=503, detail="Object store chưa sẵn sàng.")
    return DocumentDownloadResponse(url=url, expires_in=3600)


# ---- Xem tài liệu inline (đọc trong popup, không cần tải xuống) ----
_VIEW_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "mp4": "video/mp4",
    "webm": "video/webm",
    "mov": "video/quicktime",
    "mkv": "video/x-matroska",
    "avi": "video/x-msvideo",
}


async def _authorize_view(session: AsyncSession | None, user: User, document) -> None:
    """Admin xem tất cả; chủ sở hữu xem tài liệu của mình; tài liệu nhà trường
    (scope=school) thì mọi người dùng đã đăng nhập đều xem được; tài liệu thuộc lớp học
    thì sinh viên tham gia lớp đó xem được."""
    role = _role_name(user)
    if role == "admin" or document.uploaded_by == user.id:
        return

    meta = document.metadata_json or {}
    scope = meta.get("scope", "school")
    doc_classroom = getattr(document, "classroom_id", None) or meta.get("classroom_id")

    if doc_classroom:
        if role == "lecturer" and session is not None:
            cls_obj = await classroom_repo.get_classroom(session, str(doc_classroom))
            if cls_obj and cls_obj.created_by == user.id:
                return
        if role == "student" and session is not None:
            enrolled = await classroom_repo.list_student_enrolled_classrooms(session, user)
            if any(str(c.id) == str(doc_classroom) for c in enrolled):
                return
        raise HTTPException(status_code=403, detail="Không có quyền xem tài liệu này.")

    if scope == "school":
        return

    raise HTTPException(status_code=403, detail="Không có quyền xem tài liệu này.")


def _resolve_doc_file(document) -> Path:
    path = Path(document.storage_path)
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bản gốc trên máy chủ (có thể chỉ lưu trên object store).",
        )
    return path


async def mark_document_viewed_controller(session: AsyncSession, user: User, document_id: str) -> dict:
    document = await document_repo.get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")
    await _authorize_view(session, user, document)
    await document_repo.mark_document_viewed(session, document_id=document.id, user_id=user.id)
    await session.commit()
    return {"document_id": document.id, "viewed": True}


async def _ensure_local_file(document) -> Path:
    """Trả về đường dẫn file gốc; nếu bản local đã mất (deploy mới, container ephemeral)
    thì tự tải lại từ R2 bằng r2_key đã lưu — nhờ vậy tài liệu cũ vẫn xem được."""
    path = Path(document.storage_path)
    if path.is_file():
        return path
    r2_key = (document.metadata_json or {}).get("r2_key")
    if r2_key:
        data = await object_storage.download_bytes(r2_key)
        if data:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return path
    raise HTTPException(
        status_code=404,
        detail="Không tìm thấy bản gốc tài liệu (cả trên máy chủ lẫn object store).",
    )


async def view_document_controller(session: AsyncSession, user: User, document_id: str) -> FileResponse:
    document = await document_repo.get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")
    await _authorize_view(session, user, document)
    path = await _ensure_local_file(document)
    await document_repo.mark_document_viewed(session, document_id=document.id, user_id=user.id)
    await session.commit()
    media = _VIEW_MEDIA_TYPES.get(path.suffix.lower().lstrip("."), "application/octet-stream")
    return FileResponse(
        path,
        media_type=media,
        filename=document.file_name,
        content_disposition_type="inline",
    )


def _is_link_document(document) -> bool:
    metadata = document.metadata_json or {}
    kind = str(metadata.get("kind") or "").lower()
    file_type = str(document.file_type or "").lower()
    return kind in {"link", "youtube"} or file_type in {"link", "youtube"}


async def _extract_link_document_text(session: AsyncSession, document) -> dict:
    metadata = document.metadata_json or {}
    url = str(metadata.get("url") or "").strip()

    chunks = await document_repo.list_chunks_by_document(session, document.id)
    chunk_text = "\n\n".join(
        (chunk.content or "").strip()
        for chunk in chunks
        if (chunk.content or "").strip()
    )
    if chunk_text:
        return {
            "file_type": str(document.file_type or "link").lower(),
            "file_name": document.file_name,
            "url": url,
            "text": chunk_text,
        }

    if not url:
        raise HTTPException(status_code=404, detail="Tai lieu lien ket chua co URL.")

    from src.services import metadata_suggester

    page_title, body = await metadata_suggester.fetch_link_text(url)
    text = "\n\n".join(part for part in [page_title.strip(), body.strip()] if part).strip()
    if not text:
        fallback_parts = [
            str(document.title or "").strip(),
            str(metadata.get("description") or "").strip(),
            "Không thể trích xuất nội dung từ liên kết này. Bạn có thể mở liên kết gốc để xem nội dung.",
            f"Liên kết: {url}",
        ]
        text = "\n\n".join(part for part in fallback_parts if part)
    return {
        "file_type": str(document.file_type or "link").lower(),
        "file_name": document.file_name,
        "url": url,
        "text": text,
    }


async def view_document_text_controller(session: AsyncSession, user: User, document_id: str) -> dict:
    document = await document_repo.get_document(session, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")
    await _authorize_view(session, user, document)
    if _is_link_document(document):
        await document_repo.mark_document_viewed(session, document_id=document.id, user_id=user.id)
        await session.commit()
        return await _extract_link_document_text(session, document)

    path = await _ensure_local_file(document)
    await document_repo.mark_document_viewed(session, document_id=document.id, user_id=user.id)
    await session.commit()
    ext = path.suffix.lower()
    from src.services.data_pipeline import (
        _extract_docx_text,
        _extract_pdf_text,
        _extract_pptx_text,
    )
    try:
        if ext == ".pdf":
            text = _extract_pdf_text(path)
        elif ext == ".docx":
            text = _extract_docx_text(path)
        elif ext == ".pptx":
            text = _extract_pptx_text(path)
        else:
            text = ""
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"Không đọc được nội dung tài liệu: {exc}"
        ) from exc
    return {"file_type": ext.lstrip("."), "file_name": document.file_name, "text": text}
