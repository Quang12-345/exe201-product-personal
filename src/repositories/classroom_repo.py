"""Repository truy vấn và quản lý Lớp học (Classrooms)."""

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Classroom, Document, Student, User


async def create_classroom(
    session: AsyncSession,
    *,
    name: str,
    code: str,
    subject: str,
    description: str | None = None,
    created_by: str | None = None,
) -> Classroom:
    classroom = Classroom(
        name=name.strip(),
        code=code.strip().upper(),
        subject=subject.strip(),
        description=description.strip() if description else None,
        created_by=created_by,
    )
    session.add(classroom)
    await session.flush()
    return classroom


async def get_classroom(session: AsyncSession, classroom_id: str) -> Classroom | None:
    result = await session.execute(select(Classroom).where(Classroom.id == classroom_id))
    return result.scalar_one_or_none()


async def get_classroom_by_code(session: AsyncSession, code: str) -> Classroom | None:
    result = await session.execute(
        select(Classroom).where(Classroom.code == code.strip().upper())
    )
    return result.scalar_one_or_none()


async def list_classrooms(
    session: AsyncSession, *, owner_id: str | None = None
) -> list[Classroom]:
    stmt = select(Classroom).order_by(Classroom.created_at.desc())
    if owner_id:
        stmt = stmt.where(Classroom.created_by == owner_id)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def update_classroom(
    session: AsyncSession,
    classroom: Classroom,
    *,
    name: str | None = None,
    code: str | None = None,
    subject: str | None = None,
    description: str | None = None,
) -> Classroom:
    if name is not None:
        classroom.name = name.strip()
    if code is not None:
        classroom.code = code.strip().upper()
    if subject is not None:
        classroom.subject = subject.strip()
    if description is not None:
        classroom.description = description.strip() if description else None
    await session.flush()
    return classroom


async def delete_classroom(session: AsyncSession, classroom: Classroom) -> None:
    # Xóa liên kết hoặc cascade các tài liệu/sinh viên của lớp
    await session.delete(classroom)
    await session.flush()


async def get_classroom_stats(session: AsyncSession, classroom_id: str) -> dict[str, int]:
    student_q = await session.execute(
        select(func.count(Student.id)).where(Student.classroom_id == classroom_id)
    )
    doc_q = await session.execute(
        select(func.count(Document.id)).where(Document.classroom_id == classroom_id)
    )
    return {
        "student_count": int(student_q.scalar_one() or 0),
        "document_count": int(doc_q.scalar_one() or 0),
    }


async def list_classroom_students(
    session: AsyncSession, classroom_id: str
) -> list[Student]:
    result = await session.execute(
        select(Student)
        .where(Student.classroom_id == classroom_id)
        .order_by(Student.student_code.asc())
    )
    return list(result.scalars().all())


async def add_student_to_classroom(
    session: AsyncSession,
    *,
    classroom_id: str,
    student_code: str,
    full_name: str,
    email: str | None = None,
    note: str | None = None,
    created_by: str | None = None,
) -> Student:
    # Kiểm tra xem mã sinh viên này đã có trong lớp chưa
    existing = await session.execute(
        select(Student).where(
            Student.classroom_id == classroom_id,
            Student.student_code == student_code.strip(),
        )
    )
    student = existing.scalar_one_or_none()
    if student is not None:
        student.full_name = full_name.strip()
        if email:
            student.email = email.strip()
        if note:
            student.note = note.strip()
        await session.flush()
        return student

    # Lấy thông tin môn học của lớp để gán cho sinh viên
    classroom = await get_classroom(session, classroom_id)
    subject = classroom.subject if classroom else "Chung"

    student = Student(
        classroom_id=classroom_id,
        student_code=student_code.strip(),
        full_name=full_name.strip(),
        email=email.strip() if email else None,
        subject=subject,
        note=note.strip() if note else None,
        created_by=created_by,
    )
    session.add(student)
    await session.flush()
    return student


async def remove_student_from_classroom(
    session: AsyncSession, classroom_id: str, student_id: str
) -> bool:
    result = await session.execute(
        delete(Student).where(
            Student.id == student_id,
            Student.classroom_id == classroom_id,
        )
    )
    await session.flush()
    return result.rowcount > 0


async def list_student_enrolled_classrooms(
    session: AsyncSession, user: User
) -> list[Classroom]:
    """Lấy danh sách các lớp học mà sinh viên đang tham gia."""
    user_email = (user.email or "").strip().lower()
    user_code = (user.username or "").strip()

    conditions = []
    if user_email:
        conditions.append(func.lower(Student.email) == user_email)
    if user_code:
        conditions.append(Student.student_code == user_code)
    conditions.append(Student.created_by == user.id)

    stmt = (
        select(Classroom)
        .join(Student, Student.classroom_id == Classroom.id)
        .where(or_(*conditions))
        .distinct()
        .order_by(Classroom.created_at.desc())
    )
    result = await session.execute(stmt)
    classrooms = list(result.scalars().all())

    # Nếu là demo student và chưa tham gia lớp nào, tự động enroll vào lớp demo Lập trình C
    if not classrooms and (user.username == "student" or user.email == "student@ai20k.vn"):
        c_class = await get_classroom_by_code(session, "C_PROG_01")
        if c_class:
            await add_student_to_classroom(
                session,
                classroom_id=c_class.id,
                student_code=user.username,
                full_name=user.full_name or "Sinh viên Demo",
                email=user.email,
                note="Tham gia lớp học mặc định",
                created_by=user.id,
            )
            classrooms = [c_class]

    return classrooms


async def join_classroom_by_code(
    session: AsyncSession, user: User, code: str
) -> Classroom | None:
    """Sinh viên tham gia lớp học bằng mã code."""
    classroom = await get_classroom_by_code(session, code)
    if classroom is None:
        return None

    # Thêm sinh viên vào lớp
    await add_student_to_classroom(
        session,
        classroom_id=classroom.id,
        student_code=user.username,
        full_name=user.full_name or user.username,
        email=user.email,
        note="Tham gia bằng mã lớp học",
        created_by=user.id,
    )
    return classroom


async def leave_classroom(
    session: AsyncSession, user: User, classroom_id: str
) -> bool:
    """Sinh viên tự rời khỏi lớp học."""
    user_email = (user.email or "").strip().lower()
    user_code = (user.username or "").strip()

    conditions = []
    if user_email:
        conditions.append(func.lower(Student.email) == user_email)
    if user_code:
        conditions.append(Student.student_code == user_code)
    conditions.append(Student.created_by == user.id)

    stmt = delete(Student).where(
        Student.classroom_id == classroom_id,
        or_(*conditions),
    )
    result = await session.execute(stmt)
    await session.flush()
    return result.rowcount > 0
