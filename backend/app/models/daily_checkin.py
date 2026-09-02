"""DailyCheckin model — daily behavioral log per profile."""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DailyCheckin(Base):
    __tablename__ = "daily_checkin"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    profile_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("profiles.id"),
        nullable=False,
        index=True,
    )
    check_date: Mapped[date] = mapped_column(Date, nullable=False)
    time_slot: Mapped[str | None] = mapped_column(String(10), nullable=True)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
    )
