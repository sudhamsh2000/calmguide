"""add safety_events table

Structured, categorical-only safety event log (safety gate triggers,
classifier flags, acute-change screen outcomes, emergency-action selections).
Distinct from audit_logs: profile_id/staff_id/facility_id are nullable so
B2C (access-code) caregivers with no Staff/Facility record can also be
logged. `details` must never contain raw free text or PHI.

Revision ID: a3b4c5d6e7f8
Revises: f8a9b0c1d2e3
Create Date: 2026-08-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'safety_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('event_type', sa.String(40), nullable=False),
        sa.Column('category', sa.String(40), nullable=True),
        sa.Column('source', sa.String(30), nullable=False),
        sa.Column('profile_id', sa.String(36), sa.ForeignKey('profiles.id'), nullable=True),
        sa.Column('session_id', sa.String(36), nullable=True),
        sa.Column('staff_id', sa.String(36), sa.ForeignKey('staff.id'), nullable=True),
        sa.Column('facility_id', sa.String(36), sa.ForeignKey('facilities.id'), nullable=True),
        sa.Column('locale_code', sa.String(10), nullable=True),
        sa.Column('model_provider', sa.String(50), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_safety_events_event_type', 'safety_events', ['event_type'])
    op.create_index('ix_safety_events_category', 'safety_events', ['category'])
    op.create_index('ix_safety_events_profile_id', 'safety_events', ['profile_id'])
    op.create_index('ix_safety_events_session_id', 'safety_events', ['session_id'])
    op.create_index('idx_safety_events_profile_time', 'safety_events', ['profile_id', 'created_at'])
    op.create_index('idx_safety_events_type_category', 'safety_events', ['event_type', 'category'])


def downgrade() -> None:
    op.drop_index('idx_safety_events_type_category', table_name='safety_events')
    op.drop_index('idx_safety_events_profile_time', table_name='safety_events')
    op.drop_index('ix_safety_events_session_id', table_name='safety_events')
    op.drop_index('ix_safety_events_profile_id', table_name='safety_events')
    op.drop_index('ix_safety_events_category', table_name='safety_events')
    op.drop_index('ix_safety_events_event_type', table_name='safety_events')
    op.drop_table('safety_events')
