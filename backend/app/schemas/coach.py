"""Pydantic v2 schemas for coach mode endpoints."""

from uuid import UUID

from pydantic import BaseModel, Field


class CoachRequest(BaseModel):
    access_code: str | None = Field(None, min_length=8, max_length=8)
    profile_id: str | None = None
    # max_length caps token/cost abuse from oversized inputs.
    patient_name: str = Field(..., min_length=1, max_length=100)  # Transient — never stored
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: UUID | None = None
    staff_id: str | None = None
    facility_id: str | None = None


class CoachResponse(BaseModel):
    """Non-streaming fallback."""

    session_id: str
    response: str


class ConversationSummary(BaseModel):
    session_id: str
    title: str  # First user message, truncated to 60 chars
    created_at: str  # ISO datetime
    message_count: int


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    created_at: str  # ISO datetime


class ConversationMessagesResponse(BaseModel):
    session_id: str
    messages: list[ConversationMessage]


class AcuteChangeScreenRequest(BaseModel):
    """Structured yes/no/unsure answers for the acute-change/delirium screen.

    This is a screening prompt, not a diagnostic tool — see
    app/services/acute_change_screen.py for the (clinician-review-pending)
    decision logic.
    """

    access_code: str | None = Field(None, min_length=8, max_length=8)
    profile_id: str | None = None
    staff_id: str | None = None
    facility_id: str | None = None

    is_new_or_different: bool
    is_sudden_onset: bool
    alertness_change: bool | None = None
    fever_or_infection_signs: bool | None = None
    pain_signs: bool | None = None
    urinary_retention_signs: bool | None = None
    constipation_signs: bool | None = None
    dehydration_signs: bool | None = None
    medication_change_recent: bool | None = None
    fall_recent: bool | None = None
    unsure: bool = False


class AcuteChangeScreenResponse(BaseModel):
    outcome: str
    concerning_flags: list[str]
    is_uncertain: bool
    message: str
