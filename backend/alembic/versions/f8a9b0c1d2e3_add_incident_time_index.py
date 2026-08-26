"""add (profile_id, incident_time) index on incidents

The dossier reads a profile's incidents ordered by incident_time and now also
filters on it (everything past the 365-day decay horizon weighs zero). The
existing composite index is on created_at, which differs from incident_time for
any manually back-logged episode, so that read had no usable index.

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-07-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'idx_incidents_profile_incident_time',
        'incidents',
        ['profile_id', 'incident_time'],
    )


def downgrade() -> None:
    op.drop_index('idx_incidents_profile_incident_time', table_name='incidents')
