from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from src.api.controllers import study_aid_controller as sac
from src.models.study_aid import (
    FlashcardCreate,
    GenerateFlashcardsRequest,
    GenerateQuizRequest,
    QuizSubmitRequest,
)


def _user(role: str, uid: str = "u-1"):
    return SimpleNamespace(id=uid, role=SimpleNamespace(name=role))


def _mock_session():
    mock = AsyncMock()
    mock.commit = AsyncMock()
    return mock


# ============================================================================
# 1. Route Authentication Tests (401 without bearer token)
# ============================================================================


@pytest.mark.asyncio
async def test_flashcard_list_requires_auth(client):
    res = await client.get("/api/v1/documents/doc-1/flashcards")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_flashcard_create_requires_auth(client):
    res = await client.post(
        "/api/v1/documents/doc-1/flashcards",
        json={"front_text": "Q", "back_text": "A"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_flashcard_generate_requires_auth(client):
    res = await client.post(
        "/api/v1/documents/doc-1/flashcards/generate",
        json={"count": 5},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_flashcard_delete_requires_auth(client):
    res = await client.delete("/api/v1/flashcards/fc-1")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_quiz_list_requires_auth(client):
    res = await client.get("/api/v1/documents/doc-1/quizzes")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_quiz_generate_requires_auth(client):
    res = await client.post(
        "/api/v1/documents/doc-1/quizzes/generate",
        json={"title": "Test Quiz", "num_questions": 5},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_quiz_get_requires_auth(client):
    res = await client.get("/api/v1/quizzes/q-1")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_quiz_delete_requires_auth(client):
    res = await client.delete("/api/v1/quizzes/q-1")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_quiz_submit_requires_auth(client):
    res = await client.post(
        "/api/v1/quizzes/q-1/submit",
        json={"answers": {"q1": "A"}},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_my_attempts_requires_auth(client):
    res = await client.get("/api/v1/study-aid/my-attempts")
    assert res.status_code == 401


# ============================================================================
# 2. Flashcard Controller Unit Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_document_flashcards_controller(monkeypatch):
    mock_cards = [
        SimpleNamespace(
            id="fc-1",
            document_id="doc-1",
            front_text="Front 1",
            back_text="Back 1",
            created_at=datetime.now(),
        ),
        SimpleNamespace(
            id="fc-2",
            document_id="doc-1",
            front_text="Front 2",
            back_text="Back 2",
            created_at=datetime.now(),
        ),
    ]

    async def fake_list(session, doc_id, *args, **kwargs):
        assert doc_id == "doc-1"
        return mock_cards

    monkeypatch.setattr(sac.study_aid_repo, "list_flashcards", fake_list)
    session = _mock_session()

    result = await sac.list_document_flashcards_controller(session, "doc-1")
    assert len(result) == 2
    assert result[0].id == "fc-1"
    assert result[0].front_text == "Front 1"
    assert result[1].id == "fc-2"


@pytest.mark.asyncio
async def test_create_flashcard_controller(monkeypatch):
    mock_created = SimpleNamespace(
        id="fc-new",
        document_id="doc-1",
        front_text="New Front",
        back_text="New Back",
        created_at=datetime.now(),
    )

    async def fake_create(session, document_id, front_text, back_text, *args, **kwargs):
        return mock_created

    monkeypatch.setattr(sac.study_aid_repo, "create_flashcard", fake_create)
    session = _mock_session()

    payload = FlashcardCreate(front_text="New Front", back_text="New Back")
    lecturer = _user("lecturer", "lec-1")
    result = await sac.create_flashcard_controller(session, "doc-1", payload, user=lecturer)

    assert result.id == "fc-new"
    assert result.front_text == "New Front"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_flashcards_controller(monkeypatch):
    mock_generated = [
        SimpleNamespace(
            id="fc-ai-1",
            document_id="doc-1",
            front_text="AI Front 1",
            back_text="AI Back 1",
            created_at=datetime.now(),
        )
    ]

    async def fake_generate(session, document_id, count, *args, **kwargs):
        assert count == 5
        return mock_generated

    monkeypatch.setattr(sac.study_aid_service, "generate_flashcards", fake_generate)
    session = _mock_session()

    payload = GenerateFlashcardsRequest(count=5)
    lecturer = _user("lecturer", "lec-1")
    result = await sac.generate_flashcards_controller(session, "doc-1", payload, user=lecturer)

    assert len(result) == 1
    assert result[0].id == "fc-ai-1"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_flashcard_controller_success(monkeypatch):
    mock_card = SimpleNamespace(id="fc-1")

    async def fake_get(session, card_id):
        return mock_card

    async def fake_delete(session, card):
        assert card.id == "fc-1"

    monkeypatch.setattr(sac.study_aid_repo, "get_flashcard", fake_get)
    monkeypatch.setattr(sac.study_aid_repo, "delete_flashcard", fake_delete)
    session = _mock_session()

    res = await sac.delete_flashcard_controller(session, "fc-1")
    assert res["status"] == "ok"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_flashcard_controller_not_found(monkeypatch):
    async def fake_get(session, card_id):
        return None

    monkeypatch.setattr(sac.study_aid_repo, "get_flashcard", fake_get)
    session = _mock_session()

    with pytest.raises(HTTPException) as exc:
        await sac.delete_flashcard_controller(session, "missing-id")
    assert exc.value.status_code == 404


# ============================================================================
# 3. Quiz Controller Unit Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_document_quizzes_controller(monkeypatch):
    mock_quiz = SimpleNamespace(
        id="q-1",
        document_id="doc-1",
        title="Toán học",
        created_at=datetime.now(),
    )

    async def fake_list(session, doc_id, *args, **kwargs):
        return [(mock_quiz, 5)]

    monkeypatch.setattr(sac.study_aid_repo, "list_quizzes_by_document", fake_list)
    session = _mock_session()

    quizzes = await sac.list_document_quizzes_controller(session, "doc-1")
    assert len(quizzes) == 1
    assert quizzes[0].id == "q-1"
    assert quizzes[0].question_count == 5


@pytest.mark.asyncio
async def test_generate_quiz_controller(monkeypatch):
    mock_quiz = SimpleNamespace(
        id="q-gen",
        document_id="doc-1",
        title="AI Quiz",
        created_at=datetime.now(),
        questions=[
            SimpleNamespace(
                id="q-q1",
                quiz_id="q-gen",
                question_text="1 + 1 = ?",
                options=["A. 1", "B. 2", "C. 3", "D. 4"],
                correct_answer="B. 2",
                explanation="1 + 1 = 2",
            )
        ],
    )

    async def fake_gen_quiz(session, document_id, title, num_questions, *args, **kwargs):
        return mock_quiz

    monkeypatch.setattr(sac.study_aid_service, "generate_quiz", fake_gen_quiz)
    session = _mock_session()

    payload = GenerateQuizRequest(title="AI Quiz", num_questions=1)
    lecturer = _user("lecturer", "lec-1")
    res = await sac.generate_quiz_controller(session, "doc-1", payload, user=lecturer)

    assert res.id == "q-gen"
    assert len(res.questions) == 1
    assert res.questions[0].correct_answer == "B. 2"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_quiz_hides_answers_for_student_before_attempt(monkeypatch):
    mock_quiz = SimpleNamespace(
        id="q-1",
        document_id="doc-1",
        title="Thi thử",
        created_at=datetime.now(),
        questions=[
            SimpleNamespace(
                id="qq-1",
                quiz_id="q-1",
                question_text="Câu 1",
                options=["A", "B"],
                correct_answer="A",
                explanation="Vì A đúng",
            )
        ],
    )

    async def fake_get_quiz(session, qid, load_questions):
        return mock_quiz

    async def fake_attempts(session, user_id):
        return []

    monkeypatch.setattr(sac.study_aid_repo, "get_quiz", fake_get_quiz)
    monkeypatch.setattr(sac.study_aid_repo, "list_attempts_by_student", fake_attempts)
    session = _mock_session()

    student = _user("student", "s-1")
    res = await sac.get_quiz_controller(session, student, "q-1", include_answers=False)

    # Học sinh chưa nộp bài -> không được thấy đáp án
    assert res.questions[0].correct_answer is None
    assert res.questions[0].explanation is None


@pytest.mark.asyncio
async def test_get_quiz_reveals_answers_for_lecturer(monkeypatch):
    mock_quiz = SimpleNamespace(
        id="q-1",
        document_id="doc-1",
        title="Thi thử",
        created_at=datetime.now(),
        questions=[
            SimpleNamespace(
                id="qq-1",
                quiz_id="q-1",
                question_text="Câu 1",
                options=["A", "B"],
                correct_answer="A",
                explanation="Vì A đúng",
            )
        ],
    )

    async def fake_get_quiz(session, qid, load_questions):
        return mock_quiz

    monkeypatch.setattr(sac.study_aid_repo, "get_quiz", fake_get_quiz)
    session = _mock_session()

    lecturer = _user("lecturer", "lec-1")
    res = await sac.get_quiz_controller(session, lecturer, "q-1", include_answers=False)

    # Giảng viên luôn thấy đáp án
    assert res.questions[0].correct_answer == "A"
    assert res.questions[0].explanation == "Vì A đúng"


@pytest.mark.asyncio
async def test_delete_quiz_controller_success(monkeypatch):
    mock_quiz = SimpleNamespace(id="q-1")

    async def fake_get(session, qid, load_questions):
        return mock_quiz

    async def fake_delete(session, quiz):
        assert quiz.id == "q-1"

    monkeypatch.setattr(sac.study_aid_repo, "get_quiz", fake_get)
    monkeypatch.setattr(sac.study_aid_repo, "delete_quiz", fake_delete)
    session = _mock_session()

    res = await sac.delete_quiz_controller(session, "q-1")
    assert res["status"] == "ok"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_quiz_controller_not_found(monkeypatch):
    async def fake_get(session, qid, load_questions):
        return None

    monkeypatch.setattr(sac.study_aid_repo, "get_quiz", fake_get)
    session = _mock_session()

    with pytest.raises(HTTPException) as exc:
        await sac.delete_quiz_controller(session, "missing-quiz")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_submit_quiz_controller(monkeypatch):
    mock_eval = {
        "attempt_id": "att-1",
        "quiz_id": "q-1",
        "score": 10.0,
        "correct_count": 5,
        "total_questions": 5,
        "completed_at": datetime.now(),
        "details": [],
    }

    async def fake_eval(session, quiz_id, student_id, answers):
        assert quiz_id == "q-1"
        assert student_id == "stu-1"
        return mock_eval

    monkeypatch.setattr(sac.study_aid_service, "evaluate_quiz_submission", fake_eval)
    session = _mock_session()

    student = _user("student", "stu-1")
    payload = QuizSubmitRequest(answers={"q1": "A"})
    res = await sac.submit_quiz_controller(session, student, "q-1", payload)

    assert res.score == 10.0
    assert res.correct_count == 5
    session.commit.assert_awaited_once()


# ============================================================================
# 4. Route Execution with Authenticated Student via HTTP Client
# ============================================================================


@pytest.mark.asyncio
async def test_route_list_flashcards_as_student(client, as_student, monkeypatch):
    mock_cards = [
        sac.FlashcardItem(
            id="fc-1",
            document_id="doc-1",
            front_text="Q1",
            back_text="A1",
            created_at=datetime.now(),
        )
    ]

    async def fake_list_controller(session, document_id, *args, **kwargs):
        return mock_cards

    monkeypatch.setattr(
        "src.api.routes.list_document_flashcards_controller", fake_list_controller
    )

    res = await client.get("/api/v1/documents/doc-1/flashcards")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == "fc-1"


@pytest.mark.asyncio
async def test_route_delete_flashcard_as_student(client, as_student, monkeypatch):
    async def fake_delete_controller(session, flashcard_id, *args, **kwargs):
        return {"status": "ok", "message": "Đã xóa flashcard thành công."}

    monkeypatch.setattr(
        "src.api.routes.delete_flashcard_controller", fake_delete_controller
    )

    res = await client.delete("/api/v1/flashcards/fc-1")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_route_delete_quiz_as_student(client, as_student, monkeypatch):
    async def fake_delete_quiz_controller(session, quiz_id, *args, **kwargs):
        return {"status": "ok", "message": "Đã xóa bài Quiz thành công."}

    monkeypatch.setattr(
        "src.api.routes.delete_quiz_controller", fake_delete_quiz_controller
    )

    res = await client.delete("/api/v1/quizzes/q-1")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_list_recent_submissions_controller(monkeypatch):
    mock_items = [
        {
            "id": "att-1",
            "student_id": "stu-1",
            "student_name": "Nguyen Van A",
            "student_email": "a@school.edu.vn",
            "quiz_id": "q-1",
            "quiz_title": "Kiem tra chuong 1",
            "score": 8.0,
            "total_questions": 10,
            "score_display": "8/10",
            "completed_at": datetime.now(),
            "classroom_id": "class-1",
            "classroom_name": "Lop 10A1",
        }
    ]

    async def fake_list_submissions(session, user_id, role, limit=10):
        assert user_id == "lec-1"
        assert role == "lecturer"
        return mock_items

    monkeypatch.setattr(sac.study_aid_repo, "list_recent_submissions", fake_list_submissions)
    session = _mock_session()
    lecturer = _user("lecturer", "lec-1")

    items = await sac.list_recent_submissions_controller(session, lecturer, limit=5)
    assert len(items) == 1
    assert items[0].id == "att-1"
    assert items[0].student_name == "Nguyen Van A"
    assert items[0].score_display == "8/10"
    assert items[0].classroom_name == "Lop 10A1"


@pytest.mark.asyncio
async def test_route_list_recent_submissions_as_lecturer(client, as_lecturer, monkeypatch):
    mock_items = [
        sac.RecentSubmissionItem(
            id="att-1",
            student_id="stu-1",
            student_name="Nguyen Van A",
            student_email="a@school.edu.vn",
            quiz_id="q-1",
            quiz_title="Kiem tra chuong 1",
            score=8.0,
            total_questions=10,
            score_display="8/10",
            completed_at=datetime.now(),
            classroom_id="class-1",
            classroom_name="Lop 10A1",
        )
    ]

    async def fake_controller(session, user, limit=10):
        return mock_items

    monkeypatch.setattr(
        "src.api.routes.list_recent_submissions_controller", fake_controller
    )

    res = await client.get("/api/v1/study-aid/recent-submissions")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["student_name"] == "Nguyen Van A"
    assert data[0]["score_display"] == "8/10"


@pytest.mark.asyncio
async def test_attempt_review_requires_auth(client):
    res = await client.get("/api/v1/study-aids/quiz-attempts/att-1/review")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_route_get_attempt_review_as_student(client, as_student, monkeypatch):
    mock_review = sac.QuizSubmitResponse(
        attempt_id="att-1",
        quiz_id="quiz-1",
        quiz_title="Quiz Triết Học",
        score=5.0,
        total_questions=2,
        correct_count=1,
        completed_at=datetime.now(),
        details=[
            {
                "question_id": "qq-1",
                "question_text": "Câu 1?",
                "chosen_answer": "A. Sai",
                "correct_answer": "B. Đúng",
                "is_correct": False,
                "explanation": "Giải thích câu 1",
            },
            {
                "question_id": "qq-2",
                "question_text": "Câu 2?",
                "chosen_answer": "C. Đúng",
                "correct_answer": "C. Đúng",
                "is_correct": True,
                "explanation": "Giải thích câu 2",
            },
        ],
    )

    async def fake_controller(session, user, attempt_id):
        assert attempt_id == "att-1"
        assert user.id == "student-1"
        return mock_review

    monkeypatch.setattr("src.api.routes.get_attempt_review_controller", fake_controller)

    res = await client.get("/api/v1/study-aids/quiz-attempts/att-1/review")
    assert res.status_code == 200
    data = res.json()
    assert data["attempt_id"] == "att-1"
    assert data["quiz_title"] == "Quiz Triết Học"
    assert data["score"] == 5.0
    assert data["correct_count"] == 1
    assert data["total_questions"] == 2
    assert len(data["details"]) == 2
    assert data["details"][0]["is_correct"] is False
    assert data["details"][1]["is_correct"] is True


@pytest.mark.asyncio
async def test_service_get_attempt_review_with_real_db():
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from src.db.models import Base, Quiz, QuizQuestion, Role, User, UserQuizAttempt
    from src.services import study_aid as study_aid_service

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            role = Role(id="role-stu", name="student", code="SV", display_name="Sinh viên")
            student = User(
                id="stu-1",
                username="stu1",
                email="stu1@example.com",
                password="hash",
                full_name="Sinh Viên 1",
                role_id="role-stu",
            )
            other_student = User(
                id="stu-2",
                username="stu2",
                email="stu2@example.com",
                password="hash",
                full_name="Sinh Viên 2",
                role_id="role-stu",
            )
            quiz = Quiz(id="quiz-1", title="Quiz Triết Học", user_id="stu-1")
            q1 = QuizQuestion(
                id="q-1",
                quiz_id="quiz-1",
                question_text="Hàng hóa có mấy thuộc tính?",
                options=["A. 1", "B. 2", "C. 3", "D. 4"],
                correct_answer="B. 2",
                explanation="Giá trị sử dụng và giá trị.",
            )
            q2 = QuizQuestion(
                id="q-2",
                quiz_id="quiz-1",
                question_text="Ai là tác giả bộ Tư bản?",
                options=["A. C.Mác", "B. Hegel", "C. Kant", "D. Locke"],
                correct_answer="A. C.Mác",
                explanation="C.Mác viết bộ Tư bản.",
            )
            attempt = UserQuizAttempt(
                id="att-1",
                quiz_id="quiz-1",
                student_id="stu-1",
                score=5.0,
                answers={"q-1": "A. 1", "q-2": "A. C.Mác"},
            )
            session.add_all([role, student, other_student, quiz, q1, q2, attempt])
            await session.commit()

            # Chủ sở hữu bài làm xem lại thành công
            res = await study_aid_service.get_attempt_review(
                session, attempt_id="att-1", user_id="stu-1", role="student"
            )
            assert res["attempt_id"] == "att-1"
            assert res["quiz_id"] == "quiz-1"
            assert res["quiz_title"] == "Quiz Triết Học"
            assert res["score"] == 5.0
            assert res["total_questions"] == 2
            assert res["correct_count"] == 1
            by_qid = {d["question_id"]: d for d in res["details"]}
            assert by_qid["q-1"]["chosen_answer"] == "A. 1"
            assert by_qid["q-1"]["correct_answer"] == "B. 2"
            assert by_qid["q-1"]["is_correct"] is False
            assert by_qid["q-2"]["is_correct"] is True

            # Sinh viên khác xem -> 403
            with pytest.raises(HTTPException) as exc_403:
                await study_aid_service.get_attempt_review(
                    session, attempt_id="att-1", user_id="stu-2", role="student"
                )
            assert exc_403.value.status_code == 403

            # Giảng viên xem -> thành công
            lec_res = await study_aid_service.get_attempt_review(
                session, attempt_id="att-1", user_id="lec-1", role="lecturer"
            )
            assert lec_res["attempt_id"] == "att-1"

            # Controller trả về QuizSubmitResponse đầy đủ
            ctrl_res = await sac.get_attempt_review_controller(
                session, _user("student", "stu-1"), "att-1"
            )
            assert ctrl_res.attempt_id == "att-1"
            assert ctrl_res.quiz_title == "Quiz Triết Học"
            assert len(ctrl_res.details) == 2

            # Không tồn tại -> 404
            with pytest.raises(HTTPException) as exc_404:
                await study_aid_service.get_attempt_review(
                    session, attempt_id="missing", user_id="stu-1", role="student"
                )
            assert exc_404.value.status_code == 404
    finally:
        await engine.dispose()
