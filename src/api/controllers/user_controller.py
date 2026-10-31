import logging
import secrets
import string
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.security import hash_password, verify_password
from src.db.models import Subscription, User
from src.db.roles import is_assignable_role, normalize_role_name, role_display_name
from src.models.user import (
    ChangePasswordRequest,
    CreateUserRequest,
    RoleResponse,
    UpdateUserRequest,
    UserResponse,
)
from src.repositories import user_repo
from src.services.email_service import (
    EmailConfigError,
    EmailDeliveryError,
    EmailRecipientError,
    send_account_created_email,
)

PASSWORD_ALPHABET = string.ascii_letters + string.digits + "!@#$%&*"
ASSIGN_ROLE_BLOCKED_DETAIL = (
    "Chỉ được cấp tài khoản giảng viên (GV). "
    "Sinh viên tự đăng nhập bằng Gmail. Tài khoản vận hành không tạo qua API."
)
logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def generate_initial_password(length: int = 12) -> str:
    return "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))


async def build_user_response(
    session: AsyncSession,
    user: User,
    *,
    include_document_count: bool = False,
    subscription: Subscription | None = None,
) -> UserResponse:
    user_role = getattr(user, "role", None)
    document_count = 0
    if include_document_count:
        document_count = await user_repo.count_documents_by_owner(session, user.id)
    role_name = user_role.name if user_role else None

    # Resolve subscription & plan
    sub = subscription
    now_utc = _utc_now()
    if sub is None and hasattr(session, "execute"):
        try:
            res = await session.execute(
                select(Subscription).where(
                    Subscription.user_id == user.id,
                    Subscription.status == "active",
                    Subscription.expires_at > now_utc,
                )
            )
            if hasattr(res, "scalar_one_or_none"):
                sub = res.scalar_one_or_none()
            elif hasattr(res, "scalars"):
                sub = res.scalars().first()
            else:
                sub = None
        except Exception:
            sub = None

    has_active_sub = (
        sub is not None
        and sub.status == "active"
        and (sub.expires_at is None or sub.expires_at > now_utc)
    )

    if role_name == "student":
        plan = "pro" if has_active_sub else "free"
        is_pro = has_active_sub
        sub_expires = sub.expires_at if has_active_sub else None
    else:
        plan = "staff"
        is_pro = True
        sub_expires = sub.expires_at if (sub and sub.status == "active") else None

    return UserResponse(
        id=user.id,
        username=getattr(user, "username", None) or user.email,
        email=user.email,
        name=user.full_name,
        roleID=user_role.id if user_role else getattr(user, "role_id", None),
        roleName=role_name,
        roleCode=getattr(user_role, "code", None) if user_role else None,
        roleLabel=(
            getattr(user_role, "display_name", None)
            or role_display_name(role_name)
            if user_role or role_name
            else None
        ),
        phone=user.phone_number,
        status=user.status,
        documentCount=document_count,
        joinedAt=getattr(user, "created_at", None),
        plan=plan,
        isPro=is_pro,
        subscriptionExpiresAt=sub_expires,
    )


async def list_users_controller(
    session: AsyncSession,
    *,
    current_user: User | None = None,
) -> list[UserResponse]:
    users = await user_repo.list_all(
        session,
        exclude_user_id=current_user.id if current_user is not None else None,
    )
    sub_map = {}
    if hasattr(session, "execute"):
        try:
            now_utc = _utc_now()
            sub_res = await session.execute(
                select(Subscription).where(
                    Subscription.status == "active",
                    Subscription.expires_at > now_utc,
                )
            )
            sub_map = {s.user_id: s for s in sub_res.scalars().all()}
        except Exception:
            sub_map = {}
    return [
        await build_user_response(session, user, subscription=sub_map.get(user.id))
        for user in users
    ]


async def get_user_by_id_controller(user_id: str, session: AsyncSession) -> UserResponse:
    user = await user_repo.get_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not exist",
        )
    return await build_user_response(session, user, include_document_count=True)


async def list_roles_controller(session: AsyncSession) -> list[RoleResponse]:
    roles = await user_repo.list_roles(session)
    return [
        RoleResponse(
            id=role.id,
            name=role.name,
            code=role.code,
            displayName=role.display_name or role_display_name(role.name),
            description=role.description or "",
            isProduct=bool(role.is_product),
            isAssignable=bool(role.is_assignable),
        )
        for role in roles
    ]


async def _resolve_role_id(session: AsyncSession, role: str | None) -> str | None:
    role_name = normalize_role_name(role) if role else None
    if not role_name:
        return None
    db_role = await user_repo.get_role_by_name(session, role_name)
    if db_role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role does not exist",
        )
    return db_role.id


async def create_user_controller(request: CreateUserRequest, session: AsyncSession) -> UserResponse:
    email = request.email.strip().lower()
    if await user_repo.email_taken(session, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists",
        )

    # username: dùng giá trị gửi lên, nếu trống thì lấy phần trước @ của email.
    username = (getattr(request, "username", None) or email.split("@", 1)[0]).strip().lower()
    if await user_repo.username_taken(session, username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    if request.role:
        role_name = normalize_role_name(request.role)
        if role_name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role does not exist",
            )
    else:
        role_name = "lecturer"
    if not is_assignable_role(role_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ASSIGN_ROLE_BLOCKED_DETAIL,
        )
    role_id = await _resolve_role_id(session, role_name)
    initial_password = request.password or generate_initial_password()
    user = User(
        username=username,
        email=email,
        phone_number=request.phone,
        password=hash_password(initial_password),  # cột password lưu HASH
        full_name=request.name.strip(),
        role_id=role_id,
        status="pending",
    )
    await user_repo.add(session, user)

    # Tạm thời vô hiệu hóa bắt buộc gửi email để admin tạo tài khoản giảng viên không bị chặn lỗi email cấu hình
    try:
        await send_account_created_email(email, username, initial_password)
    except Exception as exc:
        logger.warning(
            "Tạm thời bỏ qua lỗi gửi email tài khoản (%s) — tài khoản %s vẫn được tạo thành công với mật khẩu: %s",
            exc,
            username,
            initial_password,
        )

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists",
        ) from exc
    created_user = await user_repo.reload_with_role(session, user.id)
    response = await build_user_response(session, created_user, include_document_count=True)
    response.initialPassword = initial_password
    return response


