"""Add incident memory system tables.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-29 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("profile_id", sa.String(36), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("conversations.id"), nullable=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("incident_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("time_slot", sa.String(10), nullable=True),
        sa.Column("behavior_category", sa.String(30), nullable=False),
        sa.Column("behavior_subcategory", sa.String(30), nullable=True),
        sa.Column("npi_domain", sa.String(30), nullable=True),
        sa.Column("severity", sa.String(10), nullable=True),
        sa.Column("duration_category", sa.String(20), nullable=True),
        sa.Column("antecedent_description", sa.String, nullable=True),
        sa.Column("antecedent_category", sa.String(20), nullable=True),
        sa.Column("behavior_description", sa.String, nullable=False),
        sa.Column("intervention_description", sa.String, nullable=True),
        sa.Column("intervention_outcome", sa.String(25), nullable=True),
        sa.Column("location", sa.String(30), nullable=True),
        sa.Column("is_recurring", sa.Boolean, nullable=True),
        sa.Column("caregiver_role", sa.String(20), nullable=True),
        sa.Column("recall_confidence", sa.String(10), nullable=False, server_default="high"),
        sa.Column("extraction_confidence", sa.Float, nullable=True),
        sa.Column("verified_by_caregiver", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_incidents_profile_time", "incidents", ["profile_id", "created_at"])
    op.create_index("idx_incidents_profile_category", "incidents", ["profile_id", "behavior_category"])
    op.create_index("idx_incidents_severity_time", "incidents", ["severity", "created_at"])

    op.create_table(
        "behavioral_dossier",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("profile_id", sa.String(36), sa.ForeignKey("profiles.id"), nullable=False, unique=True),
        sa.Column("is_stale", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("version", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("dossier_text", sa.String, nullable=True),
        sa.Column("contraindicated_json", sa.String, nullable=True),
        sa.Column("effective_json", sa.String, nullable=True),
        sa.Column("escalation_pattern", sa.String, nullable=True),
        sa.Column("seven_day_timeline", sa.String, nullable=True),
        sa.Column("frequency_trends", sa.String, nullable=True),
        sa.Column("medication_correlation", sa.String, nullable=True),
        sa.Column("caregiver_distress_trend", sa.String, nullable=True),
        sa.Column("delirium_flags", sa.String, nullable=True),
        sa.Column("pain_flags", sa.String, nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "care_change_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("profile_id", sa.String(36), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("change_date", sa.Date, nullable=False),
        sa.Column("description", sa.String, nullable=False),
        sa.Column("observation_window_days", sa.Integer, nullable=False, server_default=sa.text("28")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_care_changes_profile", "care_change_events", ["profile_id", "is_active"])

    # Modify existing tables
    op.add_column("conversations", sa.Column("caregiver_role", sa.String(20), nullable=True))
    op.add_column("conversations", sa.Column("is_safety_gate", sa.Boolean, nullable=False, server_default=sa.text("false")))
    op.add_column("conversations", sa.Column("metadata", sa.String, nullable=True))
    op.add_column("profiles", sa.Column("stage_changed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("profiles", sa.Column("previous_stage", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "previous_stage")
    op.drop_column("profiles", "stage_changed_at")
    op.drop_column("conversations", "metadata")
    op.drop_column("conversations", "is_safety_gate")
    op.drop_column("conversations", "caregiver_role")

    op.drop_index("idx_care_changes_profile", table_name="care_change_events")
    op.drop_table("care_change_events")
    op.drop_table("behavioral_dossier")
    op.drop_index("idx_incidents_severity_time", table_name="incidents")
    op.drop_index("idx_incidents_profile_category", table_name="incidents")
    op.drop_index("idx_incidents_profile_time", table_name="incidents")
    op.drop_table("incidents")
