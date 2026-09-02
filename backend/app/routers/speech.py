"""Read-aloud speech synthesis endpoint.

Exists so the OpenAI key stays server-side — the browser must never hold it —
and so every caregiver hears the same natural voice regardless of what their
device happens to have installed. See app.services.speech for why the
browser's own voices aren't good enough.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.services.rate_limit import rate_limit
from app.services.speech import (
    MAX_TTS_CHARS,
    TTS_MEDIA_TYPE,
    TTSUnavailable,
    is_tts_configured,
    synthesize_speech,
)

router = APIRouter(tags=["speech"])


class SpeechRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TTS_CHARS)


@router.get("/speech/status")
async def speech_status():
    """Whether neural TTS is available.

    The client asks once on load so it can decide up front whether to use
    this endpoint or the browser's local voice, rather than discovering it
    per-request after a failed round trip.
    """
    return {"available": is_tts_configured()}


@router.post("/speech")
async def synthesize(
    payload: SpeechRequest,
    _rl: None = Depends(rate_limit("speech")),
) -> Response:
    """Synthesize `text` and return audio bytes.

    Rate-limited like the other paid endpoints: this bills per character, so
    it needs the same per-IP ceiling as the LLM routes.

    Returns 503 when synthesis is unavailable — chosen deliberately over 500
    because it is not an error the caregiver caused or can act on, and the
    client's correct response is to quietly fall back to local speech rather
    than surface a failure.
    """
    try:
        audio = await synthesize_speech(payload.text)
    except TTSUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": str(exc), "code": "TTS_UNAVAILABLE"},
        ) from exc

    return Response(
        content=audio,
        media_type=TTS_MEDIA_TYPE,
        headers={
            # Synthesis is deterministic for a given text, and a caregiver
            # re-reading the same guidance is common; let the browser reuse it
            # rather than paying to render identical audio twice.
            "Cache-Control": "private, max-age=3600",
        },
    )
