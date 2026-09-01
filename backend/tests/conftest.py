"""Shared test fixtures for CalmGuide backend tests."""

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import Settings
from app.db import get_session
from app.models.base import Base
from app.services.llm_provider import LLMProvider


# ---------------------------------------------------------------------------
# Event loop
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for all tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# Settings override — use SQLite for tests (no Postgres required)
# ---------------------------------------------------------------------------

@pytest.fixture
def test_settings() -> Settings:
    import base64
    return Settings(
        DATABASE_URL="sqlite+aiosqlite:///./test.db",
        LLM_PROVIDER="openai",
        OPENAI_API_KEY="test-key",
        OPENAI_MODEL="gpt-4o-mini",
        ANTHROPIC_API_KEY="test-key",
        ANTHROPIC_MODEL="claude-sonnet-4-20250514",
        CORS_ORIGINS="http://localhost:3000",
        CONVERSATION_ENCRYPTION_KEY=base64.b64encode(b"\x00" * 32).decode(),
        JWT_SECRET_KEY="test-jwt-secret-key-at-least-32-characters-long",
        RATE_LIMIT_ENABLED=False,
        # Off by default so the other ~47 call sites across the suite that
        # POST /profiles without an invite_code keep working unmodified.
        # Tests that specifically exercise the invite-code gate turn it back
        # on for themselves (see test_invite_codes.py).
        INVITE_CODE_REQUIRED=False,
    )


# ---------------------------------------------------------------------------
# Database fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def override_get_settings(test_settings, monkeypatch):
    """Ensure crypto.py gets the test encryption key via the real get_settings() cache."""
    from app import config
    monkeypatch.setenv(
        "CONVERSATION_ENCRYPTION_KEY",
        test_settings.CONVERSATION_ENCRYPTION_KEY,
    )
    monkeypatch.setenv("JWT_SECRET_KEY", test_settings.JWT_SECRET_KEY)
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("INVITE_CODE_REQUIRED", "false")
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


@pytest_asyncio.fixture
async def db_engine(test_settings):
    import app.models  # noqa: F401

    engine = create_async_engine(
        test_settings.DATABASE_URL,
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Mock LLM provider — never calls real APIs in tests
# ---------------------------------------------------------------------------

class MockLLMProvider(LLMProvider):
    """Deterministic mock that yields predefined chunks."""

    def __init__(self, chunks: list[str] | None = None):
        self.chunks = chunks or ["This is ", "a test ", "response."]
        self.last_system_prompt: str | None = None
        # The coach/checkin response uses stream_completion; post-[DONE] work
        # (tag gen, extraction) uses completion and would overwrite
        # last_system_prompt. Record the stream prompt separately so tests can
        # assert against the actual user-facing prompt.
        self.last_stream_system_prompt: str | None = None
        self.last_messages: list[dict[str, str]] | None = None

    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> AsyncGenerator[str, None]:
        self.last_system_prompt = system_prompt
        self.last_stream_system_prompt = system_prompt
        self.last_messages = messages
        for chunk in self.chunks:
            yield chunk

    async def completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        model_override: str | None = None,
    ) -> str:
        self.last_system_prompt = system_prompt
        self.last_messages = messages
        return "".join(self.chunks)


@pytest.fixture
def mock_llm() -> MockLLMProvider:
    return MockLLMProvider()


# ---------------------------------------------------------------------------
# FastAPI test client
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def app(db_engine, mock_llm):
    """Create a FastAPI app wired to test DB and mock LLM."""
    from app.main import create_app
    import app.db as db_module

    application = create_app()

    # Override DB session dependency
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def _override_session() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    application.dependency_overrides[get_session] = _override_session

    # Also override the module-level session factory so the coach router
    # can use get_session_factory() for post-stream writes
    db_module._session_factory = session_factory
    db_module._engine = db_engine

    # Stash mock LLM on app state so routers can access it
    application.state.llm_provider = mock_llm

    yield application

    # Cleanup module-level state
    db_module._session_factory = None
    db_module._engine = None


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
