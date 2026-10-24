"""Security primitives: password hashing (bcrypt) and JWT issuance.

Kept framework-agnostic and free of DB/HTTP concerns so it can be reused by
controllers, dependencies, and CLI scripts without circular imports.
"""

from datetime import datetime, timedelta
from typing import Any

import bcrypt
from jose import jwt

from src.config import get_settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24


def hash_password(plain_password: str) -> str:
    # rounds=10 (~60ms) thay vì mặc định 12 (~250ms) → đăng nhập nhanh hơn,
    # vẫn an toàn cho ứng dụng web thông thường.
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(rounds=10),
    ).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(subject: str, claims: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    expire_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire_at,
        **(claims or {}),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)
