from __future__ import annotations

from datetime import UTC
from typing import Any

from fastapi import HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.models.study_aid import (
    CustomQuizCreate,
    FlashcardCreate,
    FlashcardItem,
    GenerateFlashcardsRequest,
    GenerateQuizRequest,
    QuizItem,
    QuizQuestionItem,
    QuizSubmitRequest,
    QuizSubmitResponse,
    QuizSummary,
    RecentSubmissionItem,
    UserQuizAttemptItem,
    LearningEvaluationResponse,
)
from src.repositories import study_aid_repo
from src.services import study_aid as study_aid_service


def _to_utc(dt):
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _role_name(user: User | None) -> str | None:
    if not user:
        return None
    return user.role.name if getattr(user, "role", None) else None


async def require_pro_student(session: AsyncSession, user: User | None) -> None:
    """Xác thực quyền sử dụng tính năng Flashcard & Quiz.

    - Admin & Giảng viên: luôn được phép sử dụng.
    - Sinh viên: bắt buộc phải có gói Pro đang hoạt động.
    """
    if not user:
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập để tiếp tục.")
    role = _role_name(user)
    if role in ("admin", "lecturer"):
        return
    if role == "student":
        from src.services.billing import _active_subscription

        subscription = await _active_subscription(session, user.id)
        if subscription is None:
            raise HTTPException(
                status_code=403,
                detail="Tính năng Flashcard & Quiz chỉ dành cho tài khoản Pro. Vui lòng nâng cấp gói để sử dụng.",
            )


# ---------------- Flashcard Controllers ----------------


async def list_document_flashcards_controller(
    session: AsyncSession, document_id: str, user: User | None = None
) -> list[FlashcardItem]:
    role = _role_name(user)
    if role == "student":
        from src.services.billing import _active_subscription

        subscription = await _active_subscription(session, user.id)
        if subscription is None:
            return []
    user_id = user.id if user and role == "student" else None
    cards = await study_aid_repo.list_flashcards(session, document_id, user_id=user_id)
    return [
        FlashcardItem(
            id=c.id,
            document_id=c.document_id,
            front_text=c.front_text,
            back_text=c.back_text,
            created_at=_to_utc(c.created_at),
        )
        for c in cards
    ]


async def create_flashcard_controller(
    session: AsyncSession,
    document_id: str,
    payload: FlashcardCreate,
    user: User | None = None,
) -> FlashcardItem:
    await require_pro_student(session, user)
    card = await study_aid_repo.create_flashcard(
        session,
        document_id=document_id,
        user_id=user.id if user else None,
        front_text=payload.front_text,
        back_text=payload.back_text,
    )
    await session.commit()
    return FlashcardItem(
        id=card.id,
        document_id=card.document_id,
        front_text=card.front_text,
        back_text=card.back_text,
        created_at=_to_utc(card.created_at),
    )


async def generate_flashcards_controller(
    session: AsyncSession,
    document_id: str,
    payload: GenerateFlashcardsRequest,
    user: User | None = None,
) -> list[FlashcardItem]:
    await require_pro_student(session, user)
    request_id = None
    if user:
        from uuid import uuid4

        from src.services.billing import reserve_chat_use

        request_id = str(uuid4())
        await reserve_chat_use(
            session,
            user_id=user.id,
            user_role=_role_name(user),
            request_id=request_id,
        )

    cards = await study_aid_service.generate_flashcards(
        session,
        document_id=document_id,
        count=payload.count,
        user_id=user.id if user else None,
    )

    if user and request_id:
        try:
            from src.services.billing import record_token_usage
            from src.services.llm import count_text_tokens

            output_tokens = sum(
                count_text_tokens(c.front_text) + count_text_tokens(c.back_text)
                for c in cards
            )
            # Ước tính ngữ cảnh tài liệu (~2000 tokens) + output
            total_tokens = 2000 + output_tokens
            await record_token_usage(
                session,
                user_id=user.id,
                tokens=total_tokens,
                request_id=request_id,
            )
        except Exception:
            pass

    await session.commit()
    return [
        FlashcardItem(
            id=c.id,
            document_id=c.document_id,
            front_text=c.front_text,
            back_text=c.back_text,
            created_at=_to_utc(c.created_at),
        )
        for c in cards
    ]


async def delete_flashcard_controller(
    session: AsyncSession, flashcard_id: str, user: User | None = None
) -> dict[str, str]:
    card = await study_aid_repo.get_flashcard(session, flashcard_id)
    if not card:
        raise HTTPException(status_code=404, detail="Không tìm thấy flashcard.")
    if user and _role_name(user) == "student" and card.user_id and card.user_id != user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa thẻ flashcard này.")
    await study_aid_repo.delete_flashcard(session, card)
    await session.commit()
    return {"status": "ok", "message": "Đã xóa flashcard thành công."}


