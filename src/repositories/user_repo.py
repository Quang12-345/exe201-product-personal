"""Data-access helpers for User/Role. Keeps SQL out of the controllers."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Document, Role, User


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(
        select(User).options(selectinload(User.role)).where(User.email == email)
    )
    return result.scalar_one_or_none()


async def get_by_login(session: AsyncSession, identifier: str) -> User | None:
    """Tra cứu user theo username HOẶC email (cho đăng nhập)."""
    result = await session.execute(
        select(User)
        .options(selectinload(User.role))
        .where((User.username == identifier) | (User.email == identifier))
    )
    return result.scalars().first()


async def username_taken(session: AsyncSession, username: str, *, exclude_id: str | None = None) -> bool:
    stmt = select(User.id).where(User.username == username)
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none() is not None


async def get_by_id(session: AsyncSession, user_id: str) -> User | None:
    result = await session.execute(
        select(User).options(selectinload(User.role)).where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def list_all(session: AsyncSession, *, exclude_user_id: str | None = None) -> list[User]:
    stmt = select(User).options(selectinload(User.role)).order_by(User.created_at.desc())
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def email_taken(session: AsyncSession, email: str, *, exclude_id: str | None = None) -> bool:
    stmt = select(User.id).where(User.email == email)
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none() is not None


async def get_role_by_name(session: AsyncSession, name: str) -> Role | None:
    result = await session.execute(select(Role).where(Role.name == name))
    return result.scalar_one_or_none()


async def list_roles(session: AsyncSession) -> list[Role]:
    result = await session.execute(select(Role).order_by(Role.is_product.desc(), Role.code.asc()))
    return list(result.scalars().all())


async def add(session: AsyncSession, user: User) -> User:
    session.add(user)
    await session.flush()
    return user


async def delete(session: AsyncSession, user: User) -> None:
    await session.delete(user)
    await session.flush()


async def deactivate(session: AsyncSession, user: User) -> User:
    user.status = "deleted"
    await session.flush()
    return user


async def reload_with_role(session: AsyncSession, user_id: str) -> User:
    """Re-fetch a user with its role eagerly loaded after a write."""
    result = await session.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def count_documents_by_owner(session: AsyncSession, owner_id: str) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(Document)
        .where(Document.uploaded_by == owner_id)
    )
    return int(result.scalar_one() or 0)
