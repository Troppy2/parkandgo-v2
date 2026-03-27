from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.parking_spot import ParkingSpot
from app.repositories.base import BaseRepository

"""
ParkingRepository handles all database operations for parking spots.
Inherits get_all() and create() from BaseRepository.
"""
class ParkingRepository(BaseRepository):
    def __init__(self, session: AsyncSession):
        # Passes ParkingSpot as the model to BaseRepository
        # so inherited methods (get_all, create) know which table to use
        super().__init__(session, ParkingSpot)

    async def get_by_id(self, id: int):
        # Override base class because our primary key is spot_id, not id
        result = await self.session.execute(
            select(ParkingSpot).where(ParkingSpot.spot_id == id)
        )
        return result.scalar_one_or_none()

    async def search(self, query: str, limit: int = 5):
        # Searches across multiple fields using ilike (case-insensitive LIKE)
        # f"%{query}%" means "contains this text anywhere in the string"
        # or_() means a match in ANY of these fields will return the row
        result = await self.session.execute(
            select(ParkingSpot)
            .where(
                or_(
                    ParkingSpot.spot_name.ilike(f"%{query}%"),
                    ParkingSpot.campus_location.ilike(f"%{query}%"),
                    ParkingSpot.near_buildings.ilike(f"%{query}%"),
                    ParkingSpot.address.ilike(f"%{query}%"),
                )
            )
            .limit(limit)
        )
        return result.scalars().all()

    async def filter_spots(self, campus: str = None, parking_type: str = None, max_cost: float = None, verified_only: bool = None):
        query = select(ParkingSpot)

        # Each filter is optional, only applied if the caller provides it
        # This lets the frontend send any combination of filters
        if campus:
            query = query.where(ParkingSpot.campus_location == campus)
        if parking_type:
            query = query.where(ParkingSpot.parking_type == parking_type)
        if max_cost is not None:
            query = query.where(ParkingSpot.cost <= max_cost)
        if verified_only:
            query = query.where(ParkingSpot.is_verified == True)

        result = await self.session.execute(query)
        return result.scalars().all()
