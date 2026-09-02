from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class StaffPatientAssignment(Base):
    __tablename__ = "staff_patient_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    staff_id: Mapped[str] = mapped_column(String(36), ForeignKey("staff.id"), nullable=False)
    profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("profiles.id"), nullable=False)
    facility_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("facilities.id"), nullable=False
    )
    shift_pattern: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, insert_default=False
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("staff_id", "profile_id", "ended_at", name="uq_staff_patient_active"),
        Index("idx_assignments_staff_active", "staff_id", postgresql_where="ended_at IS NULL"),
        Index("idx_assignments_profile_active", "profile_id", postgresql_where="ended_at IS NULL"),
        Index(
            "idx_assignments_facility_active", "facility_id", postgresql_where="ended_at IS NULL"
        ),
    )
