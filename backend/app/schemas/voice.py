"""Pydantic v2 schemas for voice-only (ElevenLabs) conversations."""

from pydantic import BaseModel, Field


class VoiceSessionRequest(BaseModel):
    access_code: str | None = Field(None, min_length=8, max_length=8)
    profile_id: str | None = None
    patient_name: str = Field(..., min_length=1, max_length=100)  # Transient — never stored


class VoiceSessionResponse(BaseModel):
    session_id: str
    # Pass to the ElevenLabs SDK as customLlmExtraBody: {"voice_token": ...}
    voice_token: str
    expires_in: int
    agent_id: str
    # Set when ELEVENLABS_API_KEY is configured (private agent); connect with
    # this instead of agent_id.
    signed_url: str | None = None
