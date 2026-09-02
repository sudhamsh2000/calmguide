"""Neural text-to-speech for read-aloud.

The browser's built-in Web Speech API only exposes the platform's basic
bundled voices (on macOS that's the same set containing "Boing" and
"Zarvox"), and the genuinely natural system voices — Siri, and Apple's
Enhanced/Premium downloads — are deliberately not reachable from a web
page. No amount of rate/pitch tuning gets past that ceiling, and a
caregiver being read a distressing moment's guidance in a flat robotic
voice undercuts the calm the whole product is trying to create.

This routes read-aloud through a neural TTS model instead, so every
caregiver gets the same natural voice regardless of their device. The
client keeps the local Web Speech path as a fallback (offline, request
failure, or TTS disabled), so read-aloud degrades rather than disappears.

Synthesis is a *convenience* feature, never on the safety path: nothing
here should ever be able to fail a coach response that has already been
delivered. Callers are expected to treat failures as "fall back to local
speech", not as errors worth surfacing.
"""

import logging

from openai import AsyncOpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

# Upper bound on a single synthesis request. Coach responses are the longest
# thing read aloud and land well under this; the cap exists so a malformed or
# hostile request can't turn into an unbounded synthesis bill.
MAX_TTS_CHARS = 4000

# `gpt-4o-mini-tts` is the current low-cost neural voice model. "shimmer" is
# the warmest of the available presets, which is the point of this whole
# change — see the module docstring.
_TTS_MODEL = "gpt-4o-mini-tts"
_TTS_VOICE = "shimmer"

# MP3 keeps responses small enough to stream comfortably over a slow phone
# connection, and every target browser can play it without a codec shim.
_TTS_FORMAT = "mp3"
TTS_MEDIA_TYPE = "audio/mpeg"

# Delivery direction for the model. Not caregiver-visible copy — it steers
# how the text is read, not what is said.
_TTS_INSTRUCTIONS = (
    "Speak in a warm, calm, unhurried voice, as if gently supporting someone "
    "who is stressed and tired. Keep a steady, reassuring pace."
)


class TTSUnavailable(RuntimeError):
    """Synthesis could not be produced; the caller should fall back to local speech."""


def is_tts_configured() -> bool:
    """Whether neural TTS can be attempted at all.

    Lets the client ask once on load, rather than discovering per-request
    that it should have used the local fallback.
    """
    settings = get_settings()
    return bool(settings.TTS_ENABLED and settings.OPENAI_API_KEY)


async def synthesize_speech(text: str) -> bytes:
    """Render `text` to speech audio, returning encoded audio bytes.

    Raises TTSUnavailable for every failure mode (not configured, empty
    input, provider error) so callers have exactly one thing to catch and
    one thing to do about it: fall back to the browser's local voice.
    """
    settings = get_settings()

    if not is_tts_configured():
        raise TTSUnavailable("TTS is not configured")

    cleaned = text.strip()
    if not cleaned:
        raise TTSUnavailable("nothing to synthesize")

    # Truncate rather than reject: a caregiver pressing "read aloud" on an
    # unusually long response should still hear the start of it, which is
    # where the immediate "Right Now" guidance lives.
    if len(cleaned) > MAX_TTS_CHARS:
        cleaned = cleaned[:MAX_TTS_CHARS]

    client = AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=settings.LLM_TIMEOUT_SECONDS,
    )

    try:
        response = await client.audio.speech.create(
            model=_TTS_MODEL,
            voice=_TTS_VOICE,
            input=cleaned,
            instructions=_TTS_INSTRUCTIONS,
            response_format=_TTS_FORMAT,
        )
        return response.content
    except Exception as exc:
        # Logged at warning, not error: the client has a working fallback, so
        # this degrades quality rather than breaking the feature.
        logger.warning("TTS synthesis failed, client will fall back: %s", exc)
        raise TTSUnavailable(str(exc)) from exc
