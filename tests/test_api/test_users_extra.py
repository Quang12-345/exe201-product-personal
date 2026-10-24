from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api.controllers import document_controller as dc
from src.api.controllers import user_controller as uc
from src.models.user import CreateUserRequest


def _user(role, uid):
    return SimpleNamespace(id=uid, full_name=role.title(), role=SimpleNamespace(name=role))


def _doc(scope, status="ready", owner=None, did="d1"):
    return SimpleNamespace(
        id=did, title="T", file_name="f.pdf", file_type="pdf", status=status,
        total_pages=1, total_chunks=1, uploaded_by=owner, created_at=None,
        metadata_json={"scope": scope, "category": "syllabus", "subject": "CNPM"},
    )


# ----- DELETE /users route auth -----

@pytest.mark.asyncio
async def test_delete_user_requires_auth(client):
    assert (await client.delete("/api/v1/users/x")).status_code == 401


@pytest.mark.asyncio
async def test_delete_user_forbidden_for_student(client, as_student):
    assert (await client.delete("/api/v1/users/x")).status_code == 403


@pytest.mark.asyncio
async def test_delete_user_cannot_delete_self(monkeypatch):
    admin = _user("admin", "a1")

    async def fake_get(session, uid):
        return SimpleNamespace(id=uid)

    monkeypatch.setattr(uc.user_repo, "get_by_id", fake_get)
    with pytest.raises(HTTPException) as exc:
        await uc.delete_user_controller("a1", None, admin)
    assert exc.value.status_code == 400


# ----- tạo user: password lưu HASH (không còn plaintext), username từ email -----

@pytest.mark.asyncio
@pytest.mark.parametrize("password", [None, "Chosen123!"])
async def test_create_user_hashes_password_and_sets_username(monkeypatch, password):
    captured = {}

    async def fake_false(session, value, **kw):
        return False

    async def fake_resolve(session, role):
        return None

    async def fake_add(session, user):
        captured["password"] = user.password
        captured["username"] = user.username
        captured["status"] = user.status
        user.id = user.id or "new-id"
        return user

    class FakeSession:
        async def commit(self):
            return None

        async def execute(self, *args, **kwargs):
            return SimpleNamespace(scalar_one=lambda: 0, scalar_one_or_none=lambda: None)

    async def fake_reload(session, uid):
        return SimpleNamespace(
            id=uid, username="x", email="x@y.com", full_name="X",
            role=None, phone_number=None, status="pending",
        )

    async def fake_send_account_created_email(email, username, password):
        captured["email"] = email
        captured["email_username"] = username
        captured["email_password"] = password

    async def fake_count_documents_by_owner(session, owner_id):
        return 0

    monkeypatch.setattr(uc.user_repo, "email_taken", fake_false)
    monkeypatch.setattr(uc.user_repo, "username_taken", fake_false)
    monkeypatch.setattr(uc, "_resolve_role_id", fake_resolve)
    monkeypatch.setattr(uc, "generate_initial_password", lambda: "Generated123!")
    monkeypatch.setattr(uc, "send_account_created_email", fake_send_account_created_email)
    monkeypatch.setattr(uc.user_repo, "add", fake_add)
    monkeypatch.setattr(uc.user_repo, "reload_with_role", fake_reload)
    monkeypatch.setattr(uc.user_repo, "count_documents_by_owner", fake_count_documents_by_owner)

    req = CreateUserRequest(email="x@y.com", name="X", password=password)
    response = await uc.create_user_controller(req, FakeSession())
    assert captured["password"] != "Generated123!"  # đã hash, không lưu plaintext
    assert captured["password"].startswith("$2")  # định dạng bcrypt
    assert captured["username"] == "x"  # lấy phần trước @ email
    assert captured["status"] == "pending"
    assert captured["email"] == "x@y.com"
    assert captured["email_username"] == "x"
    assert captured["email_password"] == (password or "Generated123!")
    assert response.status == "pending"


# ----- documents/available lọc theo vai trò -----

@pytest.mark.asyncio
async def test_available_student_sees_only_school_ready(monkeypatch):
    docs = [
        _doc("school", "ready", did="s1"),
        _doc("school", "queued", did="s2"),
        _doc("personal", "ready", owner="lec", did="p1"),
    ]

    async def fake_list(session):
        return docs

    async def fake_users(session):
        return []

    async def fake_viewed(session, user_id):
        return set()

    monkeypatch.setattr(dc.document_repo, "list_documents", fake_list)
    monkeypatch.setattr(dc.document_repo, "list_viewed_document_ids", fake_viewed)
    monkeypatch.setattr(dc.user_repo, "list_all", fake_users)
    res = await dc.list_available_documents_controller(None, _user("student", "s1"))
    assert [d.id for d in res] == ["s1"]


@pytest.mark.asyncio
async def test_available_lecturer_sees_school_plus_own(monkeypatch):
    docs = [
        _doc("school", "ready", did="s1"),
        _doc("personal", "ready", owner="lec-1", did="own"),
        _doc("personal", "ready", owner="other", did="x"),
    ]

    async def fake_list(session):
        return docs

    async def fake_users(session):
        return []

    async def fake_viewed(session, user_id):
        return set()

    monkeypatch.setattr(dc.document_repo, "list_documents", fake_list)
    monkeypatch.setattr(dc.document_repo, "list_viewed_document_ids", fake_viewed)
    monkeypatch.setattr(dc.user_repo, "list_all", fake_users)
    res = await dc.list_available_documents_controller(None, _user("lecturer", "lec-1"))
    assert set(d.id for d in res) == {"s1", "own"}
