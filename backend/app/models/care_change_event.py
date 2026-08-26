"""Care change event model — tracks medication/care changes with observation windows.

The description field is AES-256-GCM encrypted. During an active observation window,
pre-change incidents are excluded from cycle detection and risk scoring.
"""

from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Index, Integer, String, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class CareChangeEvent(Base):
    __tablename__ = "care_change_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id"), nullable=False
    )

    change_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    observation_window_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=28
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("idx_care_changes_profile", "profile_id", "is_active"),
    )
