"""add invite_codes table

Shared, reusable invite codes that gate B2C signup (POST /profiles) during
private testing. See app/models/invite_code.py for the usage model and
Settings.INVITE_CODE_REQUIRED (app/config.py) for the on/off switch.

Revision ID: c5d6e7f8a9b0
Revises: a3b4c5d6e7f8
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'invite_codes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('code_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('label', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('use_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_invite_codes_code_hash', 'invite_codes', ['code_hash'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_invite_codes_code_hash', table_name='invite_codes')
    op.drop_table('invite_codes')
