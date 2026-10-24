from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from src.api.controllers import user_controller
from src.api.controllers.user_controller import delete_user_controller, update_user_controller
from src.models import UpdateUserRequest
from src.models.user import CreateUserRequest


class FakeSession:
    def __init__(self, *, fail_commit: bool = False):
        self.fail_commit = fail_commit
        self.commits = 0
        self.rollbacks = 0

    async def commit(self):
        self.commits += 1
        if self.fail_commit:
            raise IntegrityError("update users", {}, Exception("duplicate"))

    async def rollback(self):
        self.rollbacks += 1


def make_user(**overrides):
    user = SimpleNamespace(
        id="user-1",
        email="old@example.com",
        full_name="Old Name",
        phone_number="0900000000",
        password="old-hash",
        role_id="role-student",
        role=SimpleNamespace(id="role-student", name="student"),
        status="active",
    )
    for key, value in overrides.items():
        setattr(user, key, value)
    return user


@pytest.mark.asyncio
async def test_list_users_controller_excludes_current_user(monkeypatch):
    session = FakeSession()
    admin = make_user(id="admin-user")
    other_user = make_user(id="other-user", email="other@example.com", full_name="Other User")
    calls = {}

    async def fake_list_all(db_session, *, exclude_user_id=None):
        calls["list_all"] = (db_session, exclude_user_id)
        return [other_user]

    monkeypatch.setattr(user_controller.user_repo, "list_all", fake_list_all)

    response = await user_controller.list_users_controller(session, current_user=admin)

    assert calls["list_all"] == (session, "admin-user")
    assert [user.id for user in response] == ["other-user"]