async def delete_user_controller(user_id: str, session: AsyncSession, current_user: User) -> dict:
    user = await user_repo.get_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not exist",
        )
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tự xóa tài khoản của chính mình",
        )
    await user_repo.deactivate(session, user)
    await session.commit()
    return {"id": user_id, "deleted": True, "deactivated": True, "status": user.status}


async def update_user_controller(
    user_id: str,
    request: UpdateUserRequest,
    session: AsyncSession,
) -> UserResponse:
    user = await user_repo.get_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not exist",
        )

    updated_fields = request.model_fields_set

    if "email" in updated_fields and request.email is not None:
        email = request.email.strip().lower()
        if await user_repo.email_taken(session, email, exclude_id=user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )
        user.email = email

    if "name" in updated_fields and request.name is not None:
        user.full_name = request.name.strip()

    if "phone" in updated_fields:
        user.phone_number = request.phone

    if "username" in updated_fields and getattr(request, "username", None):
        new_username = request.username.strip().lower()
        if await user_repo.username_taken(session, new_username, exclude_id=user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            )
        user.username = new_username

    if "password" in updated_fields and request.password is not None:
        user.password = hash_password(request.password)  # cột password lưu HASH

    if "status" in updated_fields and request.status is not None:
        user.status = request.status.strip()

    if "role" in updated_fields:
        new_role = normalize_role_name(request.role)
        if new_role is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role does not exist",
            )
        current_role = user.role.name if getattr(user, "role", None) else None
        if new_role == "student" and current_role != "student":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ASSIGN_ROLE_BLOCKED_DETAIL,
            )
        user.role_id = await _resolve_role_id(session, new_role)

    if "plan" in updated_fields and request.plan is not None:
        now_utc = _utc_now()
        plan_target = request.plan.strip().lower()
        sub_res = await session.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = sub_res.scalar_one_or_none()
        if plan_target == "pro":
            if sub is None:
                sub = Subscription(
                    user_id=user_id,
                    plan_code="pro",
                    status="active",
                    starts_at=now_utc,
                    expires_at=now_utc + timedelta(days=30),
                )
                session.add(sub)
            else:
                base_time = sub.expires_at if sub.expires_at and sub.expires_at > now_utc else now_utc
                sub.plan_code = "pro"
                sub.status = "active"
                sub.starts_at = now_utc
                sub.expires_at = base_time + timedelta(days=30)
                sub.updated_at = now_utc
        elif plan_target == "free":
            if sub is not None:
                sub.status = "inactive"
                sub.expires_at = now_utc
                sub.updated_at = now_utc

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists",
        ) from exc

    updated_user = await user_repo.reload_with_role(session, user_id)
    return await build_user_response(session, updated_user, include_document_count=True)


async def revoke_user_pro_controller(session: AsyncSession, user_id: str) -> UserResponse:
    user = await user_repo.get_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not exist",
        )
    now_utc = _utc_now()
    res = await session.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    sub = res.scalar_one_or_none()
    if sub:
        sub.status = "inactive"
        sub.expires_at = now_utc
        sub.updated_at = now_utc
        await session.commit()

    updated_user = await user_repo.reload_with_role(session, user_id)
    return await build_user_response(session, updated_user, include_document_count=True)


async def grant_user_pro_controller(
    session: AsyncSession, user_id: str, days: int = 30
) -> UserResponse:
    user = await user_repo.get_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not exist",
        )
    now_utc = _utc_now()
    res = await session.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    sub = res.scalar_one_or_none()
    if sub is None:
        sub = Subscription(
            user_id=user_id,
            plan_code="pro",
            status="active",
            starts_at=now_utc,
            expires_at=now_utc + timedelta(days=days),
        )
        session.add(sub)
    else:
        base_time = sub.expires_at if sub.expires_at and sub.expires_at > now_utc else now_utc
        sub.plan_code = "pro"
        sub.status = "active"
        sub.starts_at = now_utc
        sub.expires_at = base_time + timedelta(days=days)
        sub.updated_at = now_utc
    await session.commit()

    updated_user = await user_repo.reload_with_role(session, user_id)
    return await build_user_response(session, updated_user, include_document_count=True)


async def change_my_password_controller(
    request: ChangePasswordRequest, session: AsyncSession, user: User
) -> dict:
    """Đổi mật khẩu của chính mình: xác nhận mật khẩu hiện tại rồi mới cập nhật.

    Đây là thao tác DUY NHẤT user thường được tự thực hiện với tài khoản —
    các thông tin khác (tên, email, lớp, khoa...) chỉ quản trị viên được sửa.
    """
    db_user = await user_repo.get_by_id(session, user.id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
    if not verify_password(request.current_password, db_user.password):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng.")
    if request.current_password == request.new_password:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải khác mật khẩu hiện tại.")
    db_user.password = hash_password(request.new_password)
    await session.commit()
    return {"ok": True, "message": "Đã đổi mật khẩu thành công."}
