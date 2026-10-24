from src.db.models import Conversation, Document, DocumentChunk, DocumentView, Message, Role, User


def test_user_and_role_schema_columns():
    role_columns = set(Role.__table__.columns.keys())
    user_columns = set(User.__table__.columns.keys())

    assert {"id", "name", "created_at"} <= role_columns
    assert {
        "id",
        "username",
        "email",
        "phone_number",
        "password",
        "full_name",
        "role_id",
        "status",
        "created_at",
    } <= user_columns
    assert "password_hash" not in user_columns


def test_document_schema_columns():
    columns = set(Document.__table__.columns.keys())

    assert {
        "id",
        "uploaded_by",
        "title",
        "file_name",
        "file_type",
        "storage_path",
        "status",
        "total_pages",
        "total_chunks",
        "metadata",
        "created_at",
    } <= columns
    assert "source_path" not in columns


def test_document_view_schema_columns():
    columns = set(DocumentView.__table__.columns.keys())

    assert {"id", "document_id", "user_id", "viewed_at"} <= columns


def test_rag_history_schema_columns():
    assert "metadata" in DocumentChunk.__table__.columns
    assert "user_id" in Conversation.__table__.columns
    assert "metadata" in Message.__table__.columns
