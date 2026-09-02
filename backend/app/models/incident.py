"""Incident model — structured ABC (Antecedent-Behavior-Consequence) records.

Narrative fields (antecedent_description, behavior_description,
intervention_description, metadata) are AES-256-GCM encrypted before storage.
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("profiles.id"), nullable=False)
    conversation_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("conversations.id"), nullable=True
    )

    source: Mapped[str] = mapped_column(String(20), nullable=False)
    incident_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    time_slot: Mapped[str | None] = mapped_column(String(10), nullable=True)

    behavior_category: Mapped[str] = mapped_column(String(30), nullable=False)
    behavior_subcategory: Mapped[str | None] = mapped_column(String(30), nullable=True)
    npi_domain: Mapped[str | None] = mapped_column(String(30), nullable=True)
    severity: Mapped[str | None] = mapped_column(String(10), nullable=True)
    duration_category: Mapped[str | None] = mapped_column(String(20), nullable=True)

    antecedent_description: Mapped[str | None] = mapped_column(String, nullable=True)
    antecedent_category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    behavior_description: Mapped[str] = mapped_column(String, nullable=False)
    intervention_description: Mapped[str | None] = mapped_column(String, nullable=True)
    intervention_outcome: Mapped[str | None] = mapped_column(String(25), nullable=True)
    location: Mapped[str | None] = mapped_column(String(30), nullable=True)

    is_recurring: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    caregiver_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recall_confidence: Mapped[str] = mapped_column(
        String(10), nullable=False, default="high", insert_default="high"
    )

    extraction_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    verified_by_caregiver: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, insert_default=False
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    staff_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("staff.id"), nullable=True)
    facility_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("facilities.id"), nullable=True
    )

    extra_metadata: Mapped[str | None] = mapped_column("metadata", String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_incidents_profile_time", "profile_id", "created_at"),
        # Dossier reads filter and sort on incident_time, which is the clinical
        # event time and differs from created_at for back-logged episodes.
        Index("idx_incidents_profile_incident_time", "profile_id", "incident_time"),
        Index("idx_incidents_profile_category", "profile_id", "behavior_category"),
        Index("idx_incidents_severity_time", "severity", "created_at"),
    )
