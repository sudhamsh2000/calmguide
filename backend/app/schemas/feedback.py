"""Pydantic v2 schemas for feedback endpoints."""
from pydantic import BaseModel, Field


PREDEFINED_TAGS = [
    "calm_approach", "music", "redirection", "physical_space",
    "familiar_objects", "routine", "lighting", "simple_words",
    "physical_touch", "called_for_help", "waited_it_out", "left_the_room",
]

NEGATIVE_REASON_TAGS = [
    "too_generic", "wrong_situation", "didnt_understand",
    "felt_unsafe", "already_tried",
]


class FeedbackCreate(BaseModel):
    access_code: str = Field(..., min_length=8, max_length=8)
    conversation_id: str = Field(..., min_length=1)
    helpful: bool
    tags: list[str] = Field(default_factory=list)
    negative_reasons: list[str] = Field(default_factory=list)


class FeedbackSkip(BaseModel):
    access_code: str = Field(..., min_length=8, max_length=8)
    conversation_id: str = Field(..., min_length=1)


class FeedbackResponse(BaseModel):
    id: str


class FeedbackEntry(BaseModel):
    conversation_id: str
    helpful: bool | None
    tags: list[str]
    created_at: str


class SessionFeedbackResponse(BaseModel):
    feedback: list[FeedbackEntry]


class PendingFeedbackResponse(BaseModel):
    session_id: str
    conversation_id: str
    title: str
    suggested_tags: list[str]
    created_at: str
