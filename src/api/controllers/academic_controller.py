"""Học vụ cho giảng viên & quản trị: quản lý sinh viên + lịch thi.

RBAC: giảng viên chỉ thấy/sửa/xóa bản ghi của chính mình (created_by=self);
quản trị thao tác trên tất cả. Lọc theo môn học qua tham số `subject`.
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Exam, User
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
        email=payload.email.strip() if payload.email else None,
        note=payload.note.strip() if payload.note else None,
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


async def delete_student_controller(session: AsyncSession, user: User, student_id: str) -> dict:
    student = await student_repo.get_student(session, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")
    _ensure_can_edit(user, student)
    await student_repo.delete_student(session, student)
    await session.commit()
    return {"id": student_id, "deleted": True}


# ----- Exams -----

def _exam_response(e: Exam) -> ExamResponse:
    doc_title = None
    doc_file_name = None
    if getattr(e, "document", None):
        doc_title = e.document.title or e.document.file_name
        doc_file_name = e.document.file_name

    quiz_title = None
    quiz_q_count = None
    if getattr(e, "quiz", None):
        quiz_title = e.quiz.title
        quiz_q_count = len(getattr(e.quiz, "questions", []))

    c_name = None
    c_code = None
    if getattr(e, "classroom", None):
        c_name = e.classroom.name
        c_code = e.classroom.code

    return ExamResponse(
        id=e.id,
        classroom_id=e.classroom_id,
        classroom_name=c_name,
        classroom_code=c_code,
        subject=e.subject,
        title=e.title,
        exam_date=e.exam_date,
        room=e.room,
        duration_minutes=int(e.duration_minutes or 0),
        note=e.note,
        created_by=e.created_by,
        created_at=e.created_at,
        document_id=e.document_id,
        document_title=doc_title,
        document_file_name=doc_file_name,
        quiz_id=e.quiz_id,
        quiz_title=quiz_title,
        quiz_question_count=quiz_q_count,
    )


async def list_exams_controller(
    session: AsyncSession,
    user: User,
    *,
    subject: str | None = None,
    classroom_id: str | None = None,
) -> list[ExamResponse]:
    role = _role_name(user)
    if role == "student":
        from src.repositories import classroom_repo

        enrolled = await classroom_repo.list_student_enrolled_classrooms(session, user)
        if not enrolled:
            return []

        enrolled_ids = [c.id for c in enrolled]
        enrolled_subjects = list({c.subject.strip() for c in enrolled if c.subject and c.subject.strip()})

        if classroom_id:
            # Sinh viên xem trong 1 lớp học cụ thể: chỉ xem nếu sinh viên đã tham gia lớp đó!
            if classroom_id not in enrolled_ids:
                raise HTTPException(status_code=403, detail="Bạn chưa tham gia lớp học này nên không thể xem lịch thi.")
            c_target = next(c for c in enrolled if c.id == classroom_id)
            exams = await exam_repo.list_exams_for_classroom(
                session, classroom_id=classroom_id, subject=c_target.subject
            )
        elif subject:
            # Lọc theo môn học: sinh viên phải đang tham gia lớp có môn học đó
            norm_subj = subject.strip().lower()
            matching_subs = [s for s in enrolled_subjects if s.lower() == norm_subj]
            if not matching_subs:
                return []
            exams = await exam_repo.list_exams_for_student(
                session, classroom_ids=enrolled_ids, subject=matching_subs[0]
            )
        else:
            # Tất cả lịch thi của các lớp học sinh viên đã tham gia
            exams = await exam_repo.list_exams_for_student(
                session, classroom_ids=enrolled_ids, subjects=enrolled_subjects
            )
    elif role == "admin":
        exams = await exam_repo.list_exams(session, subject=subject, classroom_id=classroom_id)
    else:
        # Giảng viên: xem lịch thi do mình tạo
        exams = await exam_repo.list_exams(
            session, owner_id=user.id, subject=subject, classroom_id=classroom_id
        )
    return [_exam_response(e) for e in exams]


async def create_exam_controller(
    session: AsyncSession, user: User, payload: ExamCreate
) -> ExamResponse:
    c_id = payload.classroom_id or None
    if not c_id and payload.subject:
        from src.repositories import classroom_repo
        c_list = await classroom_repo.list_classrooms(session, owner_id=_owner_scope(user))
        for c in c_list:
            if c.subject and c.subject.strip().lower() == payload.subject.strip().lower():
                c_id = c.id
                break

    exam = await exam_repo.create_exam(
        session,
        classroom_id=c_id,
        subject=payload.subject.strip(),
        title=payload.title.strip(),
        exam_date=payload.exam_date,
        room=(payload.room or "").strip() or None,
        duration_minutes=payload.duration_minutes,
        note=(payload.note or "").strip() or None,
        document_id=payload.document_id or None,
        quiz_id=payload.quiz_id or None,
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
    if "subject" in values and values["subject"]:
        values["subject"] = values["subject"].strip()
    if "title" in values and values["title"]:
        values["title"] = values["title"].strip()
    if "room" in values and values["room"]:
        values["room"] = values["room"].strip() or None
    if "note" in values and values["note"]:
        values["note"] = values["note"].strip() or None

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


async def get_exam_resources_controller(
    session: AsyncSession, user: User
) -> dict:
    """Lấy danh sách các tài liệu (đề thi) và bài Quiz trắc nghiệm sẵn có của giảng viên."""
    from src.db.models import Document, Quiz

    doc_stmt = (
        select(Document)
        .where(Document.status != "deleted")
        .order_by(Document.created_at.desc())
    )
    if _role_name(user) != "admin":
        doc_stmt = doc_stmt.where(Document.uploaded_by == user.id)
    doc_res = await session.execute(doc_stmt)
    docs = doc_res.scalars().all()

    quiz_stmt = (
        select(Quiz)
        .options(selectinload(Quiz.questions), selectinload(Quiz.document))
        .order_by(Quiz.created_at.desc())
    )
    if _role_name(user) != "admin":
        quiz_stmt = quiz_stmt.where(Quiz.user_id == user.id)
    quiz_res = await session.execute(quiz_stmt)
    quizzes = quiz_res.scalars().all()

    return {
        "documents": [
            {
                "id": d.id,
                "title": d.title or d.file_name,
                "file_name": d.file_name,
                "file_type": d.file_type,
                "subject": (d.metadata_json or {}).get("subject") if d.metadata_json else None,
            }
            for d in docs
        ],
        "quizzes": [
            {
                "id": q.id,
                "title": q.title,
                "question_count": len(q.questions),
                "document_id": q.document_id,
                "document_title": q.document.title if q.document else None,
            }
            for q in quizzes
        ],
    }
