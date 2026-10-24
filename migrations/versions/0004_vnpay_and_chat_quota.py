"""Add VNPay subscriptions, payment transactions, and daily chat quotas.

Revision ID: 0004_vnpay_and_chat_quota
Revises: 0004_vnpay_payments, 0003_username_and_password
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_vnpay_and_chat_quota"
down_revision: str | None = "0004_vnpay_payments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())
    if "payments" in existing_tables:
        op.drop_table("payments")

    if "daily_chat_usage" not in existing_tables:
        op.create_table(
        "daily_chat_usage",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_daily_chat_usage_user_date"),
        )
        op.create_index("ix_daily_chat_usage_user_id", "daily_chat_usage", ["user_id"])
        op.create_index("ix_daily_chat_usage_usage_date", "daily_chat_usage", ["usage_date"])

    if "chat_usage_events" not in existing_tables:
        op.create_table(
        "chat_usage_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("request_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("user_id", "usage_date", "request_id", name="uq_chat_usage_user_day_request"),
        )
        op.create_index("ix_chat_usage_events_user_id", "chat_usage_events", ["user_id"])
        op.create_index("ix_chat_usage_events_usage_date", "chat_usage_events", ["usage_date"])

    if "subscriptions" not in existing_tables:
        op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_code", sa.String(32), nullable=False, server_default="pro"),
        sa.Column("status", sa.String(32), nullable=False, server_default="inactive"),
        sa.Column("starts_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("user_id", name="uq_subscriptions_user_id"),
        )
        op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
        op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
        op.create_index("ix_subscriptions_expires_at", "subscriptions", ["expires_at"])

    if "payment_transactions" not in existing_tables:
        op.create_table(
        "payment_transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_code", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="VND"),
        sa.Column("provider", sa.String(32), nullable=False, server_default="vnpay"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("payment_link_id", sa.String(100), nullable=True),
        sa.Column("checkout_url", sa.Text(), nullable=True),
        sa.Column("transaction_ref", sa.String(255), nullable=True),
        sa.Column("raw_webhook", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_payment_transactions_user_id", "payment_transactions", ["user_id"])
        op.create_index("ix_payment_transactions_order_code", "payment_transactions", ["order_code"])
        op.create_index("ix_payment_transactions_status", "payment_transactions", ["status"])


def downgrade() -> None:
    op.drop_table("payment_transactions")
    op.drop_table("subscriptions")
    op.drop_table("chat_usage_events")
    op.drop_table("daily_chat_usage")