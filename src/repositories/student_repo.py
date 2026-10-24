from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Student


async def list_students(
    session: AsyncSession,
    *,
    owner_id: str | None = None,
    subject: str | None = None,
) -> list[Student]:
    stmt = select(Student)
    if owner_id is not None:
        stmt = stmt.where(Student.created_by == owner_id)
    if subject:
        stmt = stmt.where(Student.subject == subject)
    stmt = stmt.order_by(Student.subject, Student.full_name)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_student(session: AsyncSession, student_id: str) -> Student | None:
    result = await session.execute(select(Student).where(Student.id == student_id))
    return result.scalar_one_or_none()


async def create_student(session: AsyncSession, **values) -> Student:
    student = Student(**values)
    session.add(student)
    await session.flush()
    return student


async def update_student(session: AsyncSession, student: Student, values: dict) -> Student:
    for key, value in values.items():
        setattr(student, key, value)
    await session.flush()
    return student


async def delete_student(session: AsyncSession, student: Student) -> None:
    await session.delete(student)
    await session.flush()
