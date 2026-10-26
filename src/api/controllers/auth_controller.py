import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.security import create_access_token, hash_password, verify_password
from src.db.models import PasswordResetOtp, User
from src.models.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GmailLoginRequest,
    GmailLoginResponse,
    LoginRequest,
    LoginResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from src.models.user import LoginUser
from src.repositories import password_reset_otp_repo, user_repo
from src.services.email_service import (
    EmailConfigError,
    EmailDeliveryError,
    EmailRecipientError,
    generate_otp,
    send_otp_email,
)

OTP_EXPIRE_MINUTES = 5
MAX_OTP_ATTEMPTS = 5
GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}
UNVERIFIED_STATUS = "unverified"


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _role_name(user, *, default: str | None = None) -> str | None:
    return user.role.name if getattr(user, "role", None) else default


def _display_name(user) -> str:
    return getattr(user, "name", None) or user.full_name


def _build_login_user(user, role_name: str | None) -> LoginUser:
    return LoginUser(
        id=str(user.id),
        username=getattr(user, "username", None) or user.email,
        email=user.email,
        name=_display_name(user),
        role=role_name,
        phone=getattr(user, "phone", None) or user.phone_number,
        status=user.status,
    )


async def _unique_username(session: AsyncSession, email: str) -> str:
    base = (email.split("@", 1)[0].strip().lower() or "user")[:140]
    candidate = base
    suffix = 1
    while await user_repo.username_taken(session, candidate):
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate


def _normalize_gmail(email: str) -> str:
    normalized = email.strip().lower()
    domain = normalized.rsplit("@", 1)[-1] if "@" in normalized else ""
    if domain not in GMAIL_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ chấp nhận đăng ký bằng địa chỉ Gmail",
        )
    return normalized


def _map_email_send_error(exc: Exception) -> HTTPException:
    if isinstance(exc, EmailRecipientError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient email address is invalid or refused",
        )
    if isinstance(exc, EmailConfigError):
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email service is misconfigured",
        )
    if isinstance(exc, EmailDeliveryError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send OTP email",
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not save OTP",
    )


async def _issue_and_send_otp(session: AsyncSession, user: User, email: str, send_fn) -> None:
    otp_code = generate_otp()
    try:
        await password_reset_otp_repo.invalidate_active_for_email(session, email)
        otp = PasswordResetOtp(
            user_id=user.id,
            email=email,
            otp_code=otp_code,
            expired_at=_utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
        )
        await password_reset_otp_repo.create(session, otp)
        await send_fn(email, otp_code)
        await session.commit()
    except (EmailRecipientError, EmailConfigError, EmailDeliveryError, SQLAlchemyError) as exc:
        await session.rollback()
        mapped = _map_email_send_error(exc)
        if isinstance(exc, SQLAlchemyError):
            mapped = HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not save OTP",
            )
        raise mapped from exc


async def _provision_student_from_google(
    session: AsyncSession,
    *,
    email: str,
    full_name: str | None,
) -> User:
    student_role = await user_repo.get_role_by_name(session, "student")
    if student_role is None and session is not None and hasattr(session, "execute"):
        from src.db.roles import sync_roles

        await sync_roles(session)
        student_role = await user_repo.get_role_by_name(session, "student")

    display_name = (str(full_name or "").strip() or email.split("@", 1)[0]).strip()
    username = await _unique_username(session, email)
    user = User(
        username=username,
        email=email,
        password=hash_password(secrets.token_urlsafe(24)),
        full_name=display_name[:255],
        role_id=student_role.id if student_role else None,
        status="active",
    )
    try:
        await user_repo.add(session, user)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        existing = await user_repo.get_by_email(session, email)
        if existing is not None:
            return existing
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Không thể tạo tài khoản sinh viên",
        ) from exc

    created = await user_repo.reload_with_role(session, user.id)
    return created if created is not None else user


def _verify_google_id_token(credential: str) -> dict:
    settings = get_settings()
    client_id = (settings.google_client_id or "").strip()
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_CLIENT_ID chưa được cấu hình trên máy chủ.",
        )

    try:
        return id_token.verify_oauth2_token(
            credential,
            requests.Request(),
            client_id,
            clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token không hợp lệ hoặc đã hết hạn",
        ) from exc


