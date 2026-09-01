"""Invite code model — gates B2C signup during private testing.

Codes are shared/reusable (not single-use): the team generates a small
batch ahead of time via scripts/generate_invite_codes.py and distributes
them out-of-band (email, Slack, etc.) to testers. A code stays valid for
every signup attempt until an operator deactivates it (is_active=False) —
there is no per-code usage cap in this pass. `use_count` is informational
only (incremented on each successful profile creation), not enforced.

Whether this gate is even checked is controlled by
Settings.INVITE_CODE_REQUIRED (see app.config) so signup can be reopened
later without a migration or code change.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
    )
