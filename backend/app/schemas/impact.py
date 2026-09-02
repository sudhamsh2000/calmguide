"""Pydantic schema for the public impact endpoint."""

from pydantic import BaseModel


class ImpactResponse(BaseModel):
    families_supported: int
    coached_sessions: int
    languages_served: int
    overnight_pct: int
    sessions_this_week: int
