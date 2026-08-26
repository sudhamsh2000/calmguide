"""Add daily_checkin and cross_patient_strategies tables.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-02 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_checkin",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("profile_id", sa.String(36), nullable=False),
        sa.Column("check_date", sa.Date(), nullable=False),
        sa.Column("time_slot", sa.String(10), nullable=True),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_daily_checkin_profile_date", "daily_checkin", ["profile_id", "check_date"])

    op.create_table(
        "cross_patient_strategies",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("cohort_key", sa.String(30), nullable=False),
        sa.Column("strategy_tag", sa.String(30), nullable=False),
        sa.Column("helped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_profiles", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cohort_key", "strategy_tag", name="uq_cohort_strategy"),
    )


def downgrade() -> None:
    op.drop_table("cross_patient_strategies")
    op.drop_index("ix_daily_checkin_profile_date", table_name="daily_checkin")
    op.drop_table("daily_checkin")