# ---------------- Quiz Controllers ----------------


async def list_document_quizzes_controller(
    session: AsyncSession, document_id: str, user: User | None = None
) -> list[QuizSummary]:
    role = _role_name(user)
    if role == "student":
        from src.services.billing import _active_subscription

        subscription = await _active_subscription(session, user.id)
        if subscription is None:
            return []
    user_id = user.id if user and role == "student" else None
    quizzes = await study_aid_repo.list_quizzes_by_document(session, document_id, user_id=user_id)
    return [
        QuizSummary(
            id=q.id,
            document_id=q.document_id,
            title=q.title,
            created_at=_to_utc(q.created_at),
            question_count=q_count,
        )
        for q, q_count in quizzes
    ]


async def _is_exam_quiz(session: AsyncSession, quiz_id: str) -> bool:
    try:
        from sqlalchemy import select

        from src.db.models import Exam
        res = await session.execute(select(Exam.id).where(Exam.quiz_id == quiz_id))
        return res.scalars().first() is not None
    except Exception:
        return False


async def _ensure_student_can_take_quiz(session: AsyncSession, user: User, quiz_id: str) -> None:
    role = _role_name(user)
    if role != "student":
        return

    from src.db.models import Exam
    from src.repositories import classroom_repo

    exam_res = await session.execute(select(Exam).where(Exam.quiz_id == quiz_id))
    exam = exam_res.scalars().first()
    if not exam:
        return

    enrolled = await classroom_repo.list_student_enrolled_classrooms(session, user)
    enrolled_ids = {c.id for c in enrolled}
    enrolled_subjects = {c.subject.strip().lower() for c in enrolled if c.subject}

    allowed = False
    if exam.classroom_id and exam.classroom_id in enrolled_ids:
        allowed = True
    elif exam.subject and exam.subject.strip().lower() in enrolled_subjects:
        allowed = True

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Bạn chưa tham gia lớp học của môn này nên không có quyền làm bài thi.",
        )


async def get_quiz_controller(
    session: AsyncSession,
    user: User,
    quiz_id: str,
    include_answers: bool = False,
) -> QuizItem:
    await _ensure_student_can_take_quiz(session, user, quiz_id)
    if not await _is_exam_quiz(session, quiz_id):
        await require_pro_student(session, user)
    quiz = await study_aid_repo.get_quiz(session, quiz_id, load_questions=True)
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài Quiz.")

    role = _role_name(user)
    is_staff = role in ("admin", "lecturer")

    show_answers = False
    if is_staff:
        show_answers = True
    elif include_answers:
        latest_attempt = await study_aid_repo.get_latest_attempt(
            session, quiz_id=quiz.id, student_id=user.id
        )
        show_answers = latest_attempt is not None

    return QuizItem(
        id=quiz.id,
        document_id=quiz.document_id,
        title=quiz.title,
        created_at=_to_utc(quiz.created_at),
        questions=[
            QuizQuestionItem(
                id=q.id,
                quiz_id=q.quiz_id,
                question_text=q.question_text,
                options=q.options if isinstance(q.options, list) else list(q.options),
                correct_answer=q.correct_answer if show_answers else None,
                explanation=q.explanation if show_answers else None,
            )
            for q in quiz.questions
        ],
    )


async def generate_quiz_controller(
    session: AsyncSession,
    document_id: str,
    payload: GenerateQuizRequest,
    user: User | None = None,
) -> QuizItem:
    await require_pro_student(session, user)
    request_id = None
    if user:
        from uuid import uuid4

        from src.services.billing import reserve_chat_use

        request_id = str(uuid4())
        await reserve_chat_use(
            session,
            user_id=user.id,
            user_role=_role_name(user),
            request_id=request_id,
        )

    quiz = await study_aid_service.generate_quiz(
        session,
        document_id=document_id,
        title=payload.title,
        num_questions=payload.num_questions,
        user_id=user.id if user else None,
    )

    if user and request_id:
        try:
            from src.services.billing import record_token_usage
            from src.services.llm import count_text_tokens

            output_tokens = sum(
                count_text_tokens(q.question_text)
                + sum(count_text_tokens(opt) for opt in (q.options or []))
                + count_text_tokens(q.explanation or "")
                for q in quiz.questions
            )
            # Ngữ cảnh tài liệu (~2000 tokens) + output
            total_tokens = 2000 + output_tokens
            await record_token_usage(
                session,
                user_id=user.id,
                tokens=total_tokens,
                request_id=request_id,
            )
        except Exception:
            pass

    await session.commit()
    return QuizItem(
        id=quiz.id,
        document_id=quiz.document_id,
        title=quiz.title,
        created_at=_to_utc(quiz.created_at),
        questions=[
            QuizQuestionItem(
                id=q.id,
                quiz_id=q.quiz_id,
                question_text=q.question_text,
                options=q.options if isinstance(q.options, list) else list(q.options),
                correct_answer=q.correct_answer,
                explanation=q.explanation,
            )
            for q in quiz.questions
        ],
    )


