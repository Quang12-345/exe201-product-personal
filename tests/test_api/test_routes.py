import pytest
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from src.api import routes
from src.models.user import UpdateUserRequest


class FakeAgent:
    async def ainvoke(self, state):
        return {
            "response": "Mocked answer",
            "conversation_id": state.get("conversation_id") or "conv-1",
            "sources": [
                {
                    "document_id": "doc-1",
                    "title": "Lecture",
                    "page_number": 1,
                    "chunk_id": "chunk-1",
                    "score": 0.9,
                }
            ],
        }


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_chat_requires_auth(client):
    # /chat giờ yêu cầu đăng nhập → không token = 401.
    response = await client.post("/api/v1/chat", json={"message": "Hello"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_chat_empty_message(client, as_student):
    response = await client.post("/api/v1/chat", json={"message": ""})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_chat_returns_sources(client, as_student, monkeypatch):
    # Agent được nạp lười trong route (from src.agents.graph import agent)
    # → patch tại module graph.
    import src.agents.graph as graph_module

    async def allow_chat(*args, **kwargs):
        return None

    monkeypatch.setattr(routes, "reserve_chat_use", allow_chat)
    monkeypatch.setattr(graph_module, "agent", FakeAgent())
    response = await client.post("/api/v1/chat", json={"message": "Hello"})
    assert response.status_code == 200
    data = response.json()
    assert data["response"] == "Mocked answer"
    assert data["conversation_id"] == "conv-1"
    assert data["sources"][0]["chunk_id"] == "chunk-1"


@pytest.mark.asyncio
async def test_student_chat_and_stream_both_reserve_quota(client, as_student, monkeypatch):
    reservations = []

    async def record_reservation(session, **kwargs):
        reservations.append(kwargs)

    monkeypatch.setattr(routes, "reserve_chat_use", record_reservation)
    monkeypatch.setattr(
        routes,
        "chat_stream_controller",
        lambda *args, **kwargs: JSONResponse({"ok": True}),
    )

    standard = await client.post("/api/v1/chat", json={"message": "Hello", "request_id": "std-1"})
    streamed = await client.post("/api/v1/chat/stream", json={"message": "Hello", "request_id": "sse-1"})

    assert standard.status_code == 200
    assert streamed.status_code == 200
    assert [reservation["request_id"] for reservation in reservations] == ["std-1", "sse-1"]
    assert all(reservation["user_role"] == "student" for reservation in reservations)


def test_vnpay_create_openapi_has_explicit_plan_schema():
    from src.main import app

    schema = app.openapi()
    operation = schema["paths"]["/api/v1/payments/vnpay/create"]["post"]
    request_schema = schema["components"]["schemas"]["VnPayPaymentCreateRequest"]

    assert "/api/v1/payments/vnpay/return" in schema["paths"]
    assert "/api/v1/payments/vnpay/ipn" in schema["paths"]
    assert "/api/v1/payments/vnpay/reconcile/{order_code}" in schema["paths"]
    assert operation["requestBody"]["required"] is True
    assert set(request_schema["properties"]["plan_code"]["enum"]) == {"pro_monthly", "lecturer_monthly"}
    assert "additionalProperties" not in request_schema


@pytest.mark.asyncio
async def test_ingest_sample_dataset(client, as_admin, monkeypatch):
    async def fake_ingest(session, force=False):
        return {
            "documents": 5,
            "chunks": 20,
            "points": 20,
            "failed_documents": 0,
            "dataset_dir": "datasets/rag_sample/docs",
        }

    monkeypatch.setattr(routes, "ingest_rag_sample", fake_ingest)
    response = await client.post("/api/v1/datasets/rag-sample/ingest")
    assert response.status_code == 200
    data = response.json()
    assert data["documents"] == 5
    assert data["points"] == 20


def test_update_user_request_rejects_id():
    with pytest.raises(ValidationError):
        UpdateUserRequest(id="changed-id", name="Updated Name")


@pytest.mark.asyncio
async def test_agent_status(client):
    response = await client.get("/api/v1/status")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_vnpay_return_handles_invalid_signature_without_error(client):
    from unittest.mock import AsyncMock

    from src.db.session import get_db
    from src.main import app

    fake_db = AsyncMock()
    fake_db.scalar = AsyncMock(return_value=None)
    app.dependency_overrides[get_db] = lambda: fake_db

    response = await client.get(
        "/api/v1/payments/vnpay/return",
        params={"vnp_TxnRef": "999888", "vnp_SecureHash": "invalid"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    location = response.headers.get("location", "")
    assert "payment=invalid" in location
    assert "order_code=999888" in location


@pytest.mark.asyncio
async def test_vnpay_return_handles_empty_params_without_error(client):
    from unittest.mock import AsyncMock

    from src.db.session import get_db
    from src.main import app

    fake_db = AsyncMock()
    fake_db.scalar = AsyncMock(return_value=None)
    app.dependency_overrides[get_db] = lambda: fake_db

    response = await client.get(
        "/api/v1/payments/vnpay/return",
        follow_redirects=False,
    )
    assert response.status_code == 303
    location = response.headers.get("location", "")
    assert "payment=invalid" in location
    assert "order_code=0" in location


@pytest.mark.asyncio
async def test_vnpay_checkout_routes_by_role_and_blocks_mismatch(client, monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from src.api.dependencies import get_current_user
    from src.db.session import get_db
    from src.main import app

    fake_db = AsyncMock()
    app.dependency_overrides[get_db] = lambda: fake_db
    monkeypatch.setattr(
        "src.config.get_settings",
        lambda: SimpleNamespace(payos_client_id="", payos_api_key="", payos_checksum_key=""),
    )

    captured_calls = []

    async def fake_vnpay_checkout(session, *, user, ip_address, return_to=None, plan_code="pro_monthly"):
        captured_calls.append({"user_id": user.id, "plan_code": plan_code})
        amount = 129_000 if plan_code == "lecturer_monthly" else 39_000
        return {
            "order_code": 777001,
            "amount": amount,
            "payment_url": "https://sandbox.example/pay",
            "checkout_url": "https://sandbox.example/pay",
            "expires_at": "2026-11-12T12:00:00Z",
        }

    monkeypatch.setattr(routes, "create_vnpay_checkout", fake_vnpay_checkout)

    # Lecturer defaults to lecturer_monthly (129,000 VND) when plan_code is omitted
    lecturer = SimpleNamespace(
        id="lec-1", role_id="r-lec", status="active", role=SimpleNamespace(name="lecturer")
    )
    app.dependency_overrides[get_current_user] = lambda: lecturer
    lec_ok = await client.post("/api/v1/payments/vnpay/create", json={"return_to": "/lecturer/classes"})
    assert lec_ok.status_code == 200
    assert lec_ok.json()["amount"] == 129_000
    assert captured_calls[-1]["plan_code"] == "lecturer_monthly"

    # Lecturer cannot buy student plan
    lec_bad = await client.post("/api/v1/payments/vnpay/create", json={"plan_code": "pro_monthly"})
    assert lec_bad.status_code == 403

    # Student cannot buy lecturer plan, and student defaults to pro_monthly (39,000 VND)
    student = SimpleNamespace(
        id="stu-1", role_id="r-stu", status="active", role=SimpleNamespace(name="student")
    )
    app.dependency_overrides[get_current_user] = lambda: student
    stu_bad = await client.post("/api/v1/payments/vnpay/create", json={"plan_code": "lecturer_monthly"})
    assert stu_bad.status_code == 403

    stu_ok = await client.post("/api/v1/payments/vnpay/create", json={})
    assert stu_ok.status_code == 200
    assert stu_ok.json()["amount"] == 39_000
    assert captured_calls[-1]["plan_code"] == "pro_monthly"


@pytest.mark.asyncio
async def test_unpaid_lecturer_routes_enforce_5_class_limit_and_feature_locks(client, as_lecturer):
    from datetime import UTC, datetime, timedelta
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from src.db.models import Base, Classroom, Role, Subscription, User
    from src.db.session import get_db
    from src.main import app

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db

    try:
        async with session_factory() as seed:
            seed.add(Role(id="r-lec", name="lecturer", code="GV", display_name="Giảng viên"))
            seed.add(
                User(
                    id="lecturer-1",
                    username="lec1",
                    email="lec1@example.com",
                    password="hash",
                    full_name="GV 1",
                    role_id="r-lec",
                )
            )
            for idx in range(5):
                seed.add(
                    Classroom(
                        id=f"c-{idx}",
                        name=f"Class {idx}",
                        code=f"CLS{idx}",
                        subject=f"Subject {idx}",
                        created_by="lecturer-1",
                    )
                )
            await seed.commit()

        # 6th classroom blocked with 403 for unpaid lecturer
        res_cls = await client.post(
            "/api/v1/classrooms",
            json={"name": "Lop thu 6", "subject": "Toan"},
        )
        assert res_cls.status_code == 403

        # Exams & custom quiz creation blocked with 403 for unpaid lecturer
        res_exam = await client.post(
            "/api/v1/exams",
            json={"subject": "Toan", "title": "Giua ky", "duration_minutes": 60},
        )
        assert res_exam.status_code == 403

        res_quiz = await client.post(
            "/api/v1/quizzes/custom",
            json={
                "title": "De thi 1",
                "questions": [
                    {
                        "question_text": "1+1=?",
                        "options": ["1", "2"],
                        "correct_answer": "2",
                    }
                ],
            },
        )
        assert res_quiz.status_code == 403

        # Grant active lecturer subscription -> 6th classroom & exam creation succeed
        async with session_factory() as upgrade:
            now = datetime.now(UTC).replace(tzinfo=None)
            upgrade.add(
                Subscription(
                    user_id="lecturer-1",
                    plan_code="lecturer",
                    status="active",
                    starts_at=now,
                    expires_at=now + timedelta(days=30),
                )
            )
            await upgrade.commit()

        res_cls_ok = await client.post(
            "/api/v1/classrooms",
            json={"name": "Lop thu 6", "subject": "Toan"},
        )
        assert res_cls_ok.status_code == 201

        res_exam_ok = await client.post(
            "/api/v1/exams",
            json={"subject": "Toan", "title": "Giua ky", "duration_minutes": 60},
        )
        assert res_exam_ok.status_code == 201
    finally:
        await engine.dispose()

