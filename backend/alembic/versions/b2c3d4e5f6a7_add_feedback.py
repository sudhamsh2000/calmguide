"""Add response_feedback table and suggested_tags column.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "response_feedback",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("conversation_id", sa.String(36), nullable=False),
        sa.Column("helpful", sa.Boolean(), nullable=True),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("negative_reasons", sa.Text(), nullable=True),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_id"),
    )
    op.create_index("ix_response_feedback_conversation_id", "response_feedback", ["conversation_id"])
    op.add_column("conversations", sa.Column("suggested_tags", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversations", "suggested_tags")
    op.drop_index("ix_response_feedback_conversation_id", table_name="response_feedback")
    op.drop_table("response_feedback")
