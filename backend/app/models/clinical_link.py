"""Link between a Care Profile and an external clinical record (OpenMRS today).

A separate table rather than a column on ``profiles`` so another source
(e.g. Fitbit) can be another row. ``external_ref`` — the OpenMRS patient
UUID — is AES-256-GCM encrypted like every other identifying field. No patient
name, birth date or other identity field is ever stored here.
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ClinicalLink(Base):
    __tablename__ = "clinical_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # "openmrs"
    external_ref: Mapped[str] = mapped_column(Text, nullable=False)  # encrypted
    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # ok / partial / unavailable / not_found
    last_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    __table_args__ = (
        UniqueConstraint("profile_id", "source", name="uq_clinical_links_profile_source"),
    )
