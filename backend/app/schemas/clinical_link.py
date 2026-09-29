"""Pydantic v2 schemas for the Care Profile ↔ clinical record link."""

from pydantic import BaseModel, Field


class ClinicalLinkRequest(BaseModel):
    patient_uuid: str = Field(..., min_length=36, max_length=36)


class ClinicalLinkPreview(BaseModel):
    """Shown once so the caregiver can confirm the right person. Never stored."""

    display_name: str


class ClinicalLinkStatus(BaseModel):
    linked: bool
    source: str = "openmrs"
    linked_at: str | None = None
    last_synced_at: str | None = None
    last_status: str | None = None
    # Last 4 characters of the patient UUID at most — never the full identifier.
    patient_ref_hint: str | None = None


class ClinicalLinkTestResult(BaseModel):
    status: str
    conditions: int = 0
    medications: int = 0
    allergies: int = 0
    observations: int = 0
