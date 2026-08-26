"""Pydantic schemas for incident CRUD, patterns, dossier, and verification."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


BEHAVIOR_CATEGORIES = Literal[
    "aggression_anger", "confusion_disorientation", "wandering_exit_seeking",
    "refusing_care", "sleep_problems", "hallucinations",
    "repetitive_behavior", "other",
]

SEVERITY_LEVELS = Literal["mild", "moderate", "severe"]

DURATION_CATEGORIES = Literal["seconds", "minutes", "about_an_hour", "longer"]

ANTECEDENT_CATEGORIES = Literal[
    "task_demand", "transition", "environmental", "social", "physical_state", "unknown",
]

INTERVENTION_OUTCOMES = Literal[
    "resolved", "partially_resolved", "unresolved", "escalated",
]

CAREGIVER_ROLES = Literal[
    "spouse", "adult_child", "paid_aide", "other_family", "other",
]


class IncidentCreate(BaseModel):
    behavior_category: BEHAVIOR_CATEGORIES
    behavior_description: str = Field(..., min_length=1, max_length=4000)
    incident_time: datetime

    source: Literal["manual", "voice"] = "manual"
    staff_id: str | None = None
    facility_id: str | None = None
    severity: SEVERITY_LEVELS | None = None
    duration_category: DURATION_CATEGORIES | None = None
    antecedent_description: str | None = Field(None, max_length=4000)
    antecedent_category: ANTECEDENT_CATEGORIES | None = None
    intervention_description: str | None = Field(None, max_length=4000)
    intervention_outcome: INTERVENTION_OUTCOMES | None = None
    location: str | None = None
    caregiver_role: CAREGIVER_ROLES | None = None
    is_recurring: bool | None = None


class IncidentUpdate(BaseModel):
    behavior_category: BEHAVIOR_CATEGORIES | None = None
    behavior_description: str | None = None
    severity: SEVERITY_LEVELS | None = None
    antecedent_description: str | None = None
    antecedent_category: ANTECEDENT_CATEGORIES | None = None
    intervention_description: str | None = None
    intervention_outcome: INTERVENTION_OUTCOMES | None = None
    location: str | None = None
    is_recurring: bool | None = None


class IncidentResponse(BaseModel):
    id: str
    profile_id: str
    conversation_id: str | None
    source: str
    incident_time: str
    time_slot: str | None
    behavior_category: str
    behavior_subcategory: str | None
    severity: str | None
    duration_category: str | None
    antecedent_description: str | None
    antecedent_category: str | None
    behavior_description: str
    intervention_description: str | None
    intervention_outcome: str | None
    location: str | None
    is_recurring: bool | None
    caregiver_role: str | None
    recall_confidence: str
    extraction_confidence: float | None
    verified_by_caregiver: bool
    created_at: str


class IncidentListResponse(BaseModel):
    incidents: list[IncidentResponse]
    total: int


class VerificationPending(BaseModel):
    incident_id: str
    summary_text: str


class VerifyRequest(BaseModel):
    approved: bool
    corrections: IncidentUpdate | None = None


class PatternResponse(BaseModel):
    time_clusters: dict
    frequency_trends: dict
    effective_interventions: list[dict]
    contraindicated: list[dict]
    escalation_pattern: str | None
    confidence_level: str


class DossierResponse(BaseModel):
    dossier_text: str | None
    contraindicated: list[dict]
    effective: list[dict]
    escalation_pattern: str | None
    frequency_trends: dict
    delirium_flags: dict | None
    pain_flags: dict | None
    is_stale: bool
    computed_at: str | None
