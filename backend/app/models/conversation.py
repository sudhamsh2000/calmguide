"""Conversation history model — linked by session_id, not user ID (privacy)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    profile_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("profiles.id"),
        nullable=False,
        index=True,  # filtered on every insights/history/cross-patient query
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False)  # "user" or "assistant"
    locale_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    suggested_tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # encrypted JSON
    content: Mapped[str] = mapped_column(Text, nullable=False)
    caregiver_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_safety_gate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    staff_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("staff.id"), nullable=True
    )
    facility_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("facilities.id"), nullable=True
    )
    extra_metadata: Mapped[str | None] = mapped_column(
        "metadata", String, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
    )
