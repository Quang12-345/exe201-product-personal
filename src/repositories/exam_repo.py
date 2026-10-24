from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Exam


async def list_exams(
    session: AsyncSession,
    *,
    owner_id: str | None = None,
    subject: str | None = None,
) -> list[Exam]:
    stmt = select(Exam)
    if owner_id is not None:
        stmt = stmt.where(Exam.created_by == owner_id)
    if subject:
        stmt = stmt.where(Exam.subject == subject)
    stmt = stmt.order_by(Exam.exam_date.is_(None), Exam.exam_date)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_exam(session: AsyncSession, exam_id: str) -> Exam | None:
    result = await session.execute(select(Exam).where(Exam.id == exam_id))
    return result.scalar_one_or_none()


async def create_exam(session: AsyncSession, **values) -> Exam:
    exam = Exam(**values)
    session.add(exam)
    await session.flush()
    return exam


async def update_exam(session: AsyncSession, exam: Exam, values: dict) -> Exam:
    for key, value in values.items():
        setattr(exam, key, value)
    await session.flush()
    return exam


async def delete_exam(session: AsyncSession, exam: Exam) -> None:
    await session.delete(exam)
    await session.flush()
