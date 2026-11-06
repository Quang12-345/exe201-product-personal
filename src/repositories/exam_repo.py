from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Exam, Quiz


async def list_exams(
    session: AsyncSession,
    *,
    owner_id: str | None = None,
    subject: str | None = None,
    subjects: list[str] | None = None,
    classroom_id: str | None = None,
    classroom_ids: list[str] | None = None,
) -> list[Exam]:
    stmt = select(Exam).options(
        selectinload(Exam.document),
        selectinload(Exam.classroom),
        selectinload(Exam.quiz).selectinload(Quiz.questions),
    )
    if owner_id is not None:
        stmt = stmt.where(Exam.created_by == owner_id)
    if classroom_id:
        stmt = stmt.where(Exam.classroom_id == classroom_id)
    elif classroom_ids is not None:
        stmt = stmt.where(Exam.classroom_id.in_(classroom_ids))
    if subject:
        stmt = stmt.where(Exam.subject == subject)
    elif subjects is not None:
        stmt = stmt.where(Exam.subject.in_(subjects))
    stmt = stmt.order_by(Exam.exam_date.is_(None), Exam.exam_date)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def list_exams_for_student(
    session: AsyncSession,
    *,
    classroom_ids: list[str],
    subjects: list[str] | None = None,
    subject: str | None = None,
) -> list[Exam]:
    """Lấy danh sách các kỳ thi mà sinh viên được phép xem theo các lớp học đã tham gia."""
    stmt = select(Exam).options(
        selectinload(Exam.document),
        selectinload(Exam.classroom),
        selectinload(Exam.quiz).selectinload(Quiz.questions),
    )
    conditions = []
    if classroom_ids:
        conditions.append(Exam.classroom_id.in_(classroom_ids))
    if subjects:
        conditions.append(Exam.subject.in_(subjects))
    elif subject:
        conditions.append(Exam.subject == subject)

    if not conditions:
        return []

    stmt = stmt.where(or_(*conditions))
    if subject:
        stmt = stmt.where(Exam.subject == subject)

    stmt = stmt.order_by(Exam.exam_date.is_(None), Exam.exam_date)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def list_exams_for_classroom(
    session: AsyncSession,
    *,
    classroom_id: str,
    subject: str | None = None,
) -> list[Exam]:
    """Lấy danh sách các kỳ thi thuộc về một lớp học cụ thể."""
    stmt = select(Exam).options(
        selectinload(Exam.document),
        selectinload(Exam.classroom),
        selectinload(Exam.quiz).selectinload(Quiz.questions),
    )
    conditions = [Exam.classroom_id == classroom_id]
    if subject:
        conditions.append(Exam.subject == subject)
    stmt = stmt.where(or_(*conditions)).order_by(Exam.exam_date.is_(None), Exam.exam_date)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_exam(session: AsyncSession, exam_id: str) -> Exam | None:
    stmt = (
        select(Exam)
        .options(
            selectinload(Exam.document),
            selectinload(Exam.classroom),
            selectinload(Exam.quiz).selectinload(Quiz.questions),
        )
        .where(Exam.id == exam_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_exam(session: AsyncSession, **values) -> Exam:
    exam = Exam(**values)
    session.add(exam)
    await session.flush()
    # Eager load relationships on the created instance
    return await get_exam(session, exam.id) or exam


async def update_exam(session: AsyncSession, exam: Exam, values: dict) -> Exam:
    for key, value in values.items():
        setattr(exam, key, value)
    await session.flush()
    return await get_exam(session, exam.id) or exam


async def delete_exam(session: AsyncSession, exam: Exam) -> None:
    await session.delete(exam)
    await session.flush()
