"""Add user_id to flashcards and quizzes.

Revision ID: 0007_add_study_aid_user_id
Revises: 0006_add_token_usage_tracking
Create Date: 2026-10-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_add_study_aid_user_id"
down_revision: str | None = "0006_add_token_usage_tracking"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "flashcards" in tables:
        columns = {c["name"] for c in insp.get_columns("flashcards")}
        if "user_id" not in columns:
            op.add_column(
                "flashcards",
                sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
            )
            op.create_index("ix_flashcards_user_id", "flashcards", ["user_id"])

    if "quizzes" in tables:
        columns = {c["name"] for c in insp.get_columns("quizzes")}
        if "user_id" not in columns:
            op.add_column(
                "quizzes",
                sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
            )
            op.create_index("ix_quizzes_user_id", "quizzes", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "quizzes" in tables:
        columns = {c["name"] for c in insp.get_columns("quizzes")}
        if "user_id" in columns:
            op.drop_index("ix_quizzes_user_id", table_name="quizzes")
            op.drop_column("quizzes", "user_id")

    if "flashcards" in tables:
        columns = {c["name"] for c in insp.get_columns("flashcards")}
        if "user_id" in columns:
            op.drop_index("ix_flashcards_user_id", table_name="flashcards")
            op.drop_column("flashcards", "user_id")
