"""Add locale_code to conversations, create profile_insights, re-encrypt existing data.

Revision ID: a1b2c3d4e5f6
Revises: 821016c91a14
Create Date: 2026-04-01 00:00:00.000000
"""
import base64
import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "821016c91a14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _encrypt(plaintext: str, key: bytes) -> str:
    """Inline encrypt for migration — avoids importing app code."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return "ENC:" + base64.b64encode(nonce + ct).decode("ascii")


def upgrade() -> None:
    # 1. Add locale_code column to conversations
    op.add_column("conversations", sa.Column("locale_code", sa.String(10), nullable=True))

    # 2. Create profile_insights table
    op.create_table(
        "profile_insights",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("profile_id", sa.String(36), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("insights_json", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id"),
    )
    op.create_index("ix_profile_insights_profile_id", "profile_insights", ["profile_id"])

    # 3. Re-encrypt existing data (skip if key not configured)
    key_b64 = os.environ.get("CONVERSATION_ENCRYPTION_KEY", "")
    if not key_b64:
        return

    key = base64.b64decode(key_b64)
    conn = op.get_bind()

    # Re-encrypt conversations.content
    rows = conn.execute(
        sa.text("SELECT id, content FROM conversations WHERE content NOT LIKE 'ENC:%'")
    ).fetchall()
    for row_id, content in rows:
        conn.execute(
            sa.text("UPDATE conversations SET content = :c WHERE id = :id"),
            {"c": _encrypt(content, key), "id": row_id},
        )

    # Re-encrypt profile JSON fields
    profile_rows = conn.execute(
        sa.text("SELECT id, behavioral_patterns, calming_strategies, safety_concerns FROM profiles")
    ).fetchall()
    for row_id, bp, cs, sc in profile_rows:
        conn.execute(
            sa.text(
                "UPDATE profiles SET behavioral_patterns=:bp, "
                "calming_strategies=:cs, safety_concerns=:sc WHERE id=:id"
            ),
            {
                "bp": _encrypt(bp, key) if not bp.startswith("ENC:") else bp,
                "cs": _encrypt(cs, key) if not cs.startswith("ENC:") else cs,
                "sc": _encrypt(sc, key) if not sc.startswith("ENC:") else sc,
                "id": row_id,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_profile_insights_profile_id", table_name="profile_insights")
    op.drop_table("profile_insights")
    op.drop_column("conversations", "locale_code")
