"""Pydantic v2 schemas for daily behavioral check-in."""
from pydantic import BaseModel, Field

SEVERITY_OPTIONS = ["calm", "mild", "tough"]
TIME_SLOT_OPTIONS = ["overnight", "morning", "afternoon", "evening"]


class DailyCheckinCreate(BaseModel):
    access_code: str = Field(..., min_length=8, max_length=8)
    severity: str = Field(..., pattern="^(calm|mild|tough)$")
    time_slot: str | None = Field(None, pattern="^(overnight|morning|afternoon|evening)$")
    tags: list[str] = Field(default_factory=list)


class DailyCheckinEntry(BaseModel):
    id: str
    check_date: str
    severity: str
    time_slot: str | None
    tags: list[str]
    created_at: str


class DailyCheckinStatus(BaseModel):
    checked_in: bool
    entries: list[DailyCheckinEntry] = []
