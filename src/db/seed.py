"""Seed tài khoản demo (dùng chung cho script CLI và auto-seed lúc khởi động).

Idempotent: tài khoản đã có (theo email) sẽ được cập nhật tại chỗ.
"""

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.core.security import hash_password
from src.db.models import Role, User
from src.db.roles import sync_roles
from src.db.session import AsyncSessionLocal, init_db

DEMO_USERS = [
    {"username": "admin", "email": "admin@ai20k.vn", "password": "admin123", "name": "Vận hành", "role": "admin"},
    {"username": "lecturer", "email": "lecturer@ai20k.vn", "password": "lecturer123", "name": "Giảng Viên Demo", "role": "lecturer"},
    {"username": "student", "email": "student@ai20k.vn", "password": "student123", "name": "Sinh Viên Demo", "role": "student"},
]


async def seed_demo_accounts(*, ensure_schema: bool = True) -> list[dict]:
    if ensure_schema:
        await init_db()  # tạo bảng + roles mặc định nếu chưa có
    results: list[dict] = []
    async with AsyncSessionLocal() as session:
        await sync_roles(session)
        roles = {r.name: r for r in (await session.execute(select(Role))).scalars().all()}

        for spec in DEMO_USERS:
            role = roles.get(spec["role"])
            user = (
                await session.execute(
                    select(User).options(selectinload(User.role)).where(User.email == spec["email"])
                )
            ).scalar_one_or_none()

            if user is None:
                user = User(
                    username=spec["username"],
                    email=spec["email"],
                    full_name=spec["name"],
                    password=hash_password(spec["password"]),  # cột password lưu HASH
                    role_id=role.id if role else None,
                    status="active",
                )
                session.add(user)
                action = "created"
            else:
                user.username = spec["username"]
                user.full_name = spec["name"]
                user.password = hash_password(spec["password"])
                user.role_id = role.id if role else None
                user.status = "active"
                action = "updated"
            results.append({"email": spec["email"], "role": spec["role"], "action": action})

        await session.commit()
    return results
