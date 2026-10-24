"""Controllers cho domain Lớp học (Classrooms) và cô lập tài liệu theo lớp."""

import re
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.models.classroom import (
    AddStudentToClassroomRequest,
    ClassroomCreate,
    ClassroomResponse,
    ClassroomUpdate,
    JoinClassroomRequest,
)
from src.models.dataset import DocumentResponse
from src.repositories import classroom_repo, document_repo, user_repo


def _role_name(user: User) -> str:
    role_obj = getattr(user, "__dict__", {}).get("role")
    if role_obj and hasattr(role_obj, "name"):
        return role_obj.name
    try:
        return user.role.name if user.role else "student"
    except Exception:
        return "student"


def _generate_classroom_code(name: str, subject: str) -> str:
    """Tự động sinh mã lớp học ngắn gọn và dễ nhớ nếu người dùng không nhập."""
    clean = re.sub(r"[^a-zA-Z0-9\s]", "", subject or name).upper()
    tokens = clean.split()
    prefix = "".join(t[:3] for t in tokens[:3]) if tokens else "CLASS"
    return f"{prefix}_{uuid4().hex[:4].upper()}"


async def _to_classroom_response(
    session: AsyncSession,
    classroom,
    *,
    lecturer_name: str | None = None,
    is_enrolled: bool | None = None,
) -> ClassroomResponse:
    stats = await classroom_repo.get_classroom_stats(session, classroom.id)
    return ClassroomResponse(
        id=classroom.id,
        name=classroom.name,
        code=classroom.code,
        subject=classroom.subject,
        description=classroom.description,
        created_by=classroom.created_by,
        created_at=classroom.created_at,
        updated_at=classroom.updated_at,
        student_count=stats["student_count"],
        document_count=stats["document_count"],
        lecturer_name=lecturer_name,
        is_enrolled=is_enrolled,
    )


async def list_classrooms_controller(
    session: AsyncSession, user: User
) -> list[ClassroomResponse]:
    role = _role_name(user)
    # Admin và Student thấy toàn bộ lớp học của tất cả giảng viên.
    # Giảng viên thấy các lớp do mình phụ trách/tạo.
    owner_id = user.id if role == "lecturer" else None
    classrooms = await classroom_repo.list_classrooms(session, owner_id=owner_id)

    # Nếu là student, xác định danh sách các lớp đã tham gia
    enrolled_ids = set()
    if role == "student":
        enrolled = await classroom_repo.list_student_enrolled_classrooms(session, user)
        enrolled_ids = {c.id for c in enrolled}

    # Tên giảng viên phụ trách (created_by)
    creator_ids = {c.created_by for c in classrooms if c.created_by}
    creators = {}
    if creator_ids:
        res = await session.execute(select(User).where(User.id.in_(creator_ids)))
        creators = {u.id: (u.full_name or u.username) for u in res.scalars().all()}

    responses = []
    for c in classrooms:
        lecturer_name = creators.get(c.created_by)
        is_enrolled = (c.id in enrolled_ids) if role == "student" else None
        responses.append(
            await _to_classroom_response(
                session, c, lecturer_name=lecturer_name, is_enrolled=is_enrolled
            )
        )
    return responses


async def create_classroom_controller(
    session: AsyncSession, user: User, payload: ClassroomCreate
) -> ClassroomResponse:
    code = (payload.code or "").strip().upper()
    if not code:
        code = _generate_classroom_code(payload.name, payload.subject)

    # Đảm bảo mã lớp là duy nhất
    existing = await classroom_repo.get_classroom_by_code(session, code)
    if existing is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Mã lớp học '{code}' đã tồn tại. Vui lòng chọn mã khác.",
        )

    classroom = await classroom_repo.create_classroom(
        session,
        name=payload.name,
        code=code,
        subject=payload.subject,
        description=payload.description,
        created_by=user.id,
    )
    await session.commit()
    return await _to_classroom_response(session, classroom)


