from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import get_settings
from src.db.models import Base
from src.db.roles import DEFAULT_ROLES, sync_roles

DEFAULT_ROLE_NAMES = tuple(spec.name for spec in DEFAULT_ROLES)


def get_async_database_url(url: str) -> str:
    # asyncpg không hiểu "sslmode" (Supabase/Neon hay gắn) → đổi sang "ssl".
    url = url.replace("?sslmode=", "?ssl=").replace("&sslmode=", "&ssl=")
    if url.startswith("postgresql+asyncpg://") or url.startswith("sqlite+aiosqlite://"):
        return url
    # Render/Heroku cấp URL dạng "postgres://" — chuẩn hóa về asyncpg.
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    return url


settings = get_settings()
_db_url = get_async_database_url(settings.database_url)
# asyncpg: timeout kết nối 10s để KHÔNG treo vô hạn khi DB chậm/không tới được.
_connect_args = {"timeout": 10} if _db_url.startswith("postgresql+asyncpg") else {}
engine = create_async_engine(
    _db_url,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await ensure_schema_safe()
    await seed_default_roles()


async def ensure_schema_safe() -> bool:
    """Chạy nâng cấp schema an toàn — KHÔNG BAO GIỜ treo/khóa startup.

    uvicorn chạy lifespan TRƯỚC khi bind cổng; nếu nâng cấp treo (DDL chờ khóa bảng
    do instance cũ đang chạy lúc deploy rolling) thì sẽ "no open ports". Hàm này có
    lock_timeout + try/except để fail nhanh; trả True nếu schema đã ở trạng thái mục tiêu.
    """
    if engine.dialect.name != "postgresql":
        return True
    try:
        async with engine.begin() as conn:
            await _ensure_schema_upgrades(conn)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[schema] nâng cấp chưa xong (sẽ thử lại nền): {exc}")
        return False


async def _ensure_schema_upgrades(conn) -> None:
    """Nâng cấp schema cho DB đã tồn tại (idempotent, Postgres).

    QUAN TRỌNG: chỉ chạy DDL khi schema THỰC SỰ cần nâng cấp. Nếu đã ở trạng thái mục
    tiêu (có `username`, không còn `password_hash`) thì THOÁT NGAY — không đụng DDL/khóa
    bảng users. Tránh việc mỗi lần khởi động lại khóa bảng (gây treo khi deploy rolling).
    """
    cols = {
        r[0]
        for r in await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
        )
    }
    role_cols = {
        r[0]
        for r in await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'roles'")
        )
    }
    needs_username = bool(cols) and "username" not in cols
    needs_password_merge = bool(cols) and "password_hash" in cols
    needs_role_catalog = bool(role_cols) and "code" not in role_cols
    usage_cols = {
        r[0]
        for r in await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_chat_usage'")
        )
    }
    event_cols = {
        r[0]
        for r in await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_usage_events'")
        )
    }
    fc_cols = {
        r[0]
        for r in await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'flashcards'")
        )
    }
    quiz_cols = {
        r[0]
        for r in await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'quizzes'")
        )
    }
    table_names = {
        r[0]
        for r in await conn.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        )
    }
    doc_cols = {
        r[0]
        for r in await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'")
        )
    }
    student_cols = {
        r[0]
        for r in await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'students'")
        )
    }
    needs_tokens_used = bool(usage_cols) and "tokens_used" not in usage_cols
    needs_event_tokens = bool(event_cols) and "tokens" not in event_cols
    needs_fc_user_id = bool(fc_cols) and "user_id" not in fc_cols
    needs_quiz_user_id = bool(quiz_cols) and "user_id" not in quiz_cols
    needs_classrooms_table = "classrooms" not in table_names
    needs_doc_classroom_id = bool(doc_cols) and "classroom_id" not in doc_cols
    needs_student_classroom_id = bool(student_cols) and "classroom_id" not in student_cols

    if (
        not needs_username
        and not needs_password_merge
        and not needs_role_catalog
        and not needs_tokens_used
        and not needs_event_tokens
        and not needs_fc_user_id
        and not needs_quiz_user_id
        and not needs_classrooms_table
        and not needs_doc_classroom_id
        and not needs_student_classroom_id
    ):
        return  # đã ở trạng thái mục tiêu → không chạy DDL

    # DDL có lock_timeout ngắn: nếu bảng đang bị instance cũ khóa thì FAIL NHANH
    # (được try/except ở init_db bắt) thay vì treo vô hạn → startup vẫn bind được cổng.
    await conn.execute(text("SET LOCAL lock_timeout = '20s'"))

    if needs_classrooms_table:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS classrooms (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) NOT NULL UNIQUE,
                subject VARCHAR(255) NOT NULL,
                description VARCHAR(500),
                created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_classrooms_name ON classrooms (name)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_classrooms_code ON classrooms (code)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_classrooms_subject ON classrooms (subject)"))
        except Exception:
            pass

    if needs_doc_classroom_id:
        await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS classroom_id VARCHAR(36) REFERENCES classrooms(id) ON DELETE CASCADE"))
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_documents_classroom_id ON documents (classroom_id)"))
        except Exception:
            pass

    if needs_student_classroom_id:
        await conn.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS classroom_id VARCHAR(36) REFERENCES classrooms(id) ON DELETE SET NULL"))
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_students_classroom_id ON students (classroom_id)"))
        except Exception:
            pass

    if needs_fc_user_id:
        await conn.execute(text("ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE"))
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_flashcards_user_id ON flashcards (user_id)"))
        except Exception:
            pass

    if needs_quiz_user_id:
        await conn.execute(text("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE"))
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_quizzes_user_id ON quizzes (user_id)"))
        except Exception:
            pass

    if needs_tokens_used:
        await conn.execute(text("ALTER TABLE daily_chat_usage ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0"))

    if needs_event_tokens:
        await conn.execute(text("ALTER TABLE chat_usage_events ADD COLUMN IF NOT EXISTS tokens INTEGER DEFAULT 0"))

    if needs_role_catalog:
        await conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS code VARCHAR(16)"))
        await conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT ''"))
        await conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS description VARCHAR(500) DEFAULT ''"))
        await conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_product BOOLEAN DEFAULT TRUE"))
        await conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_assignable BOOLEAN DEFAULT FALSE"))
        try:
            await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_roles_code ON roles (code)"))
        except Exception:
            pass

    if needs_username:
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(150)"))
        await conn.execute(
            text("UPDATE users SET username = split_part(email, '@', 1) "
                 "WHERE username IS NULL OR username = ''")
        )
        try:
            await conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)")
            )
        except Exception:
            pass  # username trùng (DB cũ) → bỏ ràng buộc unique, vẫn chạy được

    if needs_password_merge:
        await conn.execute(text("UPDATE users SET password = password_hash"))
        await conn.execute(text("ALTER TABLE users DROP COLUMN password_hash"))


async def seed_default_roles() -> None:
    async with AsyncSessionLocal() as session:
        await sync_roles(session)
        await session.commit()
