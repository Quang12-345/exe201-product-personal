"""add username, consolidate password (drop password_hash)

Revision ID: 0003_username_and_password
Revises: 0002_user_password
Create Date: 2026-06-18

- Thêm cột `username` (unique) + backfill từ phần trước @ của email.
- Copy `password_hash` → `password` (password từ nay lưu HASH) rồi DROP `password_hash`.
"""

from alembic import op

revision: str = "0003_username_and_password"
down_revision: str | None = "0002_user_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(150)")
    op.execute(
        "UPDATE users SET username = split_part(email, '@', 1) "
        "WHERE username IS NULL OR username = ''"
    )
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)")
    # password (đang lưu plaintext từ 0002) -> ghi đè bằng hash, rồi bỏ cột hash cũ
    op.execute(
        "UPDATE users SET password = password_hash "
        "WHERE password_hash IS NOT NULL"
    )
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS password_hash")


def downgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)")
    op.execute("UPDATE users SET password_hash = password")
    op.execute("DROP INDEX IF EXISTS ix_users_username")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS username")
