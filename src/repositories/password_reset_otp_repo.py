from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import PasswordResetOtp


async def create(session: AsyncSession, otp: PasswordResetOtp) -> PasswordResetOtp:
    session.add(otp)
    await session.flush()
    return otp


async def get_latest_active_by_email(session: AsyncSession, email: str) -> PasswordResetOtp | None:
    result = await session.execute(
        select(PasswordResetOtp)
        .where(PasswordResetOtp.email == email, PasswordResetOtp.is_used.is_(False))
        .order_by(PasswordResetOtp.created_at.desc())
    )
    return result.scalars().first()


async def invalidate_active_for_email(session: AsyncSession, email: str) -> None:
    await session.execute(
        update(PasswordResetOtp)
        .where(PasswordResetOtp.email == email, PasswordResetOtp.is_used.is_(False))
        .values(is_used=True)
    )
