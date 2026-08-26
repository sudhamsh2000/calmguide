from pydantic import BaseModel, Field


class FacilityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class FacilityResponse(BaseModel):
    id: str
    name: str
    facility_code: str | None = None
    patient_count: int = 0
    staff_count: int = 0
    default_language: str = "en-US"
    timezone: str = "US/Eastern"
    is_active: bool
    created_at: str


class FacilitySettings(BaseModel):
    default_language: str = "en-US"
    timezone: str = "US/Eastern"
    alert_severe_incident: bool = True
    alert_incident_threshold: int = 2
    alert_staff_inactive_days: int = 3
    alert_family_sessions: bool = False


class FacilityUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    default_language: str = "en-US"
    timezone: str = "US/Eastern"
