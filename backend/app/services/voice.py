"""Voice-only conversations through an ElevenLabs agent.

ElevenLabs runs the call: speech-to-text, turn-taking and text-to-speech.
Its "Custom LLM" setting points at CalmGuide (app.routers.voice), so the
text of every spoken turn arrives here and goes through the same Safety
Gate v2 decision as typed chat *before* any model is called. An emergency
turn never reaches a model; ElevenLabs reads out the same fixed escalation
copy the chat path shows, converted to plain speech.

Identity never passes through ElevenLabs as a credential. The app asks
CalmGuide for a short-lived, voice-only token (signed, audience-scoped so it
cannot be used as a staff token) and hands it to the ElevenLabs SDK as
custom LLM extra body; ElevenLabs relays it back on each turn as
`elevenlabs_extra_body`.
"""

import re
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import jwt

from app.config import get_settings
from app.services.jwt_service import _require_secret

VOICE_TOKEN_AUDIENCE = "calmguide-voice"

_SIGNED_URL_ENDPOINT = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"

# Appended to the coach system prompt for voice turns. The coach prompt's
# safety principles and patient context still apply; only its written
# four-section format is replaced, because a caregiver mid-crisis cannot sit
# through four sections read aloud.
VOICE_MODE_INSTRUCTIONS = """

## VOICE CALL MODE — this replaces "Response Format" and "Response Length and Tone"

You are speaking on a live voice call with a caregiver who may be in the middle of a crisis. Your reply is read aloud word for word.
- Reply in two to four short spoken sentences. Lead with the single most important thing to do right now.
- Plain spoken {language} only: no markdown, headings, bullet points, section markers, emojis, or links.
- Ask at most one short question, and only when the answer changes what they should do next.
- Give escalation guidance in one sentence when it is relevant, rather than a full list.
- If anything sounds like danger to anyone, tell them to call emergency services now, before anything else.
- Every safety principle above still applies.
"""


class VoiceUnavailable(Exception):
    """ElevenLabs could not mint a signed URL for the agent."""


def create_voice_token(
    *,
    profile_id: str,
    session_id: str,
    patient_name: str,
    locale_header: str | None,
    staff_id: str | None,
    facility_id: str | None,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "aud": VOICE_TOKEN_AUDIENCE,
        "profile_id": profile_id,
        "session_id": session_id,
        "patient_name": patient_name,
        "locale": locale_header,
        "staff_id": staff_id,
        "facility_id": facility_id,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(seconds=settings.VOICE_TOKEN_TTL_SECONDS),
    }
    return jwt.encode(payload, _require_secret(), algorithm=settings.JWT_ALGORITHM)


def verify_voice_token(token: str) -> dict:
    """Decode a voice token. Raises jwt.InvalidTokenError on anything wrong,
    including a staff token (no voice audience) presented in its place."""
    settings = get_settings()
    return jwt.decode(
        token,
        _require_secret(),
        algorithms=[settings.JWT_ALGORITHM],
        audience=VOICE_TOKEN_AUDIENCE,
    )


async def get_signed_url(agent_id: str, api_key: str) -> str:
    """Signed WebSocket URL for a private ElevenLabs agent, so the agent
    cannot be started by anyone who merely knows its id."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                _SIGNED_URL_ENDPOINT,
                params={"agent_id": agent_id},
                headers={"xi-api-key": api_key},
            )
            resp.raise_for_status()
            return resp.json()["signed_url"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise VoiceUnavailable(f"ElevenLabs signed URL request failed: {exc}") from exc


_SECTION_MARKER = re.compile(r"^\s*\[\[SECTION:[a-z-]+\]\]\s*$", re.IGNORECASE)
_LINE_PREFIX = re.compile(r"^\s*(?:#{1,6}\s+|>\s*|[-*•]\s+|\d+\.\s+)+")
_EMPHASIS = re.compile(r"(\*\*|__|\*|`)")
_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_SENTENCE_END = (".", "!", "?", ":", "।", "。", "！", "？")


def to_spoken_text(text: str) -> str:
    """Turn markdown into text a voice can read: drop section markers,
    heading/quote/bullet prefixes, emphasis and link targets, and make each
    line a sentence so list items don't run together when spoken.

    Wording is untouched, so the emergency copy stays exactly what was
    reviewed — only the formatting characters go.
    """
    sentences: list[str] = []
    for raw_line in text.splitlines():
        if _SECTION_MARKER.match(raw_line):
            continue
        line = _LINK.sub(r"\1", raw_line)
        line = _LINE_PREFIX.sub("", line)
        line = _EMPHASIS.sub("", line).strip()
        if not line:
            continue
        if not line.endswith(_SENTENCE_END):
            line += "."
        sentences.append(line)
    return " ".join(sentences)


def chat_completion_chunk(
    completion_id: str, created: int, delta: dict, finish: str | None
) -> dict:
    return {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": "calmguide-voice",
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
    }


def chat_completion(completion_id: str, created: int, text: str) -> dict:
    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": created,
        "model": "calmguide-voice",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
    }
