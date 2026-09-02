"""Pydantic schemas for behavioral pattern insights."""

from pydantic import BaseModel


class CrisisFrequency(BaseModel):
    this_week: int
    last_week: int
    trend: str
    total_sessions: int


class DriftAlert(BaseModel):
    last_count: int
    this_count: int


class EpisodeCycle(BaseModel):
    detected: bool
    avg_interval_days: float | None = None
    last_episode_date: str | None = None
    next_expected_date: str | None = None
    confidence: str | None = None


class CrossPatientBoost(BaseModel):
    cohort: str
    cohort_size: int
    strategies: list[dict] = []


class InsightsPayload(BaseModel):
    crisis_frequency: CrisisFrequency
    peak_time: str
    drift_alert: DriftAlert | None
    resolution_rate: float
    top_triggers: list[str]
    effective_strategies: dict[str, int] = {}
    ineffective_reasons: dict[str, int] = {}
    episode_cycle: EpisodeCycle | None = None
    care_score: int | None = None
    care_level: str | None = None
    top_strategies_for_context: list[str] = []
    cross_patient_boost: CrossPatientBoost | None = None


class InsightsResponse(BaseModel):
    profile_id: str
    computed_at: str
    insights: InsightsPayload
