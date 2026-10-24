"""Create and upgrade AI RAG schema.

Revision ID: 0001_ai_rag_schema
Revises:
Create Date: 2026-06-09
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001_ai_rag_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS roles (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_roles_name ON roles (name);")
    op.execute(
        """
        INSERT INTO roles (id, name)
        VALUES
            ('00000000-0000-0000-0000-000000000001', 'admin'),
            ('00000000-0000-0000-0000-000000000002', 'student'),
            ('00000000-0000-0000-0000-000000000003', 'lecture')
        ON CONFLICT (name) DO NOTHING;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            phone_number VARCHAR(32),
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            role_id VARCHAR(36) REFERENCES roles(id) ON DELETE SET NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);")

    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT '';")
    op.execute("ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;")
    op.execute("ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT '';")
    op.execute("ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;")
    op.execute("ALTER TABLE users ALTER COLUMN full_name DROP DEFAULT;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id VARCHAR(36);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';")
    op.execute("ALTER TABLE users ALTER COLUMN status SET NOT NULL;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    op.execute("ALTER TABLE users ALTER COLUMN created_at SET NOT NULL;")

    _add_fk_if_missing(
        "users",
        "fk_users_role_id_roles",
        "FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL",
    )

    _rename_column_if_needed("documents", "source_path", "storage_path")
    _rename_column_if_needed("documents", "metadata_json", "metadata")
    _rename_column_if_needed("document_chunks", "metadata_json", "metadata")
    _rename_column_if_needed("messages", "metadata_json", "metadata")
    _rename_column_if_needed("agent_runs", "metadata_json", "metadata")

    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(36);")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path VARCHAR(1000);")
    op.execute("UPDATE documents SET storage_path = id WHERE storage_path IS NULL OR storage_path = '';")
    op.execute("ALTER TABLE documents ALTER COLUMN storage_path SET NOT NULL;")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0;")
    op.execute("UPDATE documents SET total_pages = 0 WHERE total_pages IS NULL;")
    op.execute("ALTER TABLE documents ALTER COLUMN total_pages SET NOT NULL;")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0;")
    op.execute("UPDATE documents SET total_chunks = 0 WHERE total_chunks IS NULL;")
    op.execute("ALTER TABLE documents ALTER COLUMN total_chunks SET NOT NULL;")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}'::json;")
    op.execute("UPDATE documents SET metadata = '{}'::json WHERE metadata IS NULL;")
    op.execute("ALTER TABLE documents ALTER COLUMN metadata SET NOT NULL;")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_documents_storage_path ON documents (storage_path);")

    _add_fk_if_missing(
        "documents",
        "fk_documents_uploaded_by_users",
        "FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL",
    )

    op.execute("ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}'::json;")
    op.execute("UPDATE document_chunks SET metadata = '{}'::json WHERE metadata IS NULL;")
    op.execute("ALTER TABLE document_chunks ALTER COLUMN metadata SET NOT NULL;")

    op.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);")
    _add_fk_if_missing(
        "conversations",
        "fk_conversations_user_id_users",
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
    )

    op.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}'::json;")
    op.execute("UPDATE messages SET metadata = '{}'::json WHERE metadata IS NULL;")
    op.execute("ALTER TABLE messages ALTER COLUMN metadata SET NOT NULL;")

    op.execute("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}'::json;")
    op.execute("UPDATE agent_runs SET metadata = '{}'::json WHERE metadata IS NULL;")
    op.execute("ALTER TABLE agent_runs ALTER COLUMN metadata SET NOT NULL;")


def downgrade() -> None:
    # Keep data-safe: do not drop AI/user tables automatically.
    return


def _rename_column_if_needed(table_name: str, old_column: str, new_column: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = '{table_name}'
                  AND column_name = '{old_column}'
            )
            AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = '{table_name}'
                  AND column_name = '{new_column}'
            ) THEN
                ALTER TABLE {table_name} RENAME COLUMN {old_column} TO {new_column};
            END IF;
        END $$;
        """
    )


def _add_fk_if_missing(table_name: str, constraint_name: str, fk_sql: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = '{constraint_name}'
            ) THEN
                ALTER TABLE {table_name}
                ADD CONSTRAINT {constraint_name} {fk_sql};
            END IF;
        END $$;
        """
    )
