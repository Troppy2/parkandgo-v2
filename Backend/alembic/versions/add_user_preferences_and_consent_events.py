"""Add user_preferences and consent_events tables

Moves data consent and the rest of the app preferences to server side storage
so they are authoritative and consistent across devices. Consent defaults to
false for every existing user, which is the correct fail closed behavior: no
one is opted in by a migration.

Revision ID: user_prefs_consent
Revises: seed_umn_parking_spots
Create Date: 2026-08-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'user_prefs_consent'
down_revision: Union[str, None] = 'seed_umn_parking_spots'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_preferences',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('data_consent', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('map_style', sa.String(length=20), nullable=False, server_default='standard'),
        sa.Column('verified_only', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('directions_only', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('dark_mode', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('tts_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('selected_tts_voice', sa.String(length=120), nullable=True),
        sa.Column('campus_routing_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )

    op.create_table(
        'consent_events',
        sa.Column('event_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('granted', sa.Boolean(), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False, server_default='user_toggle'),
        sa.Column('client_platform', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('event_id'),
    )
    op.create_index(
        'ix_consent_events_user_id_created_at',
        'consent_events',
        ['user_id', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_consent_events_user_id_created_at', table_name='consent_events')
    op.drop_table('consent_events')
    op.drop_table('user_preferences')