async def delete_quiz_controller(
    session: AsyncSession, quiz_id: str, user: User | None = None
) -> dict[str, str]:
    quiz = await study_aid_repo.get_quiz(session, quiz_id, load_questions=False)
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài Quiz.")
    if user and _role_name(user) == "student" and quiz.user_id and quiz.user_id != user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bài Quiz này.")
    await study_aid_repo.delete_quiz(session, quiz)
    await session.commit()
    return {"status": "ok", "message": "Đã xóa bài Quiz thành công."}


async def submit_quiz_controller(
    session: AsyncSession,
    user: User,
    quiz_id: str,
    payload: QuizSubmitRequest,
) -> QuizSubmitResponse:
    await _ensure_student_can_take_quiz(session, user, quiz_id)
    if not await _is_exam_quiz(session, quiz_id):
        await require_pro_student(session, user)
    result = await study_aid_service.evaluate_quiz_submission(
        session,
        quiz_id=quiz_id,
        student_id=user.id,
        answers=payload.answers,
    )
    await session.commit()
    if "completed_at" in result:
        result["completed_at"] = _to_utc(result["completed_at"])
    return QuizSubmitResponse(**result)


async def list_quiz_attempts_controller(
    session: AsyncSession, quiz_id: str
) -> list[UserQuizAttemptItem]:
    attempts = await study_aid_repo.list_attempts_by_quiz(session, quiz_id)
    return [
        UserQuizAttemptItem(
            id=att.id,
            quiz_id=att.quiz_id,
            student_id=att.student_id,
            score=att.score,
            completed_at=_to_utc(att.completed_at),
            answers=att.answers,
        )
        for att in attempts
    ]


async def list_my_attempts_controller(
    session: AsyncSession, user: User
) -> list[UserQuizAttemptItem]:
    attempts = await study_aid_repo.list_attempts_by_student(session, user.id)
    result = []
    for att in attempts:
        total_q = len(att.quiz.questions) if att.quiz and att.quiz.questions else 0
        correct_c = round((att.score / 10.0) * total_q) if total_q > 0 else 0
        result.append(
            UserQuizAttemptItem(
                id=att.id,
                quiz_id=att.quiz_id,
                student_id=att.student_id,
                score=att.score,
                completed_at=_to_utc(att.completed_at),
                answers=att.answers,
                quiz_title=att.quiz.title if att.quiz else "Đề thi",
                total_questions=total_q,
                correct_count=correct_c,
            )
        )
    return result


async def get_attempt_review_controller(
    session: AsyncSession,
    user: User,
    attempt_id: str,
) -> QuizSubmitResponse:
    role = _role_name(user) or "student"
    result = await study_aid_service.get_attempt_review(
        session,
        attempt_id=attempt_id,
        user_id=user.id,
        role=role,
    )
    if "completed_at" in result:
        result["completed_at"] = _to_utc(result["completed_at"])
    return QuizSubmitResponse(**result)


async def list_recent_submissions_controller(
    session: AsyncSession,
    user: User,
    limit: int = 10,
) -> list[RecentSubmissionItem]:
    role = _role_name(user) or "student"
    items = await study_aid_repo.list_recent_submissions(
        session,
        user_id=user.id,
        role=role,
        limit=limit,
    )
    return [
        RecentSubmissionItem(
            id=item["id"],
            student_id=item["student_id"],
            student_name=item["student_name"],
            student_email=item["student_email"],
            quiz_id=item["quiz_id"],
            quiz_title=item["quiz_title"],
            score=item["score"],
            total_questions=item["total_questions"],
            score_display=item["score_display"],
            completed_at=_to_utc(item["completed_at"]),
            classroom_id=item["classroom_id"],
            classroom_name=item["classroom_name"],
        )
        for item in items
    ]



# ---------------- DOCX Quiz Import & Template Controllers ----------------


async def download_sample_quiz_template_controller() -> Response:
    from src.services.docx_quiz_parser import generate_sample_docx_template

    buf = generate_sample_docx_template()
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": "attachment; filename=De_thi_trac_nghiem_mau.docx",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


async def parse_docx_quiz_controller(file: UploadFile) -> dict[str, Any]:
    import io

    from src.services.docx_quiz_parser import parse_docx_quiz

    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400,
            detail="Vui lòng tải lên file định dạng Word (.docx).",
        )

    content = await file.read()
    buf = io.BytesIO(content)
    try:
        parsed = parse_docx_quiz(buf, default_title=file.filename.rsplit(".", 1)[0])
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể đọc file Word: {exc}",
        )

    if parsed["total"] == 0:
        raise HTTPException(
            status_code=400,
            detail="Không bóc tách được câu hỏi nào từ file. Vui lòng kiểm tra lại cấu trúc file theo mẫu chuẩn (ví dụ: 'Câu 1:', 'A.', 'B.',...).",
        )

    return parsed


