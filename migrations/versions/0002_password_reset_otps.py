"""Create password reset OTP table.

Revision ID: 0002_password_reset_otps
Revises: 0001_ai_rag_schema
Create Date: 2026-06-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_password_reset_otps"
down_revision: str | None = "0001_ai_rag_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS password_reset_otps (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            otp_code VARCHAR(6) NOT NULL,
            expired_at TIMESTAMP NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            is_used BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_password_reset_otps_user_id ON password_reset_otps (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_password_reset_otps_email ON password_reset_otps (email);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_password_reset_otps_otp_code ON password_reset_otps (otp_code);")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("DROP TABLE IF EXISTS password_reset_otps;")
