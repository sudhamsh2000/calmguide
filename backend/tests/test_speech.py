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


async def test_long_text_is_truncated_not_rejected(client, tts_enabled, monkeypatch):
    """A full Moment Coach response runs past MAX_TTS_CHARS.

    Regression test: the endpoint originally validated `max_length` at
    MAX_TTS_CHARS, so long coach answers were 422'd and the client silently
    fell back to the robotic system voice — on exactly the screen where the
    natural voice matters most. Long input must synthesize (truncated), not
    fail.
    """
    seen: dict[str, str] = {}

    async def _capture(text: str) -> bytes:
        seen["text"] = text
        return b"audio"

    monkeypatch.setattr("app.routers.speech.synthesize_speech", _capture)

    response = await client.post(
        "/api/speech", json={"text": "a" * (speech.MAX_TTS_CHARS + 2000)}
    )
    assert response.status_code == 200
    # The router forwards the full text; the service is what truncates.
    assert len(seen["text"]) == speech.MAX_TTS_CHARS + 2000


async def test_service_truncates_over_long_text(monkeypatch, tts_enabled):
    """The truncation itself lives in the service layer."""
    captured: dict[str, str] = {}

    class _FakeSpeech:
        async def create(self, **kwargs):
            captured["input"] = kwargs["input"]
            return type("R", (), {"content": b"audio"})()

    class _FakeClient:
        audio = type("A", (), {"speech": _FakeSpeech()})()

    monkeypatch.setattr("app.services.speech.AsyncOpenAI", lambda **_: _FakeClient())

    await speech.synthesize_speech("a" * (speech.MAX_TTS_CHARS + 5000))
    assert len(captured["input"]) == speech.MAX_TTS_CHARS


async def test_rejects_absurdly_large_payload(client, tts_enabled):
    """A hard ceiling well above MAX_TTS_CHARS still rejects obvious abuse."""
    response = await client.post("/api/speech", json={"text": "a" * 25_000})
    assert response.status_code == 422


async def test_service_raises_rather_than_returning_empty_when_unconfigured():
    """The service layer has exactly one failure type, so callers have exactly
    one thing to catch."""
    config.get_settings.cache_clear()
    with pytest.raises(speech.TTSUnavailable):
        await speech.synthesize_speech("hello")
