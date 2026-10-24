from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.api import routes
from src.api.dependencies import get_current_user, get_current_user_any_status
from src.db.session import engine
from src.main import app


@pytest_asyncio.fixture(scope="session", autouse=True)
async def close_db_engine():
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """Keep auth overrides isolated between tests."""
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client():
    """Async HTTP client for testing API endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _fake_user(role: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=f"{role}-1",
        status="active",
        role=SimpleNamespace(name=role),
    )


@pytest.fixture
def as_admin():
    """Bypass auth + RBAC, acting as an admin user."""
    user = _fake_user("admin")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_user_any_status] = lambda: user
    app.dependency_overrides[routes.require_admin] = lambda: user
    app.dependency_overrides[routes.require_admin_or_lecturer] = lambda: user
    return user


@pytest.fixture
def as_lecturer():
    """Bypass auth + RBAC, acting as a lecturer user."""
    user = _fake_user("lecturer")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_user_any_status] = lambda: user
    app.dependency_overrides[routes.require_admin_or_lecturer] = lambda: user
    return user


@pytest.fixture
def as_student():
    """Authenticate as a student WITHOUT bypassing RBAC checkers.

    Lets `require_roles` run for real so 403 paths can be exercised.
    """
    user = _fake_user("student")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_user_any_status] = lambda: user
    return user


@pytest.fixture
def mock_llm():
    """Mock LLM to avoid calling OpenAI during tests.

    Usage in test:
        def test_something(mock_llm):
            # LLM calls will return mock response instead of hitting OpenAI
            ...
    """
    mock = AsyncMock()
    mock.ainvoke.return_value = AsyncMock(content="Mocked LLM response")
    return mock
