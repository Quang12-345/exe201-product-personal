from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Classroom, Document, Flashcard, Quiz, QuizQuestion, User, UserQuizAttempt

# ---------------- Flashcard Operations ----------------


async def list_flashcards(
    session: AsyncSession, document_id: str, user_id: str | None = None
) -> list[Flashcard]:
    stmt = select(Flashcard).where(Flashcard.document_id == document_id)
    if user_id is not None:
        stmt = stmt.where((Flashcard.user_id == user_id) | (Flashcard.user_id.is_(None)))
    stmt = stmt.order_by(Flashcard.created_at.asc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_flashcard(session: AsyncSession, flashcard_id: str) -> Flashcard | None:
    result = await session.execute(
        select(Flashcard).where(Flashcard.id == flashcard_id)
    )
    return result.scalar_one_or_none()


async def create_flashcard(
    session: AsyncSession,
    *,
    document_id: str,
    front_text: str,
    back_text: str,
    user_id: str | None = None,
) -> Flashcard:
    flashcard = Flashcard(
        document_id=document_id,
        user_id=user_id,
        front_text=front_text.strip(),
        back_text=back_text.strip(),
    )
    session.add(flashcard)
    await session.flush()
    return flashcard


async def bulk_create_flashcards(
    session: AsyncSession,
    *,
    document_id: str,
    items: list[dict[str, str]],
    user_id: str | None = None,
) -> list[Flashcard]:
    created: list[Flashcard] = []
    for item in items:
        front = (item.get("front_text") or "").strip()
        back = (item.get("back_text") or "").strip()
        if front and back:
            fc = Flashcard(
                document_id=document_id,
                user_id=user_id,
                front_text=front,
                back_text=back,
            )
            session.add(fc)
            created.append(fc)
    await session.flush()
    return created


async def delete_flashcard(session: AsyncSession, flashcard: Flashcard) -> None:
    await session.delete(flashcard)
    await session.flush()


# ---------------- Quiz Operations ----------------


async def list_quizzes_by_document(
    session: AsyncSession, document_id: str, user_id: str | None = None
) -> list[tuple[Quiz, int]]:
    """Trả về danh sách Quiz kèm số lượng câu hỏi."""
    stmt = (
        select(Quiz, func.count(QuizQuestion.id).label("question_count"))
        .outerjoin(QuizQuestion, Quiz.id == QuizQuestion.quiz_id)
        .where(Quiz.document_id == document_id)
    )
    if user_id is not None:
        stmt = stmt.where((Quiz.user_id == user_id) | (Quiz.user_id.is_(None)))
    stmt = stmt.group_by(Quiz.id).order_by(Quiz.created_at.desc())
    result = await session.execute(stmt)
    return [(row[0], int(row[1])) for row in result.all()]


async def get_quiz(
    session: AsyncSession, quiz_id: str, load_questions: bool = True
) -> Quiz | None:
    stmt = select(Quiz).where(Quiz.id == quiz_id)
    if load_questions:
        stmt = stmt.options(selectinload(Quiz.questions))
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_quiz(
    session: AsyncSession,
    *,
    document_id: str,
    title: str,
    questions: list[dict[str, Any]],
    user_id: str | None = None,
) -> Quiz:
    quiz = Quiz(
        document_id=document_id,
        title=title.strip(),
        user_id=user_id,
    )
    session.add(quiz)
    await session.flush()

    for q in questions:
        question_text = (q.get("question_text") or "").strip()
        options = q.get("options") or []
        correct_answer = str(q.get("correct_answer") or "").strip()
        explanation = q.get("explanation")
        if question_text and options and correct_answer:
            question = QuizQuestion(
                quiz_id=quiz.id,
                question_text=question_text,
                options=options,
                correct_answer=correct_answer,
                explanation=explanation,
            )
            session.add(question)

    await session.flush()
    # Refresh to include questions in quiz relationship
    return await get_quiz(session, quiz.id, load_questions=True)  # type: ignore[return-value]


async def delete_quiz(session: AsyncSession, quiz: Quiz) -> None:
    await session.delete(quiz)
    await session.flush()


# ---------------- User Quiz Attempt Operations ----------------


async def create_quiz_attempt(
    session: AsyncSession,
    *,
    quiz_id: str,
    student_id: str,
    score: float,
    answers: dict[str, Any],
) -> UserQuizAttempt:
    attempt = UserQuizAttempt(
        quiz_id=quiz_id,
        student_id=student_id,
        score=score,
        answers=answers,
    )
    session.add(attempt)
    await session.flush()
    return attempt


async def list_attempts_by_quiz(
    session: AsyncSession, quiz_id: str
) -> list[UserQuizAttempt]:
    result = await session.execute(
        select(UserQuizAttempt)
        .where(UserQuizAttempt.quiz_id == quiz_id)
        .order_by(UserQuizAttempt.completed_at.desc())
    )
    return list(result.scalars().all())


async def list_attempts_by_student(
    session: AsyncSession, student_id: str
) -> list[UserQuizAttempt]:
    result = await session.execute(
        select(UserQuizAttempt)
        .where(UserQuizAttempt.student_id == student_id)
        .order_by(UserQuizAttempt.completed_at.desc())
    )
    return list(result.scalars().all())


async def list_recent_submissions(
    session: AsyncSession,
    *,
    user_id: str,
    role: str = "lecturer",
    limit: int = 10,
) -> list[dict[str, Any]]:
    qq_sub = (
        select(func.count(QuizQuestion.id))
        .where(QuizQuestion.quiz_id == Quiz.id)
        .scalar_subquery()
    )

    stmt = (
        select(
            UserQuizAttempt.id,
            UserQuizAttempt.score,
            UserQuizAttempt.completed_at,
            UserQuizAttempt.student_id,
            User.full_name.label("student_name"),
            User.email.label("student_email"),
            Quiz.id.label("quiz_id"),
            Quiz.title.label("quiz_title"),
            Classroom.id.label("classroom_id"),
            Classroom.name.label("classroom_name"),
            qq_sub.label("total_questions"),
        )
        .join(Quiz, UserQuizAttempt.quiz_id == Quiz.id)
        .join(Document, Quiz.document_id == Document.id)
        .outerjoin(Classroom, Document.classroom_id == Classroom.id)
        .join(User, UserQuizAttempt.student_id == User.id)
    )

    if role == "lecturer":
        stmt = stmt.where(
            or_(
                Classroom.created_by == user_id,
                Document.uploaded_by == user_id,
                Quiz.user_id == user_id,
                UserQuizAttempt.student_id == user_id,
            )
        )
    elif role == "student":
        stmt = stmt.where(UserQuizAttempt.student_id == user_id)

    stmt = stmt.order_by(UserQuizAttempt.completed_at.desc()).limit(limit)

    result = await session.execute(stmt)
    rows = result.all()

    items = []
    for r in rows:
        score_val = float(r.score)
        if score_val.is_integer():
            score_disp = f"{int(score_val)}/10"
        else:
            score_disp = f"{score_val:.1f}/10"

        items.append(
            {
                "id": str(r.id),
                "student_id": str(r.student_id),
                "student_name": r.student_name or r.student_email or "Sinh viên",
                "student_email": r.student_email or "",
                "quiz_id": str(r.quiz_id),
                "quiz_title": r.quiz_title or "Bài kiểm tra",
                "score": score_val,
                "total_questions": int(r.total_questions or 0),
                "score_display": score_disp,
                "completed_at": r.completed_at,
                "classroom_id": str(r.classroom_id) if r.classroom_id else None,
                "classroom_name": r.classroom_name,
            }
        )
    return items

