"""add plaintext password column to users

Revision ID: 0002_user_password
Revises: 0001_ai_rag_schema
Create Date: 2026-06-17

CẢNH BÁO: cột `password` lưu mật khẩu dạng thuần theo yêu cầu nội bộ.
Xác thực vẫn dựa trên `password_hash`. Không khuyến nghị cho production.
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0002_user_password"
down_revision: str | None = "0001_ai_rag_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password")
