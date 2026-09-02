"""Behavioral dossier model — pre-computed per-profile narrative summary.

All content fields are AES-256-GCM encrypted. Uses a dirty-flag pattern:
is_stale=True means the dossier needs recomputation (triggered by new incidents).
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class BehavioralDossier(Base):
    __tablename__ = "behavioral_dossier"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id"), nullable=False, unique=True
    )

    is_stale: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    dossier_text: Mapped[str | None] = mapped_column(String, nullable=True)
    contraindicated_json: Mapped[str | None] = mapped_column(String, nullable=True)
    effective_json: Mapped[str | None] = mapped_column(String, nullable=True)
    escalation_pattern: Mapped[str | None] = mapped_column(String, nullable=True)
    seven_day_timeline: Mapped[str | None] = mapped_column(String, nullable=True)
    frequency_trends: Mapped[str | None] = mapped_column(String, nullable=True)
    medication_correlation: Mapped[str | None] = mapped_column(String, nullable=True)
    caregiver_distress_trend: Mapped[str | None] = mapped_column(String, nullable=True)
    delirium_flags: Mapped[str | None] = mapped_column(String, nullable=True)
    pain_flags: Mapped[str | None] = mapped_column(String, nullable=True)

    computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    __table_args__ = (Index("idx_dossier_stale", "is_stale"),)
