"""Catalog vai trò — nguồn sự thật cho bảng `roles`.

Sản phẩm chỉ có GV (giảng viên) và SV (sinh viên).
`admin` (OPS) là tài khoản vận hành/dev, không phải persona sản phẩm.
"""

from __future__ import annotations

from dataclasses import dataclass
from unicodedata import combining, normalize

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Role, User


@dataclass(frozen=True)
class RoleSpec:
    id: str
    name: str
    code: str
    display_name: str
    description: str
    is_product: bool
    is_assignable: bool


DEFAULT_ROLES: tuple[RoleSpec, ...] = (
    RoleSpec(
        id="00000000-0000-0000-0000-000000000003",
        name="lecturer",
        code="GV",
        display_name="Giảng viên",
        description="Tải lên và hỏi đáp tài liệu môn học.",
        is_product=True,
        is_assignable=True,
    ),
    RoleSpec(
        id="00000000-0000-0000-0000-000000000002",
        name="student",
        code="SV",
        display_name="Sinh viên",
        description="Hỏi đáp RAG, kho tài liệu và hạn mức chat. Tự đăng nhập bằng Gmail.",
        is_product=True,
        is_assignable=False,
    ),
    RoleSpec(
        id="00000000-0000-0000-0000-000000000001",
        name="admin",
        code="OPS",
        display_name="Vận hành",
        description="Console nội bộ: toàn quyền dữ liệu. Không cấp qua giao diện sản phẩm.",
        is_product=False,
        is_assignable=False,
    ),
)

PRODUCT_ROLE_NAMES = frozenset(spec.name for spec in DEFAULT_ROLES if spec.is_product)
ASSIGNABLE_ROLE_NAMES = frozenset(spec.name for spec in DEFAULT_ROLES if spec.is_assignable)
CANONICAL_ROLE_NAMES = frozenset(spec.name for spec in DEFAULT_ROLES)

_ROLE_BY_NAME = {spec.name: spec for spec in DEFAULT_ROLES}

_ROLE_ALIASES = {
    "lecturer": "lecturer",
    "lecture": "lecturer",
    "gv": "lecturer",
    "giang vien": "lecturer",
    "teacher": "lecturer",
    "student": "student",
    "sv": "student",
    "sinh vien": "student",
    "admin": "admin",
    "ops": "admin",
    "van hanh": "admin",
}


def _fold(value: str) -> str:
    stripped = "".join(ch for ch in normalize("NFKD", value) if not combining(ch))
    return " ".join(stripped.lower().split())


def normalize_role_name(role: str | None) -> str | None:
    if not role:
        return None
    folded = _fold(role)
    return _ROLE_ALIASES.get(folded) or None


def role_display_name(role: str | None) -> str:
    spec = _ROLE_BY_NAME.get(role or "")
    if spec is not None:
        return spec.display_name
    if not role or role == "unknown":
        return _ROLE_BY_NAME["student"].display_name
    return role


def is_assignable_role(role: str | None) -> bool:
    return role in ASSIGNABLE_ROLE_NAMES


def _spec_values(spec: RoleSpec) -> dict:
    return {
        "code": spec.code,
        "display_name": spec.display_name,
        "description": spec.description,
        "is_product": spec.is_product,
        "is_assignable": spec.is_assignable,
    }


async def _remap_legacy_lecture(session: AsyncSession) -> None:
    legacy = (
        await session.execute(select(Role).where(Role.name == "lecture"))
    ).scalar_one_or_none()
    if legacy is None:
        return

    lecturer = (
        await session.execute(select(Role).where(Role.name == "lecturer"))
    ).scalar_one_or_none()
    if lecturer is None:
        legacy.name = "lecturer"
        for key, value in _spec_values(_ROLE_BY_NAME["lecturer"]).items():
            setattr(legacy, key, value)
        return

    await session.execute(
        update(User).where(User.role_id == legacy.id).values(role_id=lecturer.id)
    )
    await session.delete(legacy)


async def sync_roles(session: AsyncSession) -> None:
    """Idempotent: remap role cũ, upsert catalog GV/SV/OPS."""
    await _remap_legacy_lecture(session)
    existing = {
        row.name: row
        for row in (await session.execute(select(Role))).scalars().all()
    }
    for spec in DEFAULT_ROLES:
        row = existing.get(spec.name)
        if row is None:
            session.add(
                Role(
                    id=spec.id,
                    name=spec.name,
                    **_spec_values(spec),
                )
            )
            continue
        for key, value in _spec_values(spec).items():
            setattr(row, key, value)
    await session.flush()
