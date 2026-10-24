"""Add classrooms and document isolation.

Revision ID: 0008_add_classrooms
Revises: 0007_add_study_aid_user_id
Create Date: 2026-10-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_add_classrooms"
down_revision: str | None = "0007_add_study_aid_user_id"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    # 1. Tạo bảng classrooms
    if "classrooms" not in tables:
        op.create_table(
            "classrooms",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False, unique=True),
            sa.Column("subject", sa.String(length=255), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=True),
            sa.Column(
                "created_by",
                sa.String(length=36),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_classrooms_name", "classrooms", ["name"])
        op.create_index("ix_classrooms_code", "classrooms", ["code"])
        op.create_index("ix_classrooms_subject", "classrooms", ["subject"])

    # 2. Thêm cột classroom_id vào documents để cô lập tài liệu theo lớp
    if "documents" in tables:
        doc_cols = {c["name"] for c in insp.get_columns("documents")}
        if "classroom_id" not in doc_cols:
            op.add_column(
                "documents",
                sa.Column(
                    "classroom_id",
                    sa.String(length=36),
                    sa.ForeignKey("classrooms.id", ondelete="CASCADE"),
                    nullable=True,
                ),
            )
            op.create_index("ix_documents_classroom_id", "documents", ["classroom_id"])

    # 3. Thêm cột classroom_id vào students
    if "students" in tables:
        stu_cols = {c["name"] for c in insp.get_columns("students")}
        if "classroom_id" not in stu_cols:
            op.add_column(
                "students",
                sa.Column(
                    "classroom_id",
                    sa.String(length=36),
                    sa.ForeignKey("classrooms.id", ondelete="SET NULL"),
                    nullable=True,
                ),
            )
            op.create_index("ix_students_classroom_id", "students", ["classroom_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "students" in tables:
        stu_cols = {c["name"] for c in insp.get_columns("students")}
        if "classroom_id" in stu_cols:
            op.drop_index("ix_students_classroom_id", table_name="students")
            op.drop_column("students", "classroom_id")

    if "documents" in tables:
        doc_cols = {c["name"] for c in insp.get_columns("documents")}
        if "classroom_id" in doc_cols:
            op.drop_index("ix_documents_classroom_id", table_name="documents")
            op.drop_column("documents", "classroom_id")

    if "classrooms" in tables:
        op.drop_index("ix_classrooms_subject", table_name="classrooms")
        op.drop_index("ix_classrooms_code", table_name="classrooms")
        op.drop_index("ix_classrooms_name", table_name="classrooms")
        op.drop_table("classrooms")
