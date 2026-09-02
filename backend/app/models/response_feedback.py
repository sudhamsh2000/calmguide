"""ResponseFeedback model — per-response caregiver feedback (encrypted)."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ResponseFeedback(Base):
    __tablename__ = "response_feedback"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    helpful: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    negative_reasons: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=lambda: datetime.now(UTC),
    )
