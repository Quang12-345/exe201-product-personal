from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api.controllers import auth_controller
from src.models import (
    ForgotPasswordRequest,
    GmailLoginRequest,
    LoginRequest,
    ResetPasswordRequest,
    VerifyOtpRequest,
)
from src.services.email_service import EmailDeliveryError


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class FakeSession:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1

    async def flush(self):
        return None


@pytest.mark.asyncio
async def test_login_allows_pending_user(monkeypatch):
    user = SimpleNamespace(
        id="user-1",
        email="user@example.com",
        username="user",
        full_name="User Name",
        phone_number=None,
        role=SimpleNamespace(name="student"),
        status="pending",
        password="hashed-password",
    )
    calls = {}

    async def fake_get_by_login(session, identifier):
        calls["identifier"] = identifier
        return user

    def fake_create_access_token(subject, claims):
        calls["subject"] = subject
        calls["claims"] = claims
        return "pending-login-jwt"

    monkeypatch.setattr(auth_controller.user_repo, "get_by_login", fake_get_by_login)
    monkeypatch.setattr(auth_controller, "verify_password", lambda plain, hashed: True)
    monkeypatch.setattr(auth_controller, "create_access_token", fake_create_access_token)

    response = await auth_controller.login_controller(
        LoginRequest(username=" USER@example.com ", password="Generated123!"),
        FakeSession(),
    )

    assert calls["identifier"] == "user@example.com"
    assert calls["subject"] == "user-1"
    assert calls["claims"] == {"email": "user@example.com", "role": "student"}
    assert response.token == "pending-login-jwt"
    assert response.user.status == "pending"


@pytest.mark.asyncio
async def test_gmail_login_verifies_google_token_and_returns_access_token(monkeypatch):
    user = SimpleNamespace(
        id="user-1",
        email="user@example.com",
        full_name="User Name",
        phone_number="0900000000",
        role=SimpleNamespace(name="student"),
        status="active",
    )
    calls = {}

    def fake_verify_google_id_token(credential):
        calls["credential"] = credential
        return {
            "email": " USER@Example.COM ",
            "name": "Google Name",
            "picture": "https://example.com/avatar.png",
        }

    async def fake_get_by_email(session, email):
        calls["email"] = email
        return user

    def fake_create_access_token(subject, claims):
        calls["subject"] = subject
        calls["claims"] = claims
        return "google-jwt"

    monkeypatch.setattr(auth_controller, "_verify_google_id_token", fake_verify_google_id_token)
    monkeypatch.setattr(auth_controller.user_repo, "get_by_email", fake_get_by_email)
    monkeypatch.setattr(auth_controller, "create_access_token", fake_create_access_token)

    response = await auth_controller.gmail_login_controller(
        GmailLoginRequest(credential="google-id-token"),
        FakeSession(),
    )

    assert calls["credential"] == "google-id-token"
    assert calls["email"] == "user@example.com"
    assert calls["subject"] == "user-1"
    assert calls["claims"] == {
        "user_id": "user-1",
        "email": "user@example.com",
        "role": "student",
        "name": "User Name",
        "login_provider": "google",
    }
    assert response.access_token == "google-jwt"
    assert response.token_type == "bearer"
    assert response.user.email == "user@example.com"
    assert response.user.role == "student"


