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


class VoiceSafetyStatus(BaseModel):
    """Whether any spoken turn in a call tripped the safety gate."""

    triggered: bool
    # True once any turn was an EMERGENCY decision — the call screen shows the
    # full-screen call alert. HIGH (acute change) alone leaves this False.
    emergency: bool
    latest_risk_level: str | None = None
    # Lets the client raise the alert again for a later emergency turn after
    # the caregiver dismissed an earlier one.
    emergency_count: int = 0
