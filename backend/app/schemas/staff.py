from typing import Literal

from pydantic import BaseModel, Field

STAFF_ROLES = Literal["staff", "admin", "owner"]


class StaffCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str | None = None
    role: STAFF_ROLES = "staff"
    pin: str | None = Field(None, min_length=4, max_length=6)
    password: str | None = Field(None, min_length=8)
    language_preference: str = "en-US"


class StaffUpdate(BaseModel):
    name: str | None = None
    role: STAFF_ROLES | None = None
    is_active: bool | None = None
    language_preference: str | None = None


class StaffResponse(BaseModel):
    id: str
    name: str
    email: str | None
    role: str
    language_preference: str
    is_active: bool
    last_login_at: str | None
    assigned_patients_count: int = 0
    created_at: str


class StaffListItem(BaseModel):
    id: str
    name: str
    role: str


class PinLoginRequest(BaseModel):
    facility_code: str = Field(..., min_length=8, max_length=8)
    staff_id: str
    pin: str = Field(..., min_length=4, max_length=6)


class EmailLoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    staff: StaffResponse
    expires_at: str


class AssignmentCreate(BaseModel):
    staff_id: str
    profile_id: str
    shift_pattern: Literal["day", "evening", "night", "all"] | None = None
    is_primary: bool = False


class AssignmentResponse(BaseModel):
    id: str
    staff_id: str
    profile_id: str
    shift_pattern: str | None
    is_primary: bool
    started_at: str


class PatientLinkRequest(BaseModel):
    access_code: str = Field(..., min_length=8, max_length=8)
    unit: str | None = Field(None, max_length=50)
    room: str | None = Field(None, max_length=20)
    bed: str | None = Field(None, max_length=20)


DISEASE_STAGES = Literal["early", "middle", "late", "unknown"]


class ResidentCreateRequest(BaseModel):
    disease_stage: DISEASE_STAGES
    behavioral_patterns: list[str] = Field(default_factory=list)
    calming_strategies: list[str] = Field(default_factory=list)
    safety_concerns: list[str] = Field(default_factory=list)
    unit: str | None = Field(None, max_length=50)
    room: str | None = Field(None, max_length=20)
    bed: str | None = Field(None, max_length=20)
