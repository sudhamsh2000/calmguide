import hashlib
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
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


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message",
    [
        "I'm stressed because his medication schedule is confusing",
        "keeping track of all his medications is overwhelming me",
        "the pharmacy mixed up his prescriptions and I'm frustrated",
    ],
)
async def test_checkin_benign_medication_frustration_does_not_escalate(message):
    """Safety Gate v2 Phase 5 sign-off: Check-In is a different user intent
    than Moment Coach (a caregiver processing their own stress, not asking
    for behavioral guidance), so this is tested at the Check-In surface
    specifically rather than assumed from the shared detector's unit tests.
    Caregiver frustration/overwhelm about medication *logistics* must reach
    normal LLM generation, not a MEDICATION_RISK/safety-gate short-circuit."""
    from app.main import app
    from app.models.profile import Profile

    async def fake_stream(system_prompt, messages, model_override=None):
        for chunk in ["That ", "sounds ", "exhausting."]:
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
                json={"access_code": "TESTCODE", "message": message},
            )
        assert response.status_code == 200
        body = response.text
        # The fake LLM's chunks must appear — a safety short-circuit would
        # instead return static gate/advisory copy and never touch the LLM.
        assert "exhausting" in body
        assert "medical emergency" not in body
        assert "This may need a medical check" not in body
    finally:
        app.dependency_overrides.clear()
