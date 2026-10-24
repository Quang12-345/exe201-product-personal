"""Compatibility marker for databases stamped with the retired payment migration.

Revision ID: 0004_vnpay_payments
Revises: 0002_password_reset_otps

The legacy ``payments`` table is removed by 0004_vnpay_and_chat_quota.
"""

from collections.abc import Sequence

revision: str = "0004_vnpay_payments"
down_revision: str | tuple[str, str] | None = (
    "0002_password_reset_otps",
    "0003_username_and_password",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass