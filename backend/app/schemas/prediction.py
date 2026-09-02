"""Pydantic v2 schemas for care pattern and cross-patient endpoints."""

from pydantic import BaseModel


class CarePatternReason(BaseModel):
    type: str
    avg_interval_days: float | None = None
    days_since_last: int | None = None


class CarePatternResponse(BaseModel):
    care_level: str
    reason: CarePatternReason
    top_strategies: list[str]
    cross_patient: dict | None = None


class CrossPatientStrategyEntry(BaseModel):
    tag: str
    helped: int
    rate: float


class CrossPatientResponse(BaseModel):
    cohort: str
    cohort_size: int
    strategies: list[CrossPatientStrategyEntry]