async def get_classroom_controller(
    session: AsyncSession, user: User, classroom_id: str
) -> ClassroomResponse:
    classroom = await classroom_repo.get_classroom(session, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")
    return await _to_classroom_response(session, classroom)


async def update_classroom_controller(
    session: AsyncSession, user: User, classroom_id: str, payload: ClassroomUpdate
) -> ClassroomResponse:
    classroom = await classroom_repo.get_classroom(session, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")

    role = _role_name(user)
    if role != "admin" and classroom.created_by != user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa lớp học này.")

    if payload.code:
        code = payload.code.strip().upper()
        existing = await classroom_repo.get_classroom_by_code(session, code)
        if existing and existing.id != classroom.id:
            raise HTTPException(status_code=400, detail=f"Mã lớp '{code}' đã được dùng.")
        classroom.code = code

    await classroom_repo.update_classroom(
        session,
        classroom,
        name=payload.name,
        code=payload.code,
        subject=payload.subject,
        description=payload.description,
    )
    await session.commit()
    return await _to_classroom_response(session, classroom)


async def delete_classroom_controller(
    session: AsyncSession, user: User, classroom_id: str
) -> dict[str, str]:
    classroom = await classroom_repo.get_classroom(session, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")

    role = _role_name(user)
    if role != "admin" and classroom.created_by != user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa lớp học này.")

    await classroom_repo.delete_classroom(session, classroom)
    await session.commit()
    return {"status": "ok", "message": f"Đã xóa lớp học '{classroom.name}'."}


async def list_classroom_documents_controller(
    session: AsyncSession, user: User, classroom_id: str
) -> list[DocumentResponse]:
    """Lấy danh sách tài liệu CHỈ THUỘC LỚP HỌC NÀY.

    Đảm bảo tính cô lập tuyệt đối: không lẫn với tài liệu lớp khác hay tài liệu ngoài.
    """
    classroom = await classroom_repo.get_classroom(session, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")

    documents = await document_repo.list_documents_by_classroom(session, classroom_id)
    owners = {u.id: u.full_name for u in await user_repo.list_all(session)}
    viewed_ids = await document_repo.list_viewed_document_ids(session, user.id)

    res = []
    for doc in documents:
        meta = doc.metadata_json or {}
        res.append(
            DocumentResponse(
                id=doc.id,
                title=doc.title,
                file_name=doc.file_name,
                file_type=doc.file_type,
                scope=meta.get("scope") or "classroom",
                category=meta.get("category") or "syllabus",
                subject=meta.get("subject") or classroom.subject,
                description=meta.get("description"),
                kind=meta.get("kind") or "file",
                url=meta.get("url"),
                status=doc.status,
                total_pages=int(doc.total_pages or 0),
                total_chunks=int(doc.total_chunks or 0),
                uploaded_by=doc.uploaded_by,
                uploaded_by_name=owners.get(doc.uploaded_by),
                classroom_id=classroom.id,
                classroom_name=classroom.name,
                created_at=doc.created_at,
                is_new=doc.id not in viewed_ids,
            )
        )
    return res


async def list_classroom_students_controller(
    session: AsyncSession, user: User, classroom_id: str
):
    classroom = await classroom_repo.get_classroom(session, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")
    return await classroom_repo.list_classroom_students(session, classroom_id)


async def add_student_to_classroom_controller(
    session: AsyncSession,
    user: User,
    classroom_id: str,
    payload: AddStudentToClassroomRequest,
):
    classroom = await classroom_repo.get_classroom(session, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")

    student = await classroom_repo.add_student_to_classroom(
        session,
        classroom_id=classroom_id,
        student_code=payload.student_code,
        full_name=payload.full_name,
        email=payload.email,
        note=payload.note,
        created_by=user.id,
    )
    await session.commit()
    return student


async def remove_student_from_classroom_controller(
    session: AsyncSession, user: User, classroom_id: str, student_id: str
) -> dict[str, str]:
    classroom = await classroom_repo.get_classroom(session, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")

    removed = await classroom_repo.remove_student_from_classroom(
        session, classroom_id, student_id
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên trong lớp.")
    await session.commit()
    return {"status": "ok", "message": "Đã xóa sinh viên khỏi lớp học."}


async def list_enrolled_classrooms_controller(
    session: AsyncSession, user: User
) -> list[ClassroomResponse]:
    """Danh sách các lớp học mà sinh viên đang tham gia."""
    role = _role_name(user)
    if role in ("lecturer", "admin"):
        classrooms = await classroom_repo.list_classrooms(
            session, owner_id=user.id if role == "lecturer" else None
        )
    else:
        classrooms = await classroom_repo.list_student_enrolled_classrooms(session, user)

    creator_ids = {c.created_by for c in classrooms if c.created_by}
    creators = {}
    if creator_ids:
        res = await session.execute(select(User).where(User.id.in_(creator_ids)))
        creators = {u.id: (u.full_name or u.username) for u in res.scalars().all()}

    responses = []
    for c in classrooms:
        lecturer_name = creators.get(c.created_by)
        responses.append(
            await _to_classroom_response(
                session, c, lecturer_name=lecturer_name, is_enrolled=True
            )
        )
    return responses


async def join_classroom_controller(
    session: AsyncSession, user: User, payload: JoinClassroomRequest
) -> ClassroomResponse:
    """Sinh viên tham gia lớp học bằng mã code."""
    code = payload.code.strip()
    classroom = await classroom_repo.join_classroom_by_code(session, user, code)
    if classroom is None:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy lớp học với mã '{code}'. Vui lòng kiểm tra lại mã lớp do giảng viên cung cấp.",
        )
    await session.commit()
    return await _to_classroom_response(session, classroom)


async def leave_classroom_controller(
    session: AsyncSession, user: User, classroom_id: str
) -> dict[str, str]:
    """Sinh viên rời khỏi lớp học."""
    classroom = await classroom_repo.get_classroom(session, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học.")

    left = await classroom_repo.leave_classroom(session, user, classroom_id)
    if not left:
        raise HTTPException(status_code=400, detail="Bạn chưa tham gia lớp học này.")
    await session.commit()
    return {"status": "ok", "message": f"Đã rời khỏi lớp học '{classroom.name}'."}
