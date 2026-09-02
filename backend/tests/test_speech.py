"""Tests for the read-aloud speech endpoint.

The contract that matters here is degradation, not synthesis: read-aloud is a
convenience layer over guidance the caregiver can already read, and the client
keeps a working local-voice fallback. So every failure must surface as a clean
503 the client can quietly fall back from — never a 500, and never something
that could take down the response it's reading.
"""

import pytest

from app import config
from app.services import speech


@pytest.fixture
def tts_enabled(monkeypatch):
    """Turn neural TTS on for the requesting test (off by default in config)."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    config.get_settings.cache_clear()
    yield
    monkeypatch.setenv("TTS_ENABLED", "false")
    config.get_settings.cache_clear()


async def test_status_reports_unavailable_when_disabled(client):
    """Disabled by default — the client should be told up front, not per-press."""
    response = await client.get("/api/speech/status")
    assert response.status_code == 200
    assert response.json() == {"available": False}


async def test_status_reports_available_when_enabled(client, tts_enabled):
    response = await client.get("/api/speech/status")
    assert response.json() == {"available": True}


async def test_synthesize_returns_503_when_disabled(client):
    """Not 500: nothing went wrong, the feature just isn't on. The client's
    correct response is to fall back to local speech, not to show an error."""
    response = await client.post("/api/speech", json={"text": "Take a breath."})
    assert response.status_code == 503
    assert response.json()["code"] == "TTS_UNAVAILABLE"


async def test_synthesize_returns_503_when_provider_fails(client, tts_enabled, monkeypatch):
    """A provider outage must degrade, not error."""

    async def _boom(_text: str) -> bytes:
        raise speech.TTSUnavailable("provider exploded")

    monkeypatch.setattr("app.routers.speech.synthesize_speech", _boom)

    response = await client.post("/api/speech", json={"text": "Take a breath."})
    assert response.status_code == 503
    assert response.json()["code"] == "TTS_UNAVAILABLE"


async def test_synthesize_returns_audio(client, tts_enabled, monkeypatch):
    async def _fake(_text: str) -> bytes:
        return b"ID3-fake-mp3-bytes"

    monkeypatch.setattr("app.routers.speech.synthesize_speech", _fake)

    response = await client.post("/api/speech", json={"text": "Take a breath."})
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"ID3-fake-mp3-bytes"


async def test_rejects_empty_text(client, tts_enabled):
    response = await client.post("/api/speech", json={"text": ""})
    assert response.status_code == 422


async def test_rejects_text_over_the_cap(client, tts_enabled):
    """Bounded so a malformed or hostile request can't become an unbounded
    synthesis bill."""
    response = await client.post(
        "/api/speech", json={"text": "a" * (speech.MAX_TTS_CHARS + 1)}
    )
    assert response.status_code == 422


async def test_service_raises_rather_than_returning_empty_when_unconfigured():
    """The service layer has exactly one failure type, so callers have exactly
    one thing to catch."""
    config.get_settings.cache_clear()
    with pytest.raises(speech.TTSUnavailable):
        await speech.synthesize_speech("hello")
