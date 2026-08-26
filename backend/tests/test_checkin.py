import pytest
from pydantic import ValidationError
from app.schemas.checkin import CheckInRequest
from app.services.prompt import render_checkin_prompt


def test_valid_checkin_request():
    req = CheckInRequest(access_code="ABCD1234", message="I feel exhausted")
    assert req.access_code == "ABCD1234"
    assert req.message == "I feel exhausted"


def test_checkin_request_rejects_short_access_code():
    with pytest.raises(ValidationError):
        CheckInRequest(access_code="SHORT", message="hello")


def test_checkin_request_rejects_long_access_code():
    with pytest.raises(ValidationError):
        CheckInRequest(access_code="ABCD12345", message="hello")


def test_checkin_request_rejects_empty_message():
    with pytest.raises(ValidationError):
        CheckInRequest(access_code="ABCD1234", message="")


def test_render_checkin_prompt_returns_string():
    result = render_checkin_prompt()
    assert isinstance(result, str)
    assert len(result) > 100
    assert "caregiver" in result.lower()
    # Safety-critical content must be present
    assert "988" in result
    assert "911" in result
    assert "1-800-272-3900" in result
    assert "1-800-677-1116" in result


# ---------------------------------------------------------------------------
# Router integration tests
# ---------------------------------------------------------------------------
import hashlib
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_checkin_endpoint_streams_response():
    """Valid access code returns 200 SSE stream."""
    from app.main import app
    from app.models.profile import Profile

    async def fake_stream(system_prompt, messages, model_override=None):
        for chunk in ["You ", "are ", "not ", "alone."]:
            yield chunk

    mock_llm = MagicMock()
    mock_llm.stream_completion = fake_stream

    profile = Profile()
    profile.id = "test-profile-id"
    profile.access_code_hash = hashlib.sha256(b"TESTCODE").hexdigest()
    profile.disease_stage = "middle"

    mock_scalar = MagicMock()
    mock_scalar.scalar_one_or_none.return_value = profile
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_scalar)

    app.state.llm_provider = mock_llm

    async def override_get_session():
        yield mock_db

    from app.db import get_session
    app.dependency_overrides[get_session] = override_get_session

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/checkin",
                json={"access_code": "TESTCODE", "message": "I feel tired"},
            )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_checkin_endpoint_returns_404_for_unknown_code():
    """Unknown access code returns 404."""
    from app.main import app

    mock_scalar = MagicMock()
    mock_scalar.scalar_one_or_none.return_value = None
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_scalar)

    async def override_get_session():
        yield mock_db

    from app.db import get_session
    app.dependency_overrides[get_session] = override_get_session

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/checkin",
                json={"access_code": "BADCODE1", "message": "hello"},
            )
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()
