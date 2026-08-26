"""Safety event log — structured, category-only audit trail for safety-critical events.

Distinct from `AuditLog` (which requires a Staff + Facility and serves B2B
compliance auditing). Safety events can originate from B2C caregivers who
have no Staff/Facility record, so `staff_id`/`facility_id` here are nullable.

Rows must never contain raw free text or PHI. `details` is restricted to
categorical/boolean data (matched concept labels, flag names, confidence
scores) — never the caregiver's original message.
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

_JSON = JSONB().with_variant(JSON(), "sqlite")


class SafetyEvent(Base):
    __tablename__ = "safety_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )

    # e.g. "safety_gate_triggered", "classifier_flagged", "acute_change_screen",
    # "emergency_action_selected", "rag_retrieval"
    event_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)

    # e.g. "life_threat", "self_harm", "caregiver_harm_risk", "elder_abuse_neglect",
    # "medical_evaluation_recommended", "proceed_to_coaching"
    category: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)

    # "deterministic_gate" | "classifier" | "acute_change_screen" | "user_action"
    source: Mapped[str] = mapped_column(String(30), nullable=False)

    profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("profiles.id"), nullable=True, index=True
    )
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    staff_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("staff.id"), nullable=True
    )
    facility_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("facilities.id"), nullable=True
    )

    locale_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    model_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Categorical only — flag names, matched concept labels, booleans. Never
    # raw caregiver-authored free text.
    details: Mapped[dict | None] = mapped_column(_JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_safety_events_profile_time", "profile_id", "created_at"),
        Index("idx_safety_events_type_category", "event_type", "category"),
    )
