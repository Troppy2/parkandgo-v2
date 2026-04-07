"""add saved_spots table

Revision ID: 857c8dfee309
Revises: f07b82cd0998
Create Date: 2026-03-08 20:25:06.315894

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '857c8dfee309'
down_revision: Union[str, None] = 'f07b82cd0998'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'saved_spots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('spot_id', sa.Integer(), nullable=False),
        sa.Column('custom_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id']),
        sa.ForeignKeyConstraint(['spot_id'], ['parking_spots.spot_id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'spot_id', name='uq_user_spot'),
    )


def downgrade() -> None:
    op.drop_table('saved_spots')
