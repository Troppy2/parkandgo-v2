from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models.campus_building import CampusBuilding
from app.repositories.base import BaseRepository
from app.utils.geo import bounding_box_for_radius, haversine_miles

"""
CampusBuildingRepository handles all database operations for UMN buildings.
Inherits get_all() and create() from BaseRepository.
"""


class CampusBuildingRepository(BaseRepository):
    def __init__(self, session: AsyncSession):
        super().__init__(session, CampusBuilding)

    async def get_by_id(self, id: int) -> CampusBuilding | None:
        # Override base class because our primary key is building_id, not id
        result = await self.session.execute(
            select(CampusBuilding).where(CampusBuilding.building_id == id)
        )
        return result.scalar_one_or_none()

    async def search(self, query: str, limit: int = 20) -> list[CampusBuilding]:
        """
        Case-insensitive search over name, abbreviation, and address.

        Matching short_name matters more than it looks: OSM carries the
        official UMN abbreviations, so a student typing "CMU" finds Coffman
        Memorial Union without knowing the full name.
        """
        result = await self.session.execute(
            select(CampusBuilding)
            .where(
                or_(
                    CampusBuilding.name.ilike(f"%{query}%"),
                    CampusBuilding.short_name.ilike(f"%{query}%"),
                    CampusBuilding.address.ilike(f"%{query}%"),
                )
            )
            .order_by(CampusBuilding.name)
            .limit(limit)
        )
        return result.scalars().all()

    async def filter_by_campus(self, campus: str | None = None) -> list[CampusBuilding]:
        query = select(CampusBuilding)
        if campus:
            query = query.where(CampusBuilding.campus_location == campus)
        result = await self.session.execute(query.order_by(CampusBuilding.name))
        return result.scalars().all()

    async def find_nearby(
        self,
        latitude: float,
        longitude: float,
        limit: int = 20,
        radius_miles: float = 1.5,
    ) -> list[tuple[CampusBuilding, float]]:
        """
        Return (building, distance_miles) nearest first.

        Two stages on purpose. A bounding box in SQL narrows the candidates
        using the (latitude, longitude) index, then an exact Haversine sort
        runs in Python over what survives. The box is a slight overestimate, so
        it never drops a building the exact check would have kept; correctness
        rests on the Haversine pass.

        This avoids PostGIS entirely, which matters because the test suite runs
        on SQLite in memory where a spatial extension does not exist. At 261
        buildings the Python sort is trivial regardless.
        """
        lat_min, lat_max, lon_min, lon_max = bounding_box_for_radius(
            latitude, longitude, radius_miles
        )

        result = await self.session.execute(
            select(CampusBuilding).where(
                CampusBuilding.latitude.between(lat_min, lat_max),
                CampusBuilding.longitude.between(lon_min, lon_max),
            )
        )
        candidates = result.scalars().all()

        measured = [
            (building, haversine_miles(latitude, longitude, building.latitude, building.longitude))
            for building in candidates
        ]
        within_radius = [pair for pair in measured if pair[1] <= radius_miles]
        within_radius.sort(key=lambda pair: pair[1])

        return within_radius[:limit]