@pytest.mark.asyncio
async def test_gmail_login_rejects_invalid_google_token(monkeypatch):
    def fake_verify_google_id_token(credential):
        raise HTTPException(status_code=401, detail="Google token không hợp lệ")

    monkeypatch.setattr(auth_controller, "_verify_google_id_token", fake_verify_google_id_token)

    with pytest.raises(HTTPException) as exc_info:
        await auth_controller.gmail_login_controller(
            GmailLoginRequest(credential="bad-token"),
            FakeSession(),
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Google token không hợp lệ"


@pytest.mark.asyncio
async def test_gmail_login_provisions_unknown_google_user_as_student(monkeypatch):
    session = FakeSession()
    created = {}

    def fake_verify_google_id_token(credential):
        return {"email": "sv@example.com", "name": "Sinh Vien", "picture": ""}

    async def fake_get_by_email(db_session, email):
        return created.get("user")

    async def fake_username_taken(db_session, username, *, exclude_id=None):
        return False

    async def fake_get_role_by_name(db_session, name):
        assert name == "student"
        return SimpleNamespace(id="role-student", name="student")

    async def fake_add(db_session, user):
        user.id = "new-student"
        created["user"] = user
        return user

    async def fake_reload_with_role(db_session, user_id):
        u = created["user"]
        return SimpleNamespace(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            phone_number=None,
            status="active",
            role=SimpleNamespace(id="role-student", name="student"),
        )

    monkeypatch.setattr(auth_controller, "_verify_google_id_token", fake_verify_google_id_token)
    monkeypatch.setattr(auth_controller.user_repo, "get_by_email", fake_get_by_email)
    monkeypatch.setattr(auth_controller.user_repo, "username_taken", fake_username_taken)
    monkeypatch.setattr(auth_controller.user_repo, "get_role_by_name", fake_get_role_by_name)
    monkeypatch.setattr(auth_controller.user_repo, "add", fake_add)
    monkeypatch.setattr(auth_controller.user_repo, "reload_with_role", fake_reload_with_role)
    monkeypatch.setattr(auth_controller, "create_access_token", lambda subject, claims: "student-jwt")

    response = await auth_controller.gmail_login_controller(
        GmailLoginRequest(credential="google-id-token"),
        session,
    )

    assert session.commits == 1
    assert response.access_token == "student-jwt"
    assert response.user.email == "sv@example.com"
    assert response.user.role == "student"
    assert response.user.name == "Sinh Vien"


@pytest.mark.asyncio
async def test_gmail_login_rejects_inactive_user(monkeypatch):
    user = SimpleNamespace(
        id="user-1",
        email="user@example.com",
        full_name="User Name",
        phone_number=None,
        role=None,
        status="inactive",
    )

    def fake_verify_google_id_token(credential):
        return {"email": "user@example.com", "name": "Google Name", "picture": ""}

    async def fake_get_by_email(session, email):
        return user

    monkeypatch.setattr(auth_controller, "_verify_google_id_token", fake_verify_google_id_token)
    monkeypatch.setattr(auth_controller.user_repo, "get_by_email", fake_get_by_email)

    with pytest.raises(HTTPException) as exc_info:
        await auth_controller.gmail_login_controller(
            GmailLoginRequest(credential="google-id-token"),
            FakeSession(),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Tài khoản đã bị vô hiệu hóa"


@pytest.mark.asyncio
async def test_gmail_login_allows_pending_user(monkeypatch):
    user = SimpleNamespace(
        id="user-1",
        email="user@example.com",
        full_name="User Name",
        phone_number=None,
        role=SimpleNamespace(name="student"),
        status="pending",
    )

    monkeypatch.setattr(
        auth_controller,
        "_verify_google_id_token",
        lambda credential: {"email": "user@example.com", "name": "Google Name", "picture": ""},
    )

    async def fake_get_by_email(session, email):
        return user

    monkeypatch.setattr(auth_controller.user_repo, "get_by_email", fake_get_by_email)
    monkeypatch.setattr(auth_controller, "create_access_token", lambda subject, claims: "pending-jwt")

    response = await auth_controller.gmail_login_controller(
        GmailLoginRequest(credential="google-id-token"),
        FakeSession(),
    )

    assert response.access_token == "pending-jwt"
    assert response.user.status == "pending"


@pytest.mark.asyncio
async def test_forgot_password_returns_404_when_email_missing(monkeypatch):
    async def fake_get_by_email(session, email):
        return None

    monkeypatch.setattr(auth_controller.user_repo, "get_by_email", fake_get_by_email)

    with pytest.raises(HTTPException) as exc_info:
        await auth_controller.forgot_password_controller(
            ForgotPasswordRequest(email="missing@example.com"),
            FakeSession(),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Email does not exist"


@pytest.mark.asyncio
async def test_forgot_password_rolls_back_when_email_service_fails(monkeypatch):
    session = FakeSession()
    user = SimpleNamespace(id="user-1", email="user@example.com")

    async def fake_get_by_email(db_session, email):
        return user

    async def fake_invalidate_active_for_email(db_session, email):
        return None

    async def fake_create(db_session, otp):
        return otp

    async def fake_send_otp_email(email, otp):
        raise EmailDeliveryError("connection failed")

    monkeypatch.setattr(auth_controller.user_repo, "get_by_email", fake_get_by_email)
    monkeypatch.setattr(
        auth_controller.password_reset_otp_repo,
        "invalidate_active_for_email",
        fake_invalidate_active_for_email,
    )
    monkeypatch.setattr(auth_controller.password_reset_otp_repo, "create", fake_create)
    monkeypatch.setattr(auth_controller, "generate_otp", lambda: "123456")
    monkeypatch.setattr(auth_controller, "send_otp_email", fake_send_otp_email)

    with pytest.raises(HTTPException) as exc_info:
        await auth_controller.forgot_password_controller(
            ForgotPasswordRequest(email="user@example.com"),
            session,
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Could not send OTP email"
    assert session.commits == 0
    assert session.rollbacks == 1


@pytest.mark.asyncio
async def test_verify_otp_wrong_code_increments_attempts(monkeypatch):
    session = FakeSession()
    otp = SimpleNamespace(
        email="user@example.com",
        otp_code="123456",
        expired_at=utcnow() + timedelta(minutes=5),
        attempts=0,
        is_used=False,
    )

    async def fake_get_latest_active_by_email(db_session, email):
        return otp

    monkeypatch.setattr(
        auth_controller.password_reset_otp_repo,
        "get_latest_active_by_email",
        fake_get_latest_active_by_email,
    )

    with pytest.raises(HTTPException) as exc_info:
        await auth_controller.verify_otp_controller(
            VerifyOtpRequest(email="user@example.com", otp_code="000000"),
            session,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "OTP is incorrect"
    assert otp.attempts == 1
    assert session.commits == 1


@pytest.mark.asyncio
async def test_reset_password_rejects_same_old_password(monkeypatch):
    session = FakeSession()
    otp = SimpleNamespace(
        user_id="user-1",
        email="user@example.com",
        otp_code="123456",
        expired_at=utcnow() + timedelta(minutes=5),
        attempts=0,
        is_used=False,
    )
    user = SimpleNamespace(
        id="user-1",
        email="user@example.com",
        password="old-hash",
    )

    async def fake_get_latest_active_by_email(db_session, email):
        return otp

    async def fake_get_by_id(db_session, user_id):
        return user

    monkeypatch.setattr(
        auth_controller.password_reset_otp_repo,
        "get_latest_active_by_email",
        fake_get_latest_active_by_email,
    )
    monkeypatch.setattr(auth_controller.user_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(auth_controller, "verify_password", lambda plain, password_hash: True)

    with pytest.raises(HTTPException) as exc_info:
        await auth_controller.reset_password_controller(
            ResetPasswordRequest(
                email="user@example.com",
                otp_code="123456",
                new_password="samepass",
            ),
            session,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "New password must be different from the old password"
    assert otp.is_used is False


@pytest.mark.asyncio
async def test_reset_password_rejects_short_password(monkeypatch):
    session = FakeSession()
    otp = SimpleNamespace(
        user_id="user-1",
        email="user@example.com",
        otp_code="123456",
        expired_at=utcnow() + timedelta(minutes=5),
        attempts=0,
        is_used=False,
    )
    user = SimpleNamespace(
        id="user-1",
        email="user@example.com",
        password="old-hash",
    )

    async def fake_get_latest_active_by_email(db_session, email):
        return otp

    async def fake_get_by_id(db_session, user_id):
        return user

    monkeypatch.setattr(
        auth_controller.password_reset_otp_repo,
        "get_latest_active_by_email",
        fake_get_latest_active_by_email,
    )
    monkeypatch.setattr(auth_controller.user_repo, "get_by_id", fake_get_by_id)

    with pytest.raises(HTTPException) as exc_info:
        await auth_controller.reset_password_controller(
            ResetPasswordRequest(
                email="user@example.com",
                otp_code="123456",
                new_password="short",
            ),
            session,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "New password must be at least 8 characters"
    assert otp.is_used is False


@pytest.mark.asyncio
async def test_reset_password_updates_hash_and_uses_otp(monkeypatch):
    session = FakeSession()
    otp = SimpleNamespace(
        user_id="user-1",
        email="user@example.com",
        otp_code="123456",
        expired_at=utcnow() + timedelta(minutes=5),
        attempts=0,
        is_used=False,
    )
    user = SimpleNamespace(
        id="user-1",
        email="user@example.com",
        password="old-hash",
    )

    async def fake_get_latest_active_by_email(db_session, email):
        return otp

    async def fake_get_by_id(db_session, user_id):
        return user

    monkeypatch.setattr(
        auth_controller.password_reset_otp_repo,
        "get_latest_active_by_email",
        fake_get_latest_active_by_email,
    )
    monkeypatch.setattr(auth_controller.user_repo, "get_by_id", fake_get_by_id)
    monkeypatch.setattr(auth_controller, "verify_password", lambda plain, password_hash: False)
    monkeypatch.setattr(auth_controller, "hash_password", lambda plain: f"hashed:{plain}")

    response = await auth_controller.reset_password_controller(
        ResetPasswordRequest(
            email="user@example.com",
            otp_code="123456",
            new_password="newpass123",
        ),
        session,
    )

    assert response.ok is True
    assert response.email == "user@example.com"
    assert user.password == "hashed:newpass123"
    assert otp.is_used is True
    assert session.commits == 1


# ----- Gmail login (Google OAuth) -----

@pytest.mark.asyncio
async def test_gmail_login_success(monkeypatch):
    from types import SimpleNamespace

    from src.models.auth import GmailLoginRequest

    user = SimpleNamespace(
        id="u-1", username="an", email="an@ai20k.vn", full_name="An",
        phone_number=None, status="active", role=SimpleNamespace(name="student"),
    )

    monkeypatch.setattr(auth_controller, "_verify_google_id_token", lambda cred: {"email": "AN@ai20k.vn", "name": "An"})

    async def fake_get_by_email(session, email):
        assert email == "an@ai20k.vn"  # đã chuẩn hoá lowercase
        return user

    monkeypatch.setattr(auth_controller.user_repo, "get_by_email", fake_get_by_email)
    monkeypatch.setattr(auth_controller, "create_access_token", lambda subject, claims=None: "tok-123")

    resp = await auth_controller.gmail_login_controller(GmailLoginRequest(credential="x"), None)
    assert resp.access_token == "tok-123"
    assert resp.user.email == "an@ai20k.vn"
    assert resp.user.role == "student"


@pytest.mark.asyncio
async def test_gmail_login_provisions_unknown_user(monkeypatch):
    from src.models.auth import GmailLoginRequest

    session = FakeSession()
    created = {}
    monkeypatch.setattr(auth_controller, "_verify_google_id_token", lambda cred: {"email": "ghost@x.com", "name": "Ghost"})

    async def fake_get_by_email(db_session, email):
        return created.get("user")

    async def fake_username_taken(db_session, username, *, exclude_id=None):
        return False

    async def fake_get_role_by_name(db_session, name):
        return SimpleNamespace(id="role-student", name="student")

    async def fake_add(db_session, user):
        user.id = "ghost-1"
        created["user"] = user
        return user

    async def fake_reload(db_session, user_id):
        u = created["user"]
        return SimpleNamespace(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            phone_number=None,
            status="active",
            role=SimpleNamespace(id="role-student", name="student"),
        )

    monkeypatch.setattr(auth_controller.user_repo, "get_by_email", fake_get_by_email)
    monkeypatch.setattr(auth_controller.user_repo, "username_taken", fake_username_taken)
    monkeypatch.setattr(auth_controller.user_repo, "get_role_by_name", fake_get_role_by_name)
    monkeypatch.setattr(auth_controller.user_repo, "add", fake_add)
    monkeypatch.setattr(auth_controller.user_repo, "reload_with_role", fake_reload)
    monkeypatch.setattr(auth_controller, "create_access_token", lambda subject, claims=None: "tok-new")

    resp = await auth_controller.gmail_login_controller(GmailLoginRequest(credential="x"), session)
    assert resp.user.role == "student"
    assert resp.user.email == "ghost@x.com"


@pytest.mark.asyncio
async def test_login_rejects_unverified_user(monkeypatch):
    user = SimpleNamespace(
        id="user-1",
        email="user@gmail.com",
        username="user",
        full_name="User Name",
        phone_number=None,
        role=SimpleNamespace(name="student"),
        status="unverified",
        password="hashed-password",
    )

    async def fake_get_by_login(session, identifier):
        return user

    monkeypatch.setattr(auth_controller.user_repo, "get_by_login", fake_get_by_login)
    monkeypatch.setattr(auth_controller, "verify_password", lambda plain, hashed: True)

    with pytest.raises(HTTPException) as exc_info:
        await auth_controller.login_controller(
            LoginRequest(username="user@gmail.com", password="secret123"),
            FakeSession(),
        )
    assert exc_info.value.status_code == 403
    assert "chưa xác nhận" in exc_info.value.detail

