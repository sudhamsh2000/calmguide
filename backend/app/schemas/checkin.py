"""Pydantic v2 schemas for the caregiver check-in endpoint."""

from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    access_code: str = Field(..., min_length=8, max_length=8)
    message: str = Field(..., min_length=1, max_length=4000)
