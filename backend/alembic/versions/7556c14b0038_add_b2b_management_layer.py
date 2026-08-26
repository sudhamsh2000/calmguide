"""add b2b management layer

Revision ID: 7556c14b0038
Revises: d4e5f6a7b8c9
Create Date: 2026-04-29 16:44:18.837376

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '7556c14b0038'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- facilities ---
    op.create_table(
        'facilities',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('facility_code_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('settings', postgresql.JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_facilities_facility_code_hash', 'facilities', ['facility_code_hash'])

    # --- staff ---
    op.create_table(
        'staff',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('facility_id', sa.String(36), sa.ForeignKey('facilities.id'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('pin_hash', sa.String(64), nullable=True),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('language_preference', sa.String(10), nullable=False, server_default='en-US'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('failed_login_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_staff_facility_id', 'staff', ['facility_id'])
    op.create_index('ix_staff_email', 'staff', ['email'])

    # --- staff_patient_assignments ---
    op.create_table(
        'staff_patient_assignments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('staff_id', sa.String(36), sa.ForeignKey('staff.id'), nullable=False),
        sa.Column('profile_id', sa.String(36), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('facility_id', sa.String(36), sa.ForeignKey('facilities.id'), nullable=False),
        sa.Column('shift_pattern', sa.String(10), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('staff_id', 'profile_id', 'ended_at', name='uq_staff_patient_active'),
    )
    op.create_index(
        'idx_assignments_staff_active', 'staff_patient_assignments', ['staff_id'],
        postgresql_where=sa.text('ended_at IS NULL'),
    )
    op.create_index(
        'idx_assignments_profile_active', 'staff_patient_assignments', ['profile_id'],
        postgresql_where=sa.text('ended_at IS NULL'),
    )
    op.create_index(
        'idx_assignments_facility_active', 'staff_patient_assignments', ['facility_id'],
        postgresql_where=sa.text('ended_at IS NULL'),
    )

    # --- facility_patient_links ---
    op.create_table(
        'facility_patient_links',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('facility_id', sa.String(36), sa.ForeignKey('facilities.id'), nullable=False),
        sa.Column('profile_id', sa.String(36), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('linked_by', sa.String(36), sa.ForeignKey('staff.id'), nullable=True),
        sa.Column('unit', sa.String(50), nullable=True),
        sa.Column('room', sa.String(20), nullable=True),
        sa.Column('bed', sa.String(10), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('linked_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('facility_id', 'profile_id', name='uq_facility_patient'),
    )
    op.create_index(
        'idx_fpl_facility_active', 'facility_patient_links', ['facility_id'],
        postgresql_where=sa.text('is_active = true'),
    )

    # --- audit_logs ---
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('staff.id'), nullable=False),
        sa.Column('user_name', sa.String(100), nullable=False),
        sa.Column('user_role', sa.String(20), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('resource_type', sa.String(30), nullable=False),
        sa.Column('resource_id', sa.String(36), nullable=True),
        sa.Column('outcome', sa.String(10), nullable=False, server_default='SUCCESS'),
        sa.Column('facility_id', sa.String(36), sa.ForeignKey('facilities.id'), nullable=False),
        sa.Column('source_ip', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_facility_id', 'audit_logs', ['facility_id'])

    # --- Add staff_id and facility_id to incidents ---
    op.add_column('incidents', sa.Column('staff_id', sa.String(36), sa.ForeignKey('staff.id'), nullable=True))
    op.add_column('incidents', sa.Column('facility_id', sa.String(36), sa.ForeignKey('facilities.id'), nullable=True))

    # --- Add staff_id and facility_id to conversations ---
    op.add_column('conversations', sa.Column('staff_id', sa.String(36), sa.ForeignKey('staff.id'), nullable=True))
    op.add_column('conversations', sa.Column('facility_id', sa.String(36), sa.ForeignKey('facilities.id'), nullable=True))

    # --- RLS policies (defense-in-depth) ---
    op.execute('ALTER TABLE incidents ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE conversations ENABLE ROW LEVEL SECURITY')
    op.execute("""
        CREATE POLICY facility_isolation_incidents ON incidents
        USING (
            facility_id IS NULL
            OR facility_id::text = current_setting('app.current_facility_id', true)
        )
    """)
    op.execute("""
        CREATE POLICY facility_isolation_conversations ON conversations
        USING (
            facility_id IS NULL
            OR facility_id::text = current_setting('app.current_facility_id', true)
        )
    """)

    # Audit logs: append-only — revoke UPDATE/DELETE from application role
    # Note: This assumes the application connects as 'calmguide' role.
    # Adjust the role name if different in your environment.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'calmguide') THEN
                REVOKE UPDATE, DELETE ON audit_logs FROM calmguide;
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS facility_isolation_conversations ON conversations')
    op.execute('DROP POLICY IF EXISTS facility_isolation_incidents ON incidents')
    op.execute('ALTER TABLE conversations DISABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE incidents DISABLE ROW LEVEL SECURITY')

    op.drop_column('conversations', 'facility_id')
    op.drop_column('conversations', 'staff_id')
    op.drop_column('incidents', 'facility_id')
    op.drop_column('incidents', 'staff_id')

    op.drop_table('audit_logs')
    op.drop_table('facility_patient_links')
    op.drop_table('staff_patient_assignments')
    op.drop_table('staff')
    op.drop_table('facilities')
