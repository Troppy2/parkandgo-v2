"""initial schema with is_admin and submitted_by

Revision ID: f07b82cd0998
Revises: 
Create Date: 2026-03-08 16:16:59.243107

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f07b82cd0998'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            google_id VARCHAR(255) UNIQUE,
            email VARCHAR(255) UNIQUE,
            profile_pic VARCHAR(500),
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            prefered_name VARCHAR(100) NOT NULL,
            preferred_parking_types VARCHAR(250),
            major VARCHAR(100),
            major_category VARCHAR(100),
            grade_level VARCHAR(100),
            graduation_year INTEGER,
            housing_type VARCHAR(50),
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS parking_spots (
            spot_id SERIAL PRIMARY KEY,
            spot_name VARCHAR(100) NOT NULL,
            campus_location VARCHAR(100),
            parking_type VARCHAR(100),
            cost DOUBLE PRECISION,
            walk_time VARCHAR(100),
            near_buildings TEXT,
            address VARCHAR(255),
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            is_verified BOOLEAN DEFAULT FALSE,
            submitted_by INTEGER REFERENCES users(user_id),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS parking_spots"))
    op.execute(sa.text("DROP TABLE IF EXISTS users"))
