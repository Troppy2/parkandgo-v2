"""Add campus_buildings and saved_buildings tables, plus user_preferences.app_mode

Backs Campus Mode, where the list tab switches from parking spots to UMN
buildings and every route is walking only.

Buildings are seeded from app/data/umn_campus_buildings.json, which is
committed to the repository. Seeding deliberately does not call the Overpass
API: a migration must be reproducible and must not fail because a third party
service is rate limiting.

Revision ID: campus_buildings
Revises: user_prefs_consent
Create Date: 2026-08-08

"""
import json
from pathlib import Path
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'campus_buildings'
down_revision: Union[str, None] = 'user_prefs_consent'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SEED_PATH = Path(__file__).resolve().parents[2] / "app" / "data" / "umn_campus_buildings.json"


def upgrade() -> None:
    campus_buildings = op.create_table(
        'campus_buildings',
        sa.Column('building_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('short_name', sa.String(length=100), nullable=True),
        sa.Column('campus_location', sa.String(length=50), nullable=True),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('latitude', sa.Double(), nullable=False),
        sa.Column('longitude', sa.Double(), nullable=False),
        sa.Column('osm_id', sa.String(length=40), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('building_id'),
        sa.UniqueConstraint('osm_id', name='uq_campus_buildings_osm_id'),
    )
    # Supports the bounding box prefilter used by find_nearby before the exact
    # Haversine sort runs in Python.
    op.create_index(
        'ix_campus_buildings_lat_lon',
        'campus_buildings',
        ['latitude', 'longitude'],
    )

    op.create_table(
        'saved_buildings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('building_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['building_id'], ['campus_buildings.building_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'building_id', name='uq_user_building'),
    )

    # Existing users keep today's behavior. Campus Mode is opt in.
    op.add_column(
        'user_preferences',
        sa.Column('app_mode', sa.String(length=20), nullable=False, server_default='parking'),
    )

    _seed_buildings(campus_buildings)


def _seed_buildings(table) -> None:
    """
    Insert the committed building extract.

    Missing or empty seed data is not treated as an error. The schema is what
    this migration is responsible for, and an empty campus_buildings table
    leaves Campus Mode showing an empty list rather than breaking the deploy.
    """
    if not SEED_PATH.exists():
        print(f"  campus_buildings: seed file not found at {SEED_PATH}, skipping seed")
        return

    rows = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    if not rows:
        return

    op.bulk_insert(table, [
        {
            "name": row["name"],
            "short_name": row.get("short_name"),
            "campus_location": row.get("campus_location"),
            "address": row.get("address"),
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "osm_id": row.get("osm_id"),
        }
        for row in rows
    ])
    print(f"  campus_buildings: seeded {len(rows)} buildings")


def downgrade() -> None:
    op.drop_column('user_preferences', 'app_mode')
    op.drop_table('saved_buildings')
    op.drop_index('ix_campus_buildings_lat_lon', table_name='campus_buildings')
    op.drop_table('campus_buildings')
