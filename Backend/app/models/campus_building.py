from typing import Optional

from sqlalchemy import Double, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin

"""
UMN campus buildings, used as walking destinations in Campus Mode.

Reference data, not user content. Rows are seeded from
`app/data/umn_campus_buildings.json`, which is produced by
`scripts/extract_campus_buildings.py` from OpenStreetMap and committed to the
repository so a deploy never depends on Overpass being reachable.

`osm_id` is what makes a re-import idempotent: rerunning the extraction and
reseeding matches on it rather than creating a second copy of every building.
"""


class CampusBuilding(Base, TimestampMixin):
    __tablename__ = "campus_buildings"

    building_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    # Official UMN abbreviation where OSM carries one, for example CMU for
    # Coffman Memorial Union. Roughly 70 percent of rows have it.
    short_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # One of East Bank, West Bank, or St. Paul. Derived at extraction time from
    # the same CAMPUS_BOUNDS boxes that validate user submitted parking spots.
    campus_location: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float] = mapped_column(Double, nullable=False)
    longitude: Mapped[float] = mapped_column(Double, nullable=False)

    # OpenStreetMap element reference, for example "way/30056874".
    osm_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, unique=True)

    __table_args__ = (
        # Supports the bounding box prefilter in find_nearby. Plain B-tree on
        # both columns rather than PostGIS, because the test suite runs on
        # SQLite and a spatial index would not exist there.
        Index("ix_campus_buildings_lat_lon", "latitude", "longitude"),
    )

    def to_dict(self) -> dict:
        return {
            "building_id": self.building_id,
            "name": self.name,
            "short_name": self.short_name,
            "campus_location": self.campus_location,
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "osm_id": self.osm_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