async def import_docx_quiz_controller(
    session: AsyncSession,
    user: User,
    file: UploadFile,
    title: str | None = None,
) -> QuizItem:
    import io

    from src.services.docx_quiz_parser import parse_docx_quiz

    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400,
            detail="Vui lòng tải lên file định dạng Word (.docx).",
        )

    content = await file.read()
    buf = io.BytesIO(content)
    try:
        parsed = parse_docx_quiz(buf, default_title=file.filename.rsplit(".", 1)[0])
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể đọc file Word: {exc}",
        )

    if parsed["total"] == 0:
        raise HTTPException(
            status_code=400,
            detail="Không bóc tách được câu hỏi nào từ file. Vui lòng kiểm tra lại cấu trúc file theo mẫu chuẩn.",
        )

    quiz_title = (title or parsed["title"] or file.filename.rsplit(".", 1)[0]).strip()
    quiz = await study_aid_repo.create_quiz(
        session,
        document_id=None,
        title=quiz_title,
        questions=parsed["questions"],
        user_id=user.id,
    )
    await session.commit()

    return QuizItem(
        id=quiz.id,
        document_id=quiz.document_id,
        title=quiz.title,
        created_at=_to_utc(quiz.created_at),
        questions=[
            QuizQuestionItem(
                id=q.id,
                quiz_id=q.quiz_id,
                question_text=q.question_text,
                options=q.options if isinstance(q.options, list) else list(q.options),
                correct_answer=q.correct_answer,
                explanation=q.explanation,
            )
            for q in quiz.questions
        ],
    )


async def create_custom_quiz_controller(
    session: AsyncSession,
    user: User,
    payload: CustomQuizCreate,
) -> QuizItem:
    questions_data = [
        {
            "question_text": q.question_text,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
        }
        for q in payload.questions
    ]
    quiz = await study_aid_repo.create_quiz(
        session,
        document_id=None,
        title=payload.title.strip(),
        questions=questions_data,
        user_id=user.id,
    )
    await session.commit()

    return QuizItem(
        id=quiz.id,
        document_id=quiz.document_id,
        title=quiz.title,
        created_at=_to_utc(quiz.created_at),
        questions=[
            QuizQuestionItem(
                id=q.id,
                quiz_id=q.quiz_id,
                question_text=q.question_text,
                options=q.options if isinstance(q.options, list) else list(q.options),
                correct_answer=q.correct_answer,
                explanation=q.explanation,
            )
            for q in quiz.questions
        ],
    )

# ---------------- Learning Evaluation Controllers ----------------


async def generate_attempt_evaluation_controller(
    session: AsyncSession,
    user: User,
    attempt_id: str,
) -> LearningEvaluationResponse:
    eval_dict = await study_aid_service.generate_learning_evaluation(
        session, attempt_id=attempt_id, student_id=user.id
    )
    if "created_at" in eval_dict:
        eval_dict["created_at"] = _to_utc(eval_dict["created_at"])
    return LearningEvaluationResponse(**eval_dict)


async def get_attempt_evaluation_controller(
    session: AsyncSession,
    user: User,
    attempt_id: str,
) -> LearningEvaluationResponse:
    eval_dict = await study_aid_service.get_attempt_evaluation(
        session, attempt_id=attempt_id, student_id=user.id
    )
    if not eval_dict:
        eval_dict = await study_aid_service.generate_learning_evaluation(
            session, attempt_id=attempt_id, student_id=user.id
        )
    if "created_at" in eval_dict:
        eval_dict["created_at"] = _to_utc(eval_dict["created_at"])
    return LearningEvaluationResponse(**eval_dict)


async def list_my_evaluations_controller(
    session: AsyncSession,
    user: User,
    limit: int = 10,
) -> list[LearningEvaluationResponse]:
    evals = await study_aid_repo.list_evaluations_by_student(session, user.id, limit=limit)
    return [
        LearningEvaluationResponse(
            id=ev.id,
            user_id=ev.user_id,
            quiz_id=ev.quiz_id,
            attempt_id=ev.attempt_id,
            score=ev.score,
            competency_level=ev.competency_level,
            summary=ev.summary,
            strengths=ev.strengths if isinstance(ev.strengths, list) else [],
            weaknesses=ev.weaknesses if isinstance(ev.weaknesses, list) else [],
            roadmap=ev.roadmap if isinstance(ev.roadmap, list) else [],
            created_at=_to_utc(ev.created_at),
        )
        for ev in evals
    ]

