"""Add flashcards, quizzes, quiz_questions, and user_quiz_attempts tables.

Revision ID: 0005_add_flashcards_and_quizzes
Revises: 0004_vnpay_and_chat_quota
Create Date: 2026-09-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_add_flashcards_and_quizzes"
down_revision: str | None = "0004_vnpay_and_chat_quota"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    try:
        existing_tables = set(sa.inspect(bind).get_table_names())
    except Exception:
        existing_tables = set()

    # 1. Flashcards table
    if "flashcards" not in existing_tables:
        op.create_table(
            "flashcards",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "document_id",
                sa.String(36),
                sa.ForeignKey("documents.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("front_text", sa.Text(), nullable=False),
            sa.Column("back_text", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )
        op.create_index("ix_flashcards_document_id", "flashcards", ["document_id"])

    # 2. Quizzes table
    if "quizzes" not in existing_tables:
        op.create_table(
            "quizzes",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "document_id",
                sa.String(36),
                sa.ForeignKey("documents.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )
        op.create_index("ix_quizzes_document_id", "quizzes", ["document_id"])

    # 3. Quiz Questions table
    if "quiz_questions" not in existing_tables:
        op.create_table(
            "quiz_questions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "quiz_id",
                sa.String(36),
                sa.ForeignKey("quizzes.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("question_text", sa.Text(), nullable=False),
            sa.Column("options", sa.JSON(), nullable=False),
            sa.Column("correct_answer", sa.String(255), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )
        op.create_index("ix_quiz_questions_quiz_id", "quiz_questions", ["quiz_id"])

    # 4. User Quiz Attempts table
    if "user_quiz_attempts" not in existing_tables:
        op.create_table(
            "user_quiz_attempts",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "quiz_id",
                sa.String(36),
                sa.ForeignKey("quizzes.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "student_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("score", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("answers", sa.JSON(), nullable=True),
            sa.Column(
                "completed_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )
        op.create_index("ix_user_quiz_attempts_quiz_id", "user_quiz_attempts", ["quiz_id"])
        op.create_index("ix_user_quiz_attempts_student_id", "user_quiz_attempts", ["student_id"])


def downgrade() -> None:
    op.drop_table("user_quiz_attempts")
    op.drop_table("quiz_questions")
    op.drop_table("quizzes")
    op.drop_table("flashcards")