async def login_controller(request: LoginRequest, session: AsyncSession) -> LoginResponse:
    identifier = request.username.strip().lower()
    # Cho phép đăng nhập bằng username HOẶC email.
    user = await user_repo.get_by_login(session, identifier)

    if user is None or not verify_password(request.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if user.status == UNVERIFIED_STATUS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản chưa xác nhận email. Vui lòng nhập mã OTP đã gửi.",
        )

    if user.status not in {"active", "pending"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )

    role_name = _role_name(user)
    token = create_access_token(
        subject=str(user.id),
        claims={"email": user.email, "role": role_name},
    )

    return LoginResponse(
        token=token,
        user=_build_login_user(user, role_name),
    )


async def gmail_login_controller(
    request: GmailLoginRequest,
    session: AsyncSession,
) -> GmailLoginResponse:
    google_user = _verify_google_id_token(request.credential)
    email = str(google_user.get("email") or "").strip().lower()
    _name = google_user.get("name")
    _picture = google_user.get("picture")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token không hợp lệ",
        )

    user = await user_repo.get_by_email(session, email)
    if user is None:
        user = await _provision_student_from_google(session, email=email, full_name=_name)
    elif user.status == UNVERIFIED_STATUS:
        user.status = "active"
        await session.commit()

    if user.status not in {"active", "pending"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa",
        )

    # Đảm bảo user có role_id và role được gán đầy đủ trong DB
    if (
        getattr(user, "role", None) is None
        and getattr(user, "role_id", None) is None
        and session is not None
        and hasattr(session, "execute")
    ):
        student_role = await user_repo.get_role_by_name(session, "student")
        if student_role is None:
            from src.db.roles import sync_roles

            await sync_roles(session)
            student_role = await user_repo.get_role_by_name(session, "student")
        if student_role:
            user.role_id = student_role.id
            if hasattr(session, "commit"):
                await session.commit()
            if hasattr(user_repo, "reload_with_role"):
                user = await user_repo.reload_with_role(session, user.id)

    role_name = _role_name(user, default="student")
    name = _display_name(user)
    token = create_access_token(
        subject=str(user.id),
        claims={
            "user_id": str(user.id),
            "email": user.email,
            "role": role_name,
            "name": name,
            "login_provider": "google",
        },
    )

    return GmailLoginResponse(
        access_token=token,
        token=token,
        user=_build_login_user(user, role_name),
    )

async def forgot_password_controller(
    request: ForgotPasswordRequest,
    session: AsyncSession,
) -> ForgotPasswordResponse:
    email = request.email.strip().lower()
    user = await user_repo.get_by_email(session, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email does not exist",
        )

    await _issue_and_send_otp(session, user, email, send_otp_email)

    return ForgotPasswordResponse(
        ok=True,
        email=email,
        message="OTP has been sent to your email. It expires in 5 minutes.",
    )


async def verify_otp_controller(
    request: VerifyOtpRequest,
    session: AsyncSession,
) -> VerifyOtpResponse:
    email = request.email.strip().lower()
    await _validate_otp(session, email, request.otp_code.strip())
    await session.commit()

    return VerifyOtpResponse(
        ok=True,
        email=email,
        message="OTP is valid.",
    )


async def reset_password_controller(
    request: ResetPasswordRequest,
    session: AsyncSession,
) -> ResetPasswordResponse:
    email = request.email.strip().lower()
    otp = await _validate_otp(session, email, request.otp_code.strip())
    user = await user_repo.get_by_id(session, otp.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not exist",
        )

    new_password = request.new_password
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters",
        )
    if verify_password(new_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the old password",
        )

    user.password = hash_password(new_password)  # cột password lưu HASH
    otp.is_used = True
    await session.commit()

    return ResetPasswordResponse(
        ok=True,
        email=email,
        message="Password has been reset successfully.",
    )


async def _validate_otp(session: AsyncSession, email: str, otp_code: str) -> PasswordResetOtp:
    otp = await password_reset_otp_repo.get_latest_active_by_email(session, email)
    if otp is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP is invalid or has already been used",
        )

    if otp.expired_at < _utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP is expired",
        )

    if otp.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum OTP attempts exceeded",
        )

    if otp.otp_code != otp_code:
        otp.attempts += 1
        await session.commit()
        if otp.attempts >= MAX_OTP_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Maximum OTP attempts exceeded",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP is incorrect",
        )

    return otp
