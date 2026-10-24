"""Add tokens_used to daily_chat_usage and tokens to chat_usage_events.

Revision ID: 0006_add_token_usage_tracking
Revises: 0005_add_flashcards_and_quizzes
Create Date: 2026-10-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_add_token_usage_tracking"
down_revision: str | None = "0005_add_flashcards_and_quizzes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "daily_chat_usage" in tables:
        columns = {c["name"] for c in insp.get_columns("daily_chat_usage")}
        if "tokens_used" not in columns:
            op.add_column(
                "daily_chat_usage",
                sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
            )

    if "chat_usage_events" in tables:
        columns = {c["name"] for c in insp.get_columns("chat_usage_events")}
        if "tokens" not in columns:
            op.add_column(
                "chat_usage_events",
                sa.Column("tokens", sa.Integer(), nullable=False, server_default="0"),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "chat_usage_events" in tables:
        columns = {c["name"] for c in insp.get_columns("chat_usage_events")}
        if "tokens" in columns:
            op.drop_column("chat_usage_events", "tokens")

    if "daily_chat_usage" in tables:
        columns = {c["name"] for c in insp.get_columns("daily_chat_usage")}
        if "tokens_used" in columns:
            op.drop_column("daily_chat_usage", "tokens_used")
