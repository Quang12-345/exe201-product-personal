"""Học vụ cho giảng viên & quản trị: quản lý sinh viên + lịch thi.

RBAC: giảng viên chỉ thấy/sửa/xóa bản ghi của chính mình (created_by=self);
quản trị thao tác trên tất cả. Lọc theo môn học qua tham số `subject`.
"""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.models.academic import (
    ExamCreate,
    ExamResponse,
    ExamUpdate,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
)
from src.repositories import exam_repo, student_repo


def _role_name(user: User) -> str | None:
    return user.role.name if getattr(user, "role", None) else None


def _owner_scope(user: User) -> str | None:
    """None nếu admin (không lọc theo chủ sở hữu); ngược lại là id giảng viên."""
    return None if _role_name(user) == "admin" else user.id


def _ensure_can_edit(user: User, record) -> None:
    if _role_name(user) != "admin" and record.created_by != user.id:
        raise HTTPException(status_code=403, detail="Không có quyền với bản ghi này.")


# ----- Students -----

def _student_response(s) -> StudentResponse:
    return StudentResponse(
        id=s.id,
        student_code=s.student_code,
        full_name=s.full_name,
        subject=s.subject,
        email=s.email,
        note=s.note,
        created_by=s.created_by,
        created_at=s.created_at,
    )


async def list_students_controller(
    session: AsyncSession, user: User, *, subject: str | None = None
) -> list[StudentResponse]:
    students = await student_repo.list_students(
        session, owner_id=_owner_scope(user), subject=subject
    )
    return [_student_response(s) for s in students]


async def create_student_controller(
    session: AsyncSession, user: User, payload: StudentCreate
) -> StudentResponse:
    student = await student_repo.create_student(
        session,
        student_code=payload.student_code.strip(),
        full_name=payload.full_name.strip(),
        subject=payload.subject.strip(),
        email=(payload.email or "").strip() or None,
        note=(payload.note or "").strip() or None,
        created_by=user.id,
    )
    await session.commit()
    return _student_response(student)


async def update_student_controller(
    session: AsyncSession, user: User, student_id: str, payload: StudentUpdate
) -> StudentResponse:
    student = await student_repo.get_student(session, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")
    _ensure_can_edit(user, student)
    values = payload.model_dump(exclude_unset=True)
    student = await student_repo.update_student(session, student, values)
    await session.commit()
    return _student_response(student)


async def delete_student_controller(
    session: AsyncSession, user: User, student_id: str
) -> dict:
    student = await student_repo.get_student(session, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")
    _ensure_can_edit(user, student)
    await student_repo.delete_student(session, student)
    await session.commit()
    return {"id": student_id, "deleted": True}


# ----- Exams -----

def _exam_response(e) -> ExamResponse:
    return ExamResponse(
        id=e.id,
        subject=e.subject,
        title=e.title,
        exam_date=e.exam_date,
        room=e.room,
        duration_minutes=int(e.duration_minutes or 0),
        note=e.note,
        created_by=e.created_by,
        created_at=e.created_at,
    )


async def list_exams_controller(
    session: AsyncSession, user: User, *, subject: str | None = None
) -> list[ExamResponse]:
    exams = await exam_repo.list_exams(session, owner_id=_owner_scope(user), subject=subject)
    return [_exam_response(e) for e in exams]


async def create_exam_controller(
    session: AsyncSession, user: User, payload: ExamCreate
) -> ExamResponse:
    exam = await exam_repo.create_exam(
        session,
        subject=payload.subject.strip(),
        title=payload.title.strip(),
        exam_date=payload.exam_date,
        room=(payload.room or "").strip() or None,
        duration_minutes=payload.duration_minutes,
        note=(payload.note or "").strip() or None,
        created_by=user.id,
    )
    await session.commit()
    return _exam_response(exam)


async def update_exam_controller(
    session: AsyncSession, user: User, exam_id: str, payload: ExamUpdate
) -> ExamResponse:
    exam = await exam_repo.get_exam(session, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch thi.")
    _ensure_can_edit(user, exam)
    values = payload.model_dump(exclude_unset=True)
    exam = await exam_repo.update_exam(session, exam, values)
    await session.commit()
    return _exam_response(exam)


async def delete_exam_controller(session: AsyncSession, user: User, exam_id: str) -> dict:
    exam = await exam_repo.get_exam(session, exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch thi.")
    _ensure_can_edit(user, exam)
    await exam_repo.delete_exam(session, exam)
    await session.commit()
    return {"id": exam_id, "deleted": True}
