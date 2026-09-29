"""add clinical_links table

Links a Care Profile to an external clinical record (OpenMRS). See
app/models/clinical_link.py and Settings.OPENMRS_ENABLED (app/config.py).

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clinical_links',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('profile_id', sa.String(36), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('source', sa.String(20), nullable=False),
        sa.Column('external_ref', sa.Text(), nullable=False),
        sa.Column('linked_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_status', sa.String(20), nullable=True),
        sa.UniqueConstraint('profile_id', 'source', name='uq_clinical_links_profile_source'),
    )
    op.create_index('ix_clinical_links_profile_id', 'clinical_links', ['profile_id'])


def downgrade() -> None:
    op.drop_index('ix_clinical_links_profile_id', table_name='clinical_links')
    op.drop_table('clinical_links')
