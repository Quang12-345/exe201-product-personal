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
    assert request_schema["properties"]["plan_code"]["const"] == "pro_monthly"
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