@pytest.mark.asyncio
async def test_update_user_controller_updates_requested_fields(monkeypatch):
    session = FakeSession()
    user = make_user()
    admin_role = SimpleNamespace(id="role-admin", name="admin")
    calls = {}

    async def fake_get_by_id(db_session, user_id):
        calls["get_by_id"] = (db_session, user_id)
        return user

    async def fake_email_taken(db_session, email, *, exclude_id=None):
        calls["email_taken"] = (db_session, email, exclude_id)
        return False

    async def fake_get_role_by_name(db_session, role_name):
        calls["role_name"] = role_name
        return admin_role

    async def fake_reload_with_role(db_session, user_id):
        user.role = admin_role
        return user

    async def fake_count_documents_by_owner(db_session, owner_id):
        return 0

    monkeypatch.setattr(user_controller.user_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(user_controller.user_repo, "email_taken", fake_email_taken)
    monkeypatch.setattr(user_controller.user_repo, "get_role_by_name", fake_get_role_by_name)
    monkeypatch.setattr(user_controller.user_repo, "reload_with_role", fake_reload_with_role)
    monkeypatch.setattr(user_controller.user_repo, "count_documents_by_owner", fake_count_documents_by_owner)
    monkeypatch.setattr(user_controller, "hash_password", lambda password: f"hashed:{password}")

    response = await update_user_controller(
        "user-1",
        UpdateUserRequest(
            email=" NEW@Example.COM ",
            name=" New Name ",
            phone=None,
            password="secret123",
            role=" Admin ",
            status=" inactive ",
        ),
        session,
    )

    assert user.email == "new@example.com"
    assert user.full_name == "New Name"
    assert user.phone_number is None
    assert user.password == "hashed:secret123"
    assert user.role_id == "role-admin"
    assert user.status == "inactive"
    assert response.email == "new@example.com"
    assert response.name == "New Name"
    assert response.roleID == "role-admin"
    assert response.roleName == "admin"
    assert calls["get_by_id"] == (session, "user-1")
    assert calls["email_taken"] == (session, "new@example.com", "user-1")
    assert calls["role_name"] == "admin"
    assert session.commits == 1
    assert session.rollbacks == 0


@pytest.mark.asyncio
async def test_delete_user_controller_deactivates_user(monkeypatch):
    session = FakeSession()
    user = make_user(id="target-user", status="active")
    admin = make_user(id="admin-user", role=SimpleNamespace(id="role-admin", name="admin"))
    calls = {}

    async def fake_get_by_id(db_session, user_id):
        calls["get_by_id"] = (db_session, user_id)
        return user

    async def fake_deactivate(db_session, db_user):
        calls["deactivate"] = (db_session, db_user.id)
        db_user.status = "deleted"
        return db_user

    async def fail_delete(db_session, db_user):
        raise AssertionError("delete_user_controller should not hard-delete users")

    monkeypatch.setattr(user_controller.user_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(user_controller.user_repo, "deactivate", fake_deactivate)
    monkeypatch.setattr(user_controller.user_repo, "delete", fail_delete)

    response = await delete_user_controller("target-user", session, admin)

    assert user.status == "deleted"
    assert response == {
        "id": "target-user",
        "deleted": True,
        "deactivated": True,
        "status": "deleted",
    }
    assert calls["get_by_id"] == (session, "target-user")
    assert calls["deactivate"] == (session, "target-user")
    assert session.commits == 1


@pytest.mark.asyncio
async def test_update_user_controller_returns_404_when_user_missing(monkeypatch):
    session = FakeSession()

    async def fake_get_by_id(db_session, user_id):
        return None

    monkeypatch.setattr(user_controller.user_repo, "get_by_id", fake_get_by_id)

    with pytest.raises(HTTPException) as exc_info:
        await update_user_controller("missing-user", UpdateUserRequest(name="New Name"), session)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "User does not exist"
    assert session.commits == 0


@pytest.mark.asyncio
async def test_update_user_controller_rejects_duplicate_email(monkeypatch):
    session = FakeSession()
    user = make_user()

    async def fake_get_by_id(db_session, user_id):
        return user

    async def fake_email_taken(db_session, email, *, exclude_id=None):
        return True

    monkeypatch.setattr(user_controller.user_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(user_controller.user_repo, "email_taken", fake_email_taken)

    with pytest.raises(HTTPException) as exc_info:
        await update_user_controller(
            "user-1",
            UpdateUserRequest(email="taken@example.com"),
            session,
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Email already exists"
    assert user.email == "old@example.com"
    assert session.commits == 0


@pytest.mark.asyncio
async def test_update_user_controller_rejects_unknown_role(monkeypatch):
    session = FakeSession()

    async def fake_get_by_id(db_session, user_id):
        return make_user()

    async def fake_get_role_by_name(db_session, role_name):
        return None

    monkeypatch.setattr(user_controller.user_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(user_controller.user_repo, "get_role_by_name", fake_get_role_by_name)

    with pytest.raises(HTTPException) as exc_info:
        await update_user_controller("user-1", UpdateUserRequest(role="missing"), session)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Role does not exist"
    assert session.commits == 0


@pytest.mark.asyncio
async def test_update_user_controller_rolls_back_integrity_error(monkeypatch):
    session = FakeSession(fail_commit=True)
    user = make_user()

    async def fake_get_by_id(db_session, user_id):
        return user

    async def fake_reload_with_role(db_session, user_id):
        return user

    monkeypatch.setattr(user_controller.user_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(user_controller.user_repo, "reload_with_role", fake_reload_with_role)

    with pytest.raises(HTTPException) as exc_info:
        await update_user_controller("user-1", UpdateUserRequest(name="New Name"), session)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Email already exists"
    assert session.commits == 1
    assert session.rollbacks == 1


@pytest.mark.asyncio
async def test_create_user_controller_rejects_student_role(monkeypatch):
    session = FakeSession()

    async def fake_false(db_session, value, **kw):
        return False

    monkeypatch.setattr(user_controller.user_repo, "email_taken", fake_false)
    monkeypatch.setattr(user_controller.user_repo, "username_taken", fake_false)

    with pytest.raises(HTTPException) as exc_info:
        await user_controller.create_user_controller(
            CreateUserRequest(email="sv@example.com", name="Sinh Vien", role="student"),
            session,
        )

    assert exc_info.value.status_code == 400
    assert "Sinh viên tự đăng nhập" in exc_info.value.detail
    assert session.commits == 0


@pytest.mark.asyncio
async def test_update_user_controller_rejects_assigning_student_role(monkeypatch):
    session = FakeSession()
    user = make_user(role=SimpleNamespace(id="role-lecturer", name="lecturer"), role_id="role-lecturer")

    async def fake_get_by_id(db_session, user_id):
        return user

    monkeypatch.setattr(user_controller.user_repo, "get_by_id", fake_get_by_id)

    with pytest.raises(HTTPException) as exc_info:
        await update_user_controller("user-1", UpdateUserRequest(role="student"), session)

    assert exc_info.value.status_code == 400
    assert "Sinh viên tự đăng nhập" in exc_info.value.detail
    assert session.commits == 0
