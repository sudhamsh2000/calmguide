"""Pydantic schemas for care change events."""

from datetime import date

from pydantic import BaseModel, Field


class CareChangeCreate(BaseModel):
    change_date: date
    description: str = Field(..., min_length=1)
    observation_window_days: int = Field(default=28, ge=7, le=90)


class CareChangeResponse(BaseModel):
    id: str
    change_date: str
    description: str
    observation_window_days: int
    is_active: bool
    created_at: str
