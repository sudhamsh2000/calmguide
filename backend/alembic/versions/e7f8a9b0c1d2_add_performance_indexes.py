"""add performance indexes

Adds the missing index on conversations.profile_id (scanned on every
insights/history/cross-patient query) and a composite index on
audit_logs(facility_id, timestamp) for the facility audit-log listing.

Revision ID: e7f8a9b0c1d2
Revises: 7556c14b0038
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = '7556c14b0038'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_conversations_profile_id', 'conversations', ['profile_id']
    )
    # Equality on facility_id + ORDER BY timestamp DESC for the audit list.
    op.create_index(
        'ix_audit_logs_facility_id_timestamp',
        'audit_logs',
        ['facility_id', 'timestamp'],
    )


def downgrade() -> None:
    op.drop_index('ix_audit_logs_facility_id_timestamp', table_name='audit_logs')
    op.drop_index('ix_conversations_profile_id', table_name='conversations')
