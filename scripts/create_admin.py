"""Seed/promote an admin user directly in the database.

API user-management endpoints require an admin token, so the very first admin
must be created out-of-band (bootstrap). Safe to re-run: an existing user with
the same email is promoted to admin and (optionally) gets a new password.

Usage:
    python scripts/create_admin.py --email admin@ai20k.vn --password secret123 --name "Vận hành"
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.core.security import hash_password
from src.db.models import Role, User
from src.db.session import AsyncSessionLocal, init_db


async def run(email: str, password: str, name: str) -> dict:
    await init_db()  # ensures tables + default roles (admin/student/lecture) exist
    email = email.strip().lower()
    async with AsyncSessionLocal() as session:
        role = (
            await session.execute(select(Role).where(Role.name == "admin"))
        ).scalar_one_or_none()
        if role is None:
            raise RuntimeError("Default 'admin' role missing; init_db should have seeded it.")

        user = (
            await session.execute(
                select(User).options(selectinload(User.role)).where(User.email == email)
            )
        ).scalar_one_or_none()

        if user is None:
            user = User(
                username=email.split("@", 1)[0],
                email=email,
                full_name=name.strip(),
                password=hash_password(password),  # cột password lưu HASH
                role_id=role.id,
                status="active",
            )
            session.add(user)
            action = "created"
        else:
            user.role_id = role.id
            user.status = "active"
            if password:
                user.password = hash_password(password)
            action = "promoted"

        await session.commit()
        await session.refresh(user)
        return {"action": action, "id": user.id, "email": user.email, "role": "admin"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Vận hành")
    args = parser.parse_args()

    result = asyncio.run(run(args.email, args.password, args.name))
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
