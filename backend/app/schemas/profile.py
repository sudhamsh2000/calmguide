"""Pydantic v2 schemas for profile endpoints."""

from typing import Literal

from pydantic import BaseModel, Field

DISEASE_STAGES = Literal["early", "middle", "late", "unknown"]


class ProfileCreate(BaseModel):
    disease_stage: DISEASE_STAGES
    behavioral_patterns: list[str] = Field(..., min_length=1)
    calming_strategies: list[str] = Field(..., min_length=1)
    safety_concerns: list[str] = Field(..., min_length=1)
    # Required only when Settings.INVITE_CODE_REQUIRED is True (private
    # testing). Ignored otherwise. Empty string accepted so existing
    # clients/tests that predate this field don't hard-fail on validation —
    # the router enforces presence itself when the gate is on.
    invite_code: str = ""


class ProfileUpdate(BaseModel):
    disease_stage: DISEASE_STAGES
    behavioral_patterns: list[str] = Field(..., min_length=1)
    calming_strategies: list[str] = Field(..., min_length=1)
    safety_concerns: list[str] = Field(..., min_length=1)


class ProfileResponse(BaseModel):
    id: str
    disease_stage: str
    behavioral_patterns: list[str]
    calming_strategies: list[str]
    safety_concerns: list[str]
    previous_stage: str | None = None
    stage_changed_at: str | None = None


class ProfileCreateResponse(ProfileResponse):
    """Returned only on creation — includes the plaintext access code."""

    access_code: str


class ErrorResponse(BaseModel):
    error: str
    code: str


class InviteCodeCheck(BaseModel):
    code: str = Field(..., min_length=1)


class InviteCodeCheckResponse(BaseModel):
    valid: bool
