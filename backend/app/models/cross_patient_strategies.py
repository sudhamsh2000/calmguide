"""CrossPatientStrategies model — anonymized aggregate strategy effectiveness."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CrossPatientStrategies(Base):
    __tablename__ = "cross_patient_strategies"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    cohort_key: Mapped[str] = mapped_column(String(30), nullable=False)
    strategy_tag: Mapped[str] = mapped_column(String(30), nullable=False)
    helped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_profiles: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("cohort_key", "strategy_tag", name="uq_cohort_strategy"),
    )
