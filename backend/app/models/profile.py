"""Profile model — stores clinical data, never PII."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    access_code_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    disease_stage: Mapped[str] = mapped_column(String(20), nullable=False)
    behavioral_patterns: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    calming_strategies: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    safety_concerns: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
    )
    stage_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    previous_stage: Mapped[str | None] = mapped_column(String(10), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
