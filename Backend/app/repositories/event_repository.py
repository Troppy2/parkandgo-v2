from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.base import BaseRepository
from app.models.campus_event import CampusEvent
from datetime import datetime, timezone, timedelta



"""
Build repository with get_upcoming, get_by_category, delete_older_than methods. 
delete_older_than is what the cleanup job calls
"""
class EventRepository(BaseRepository):
    
    def __init__(self, session: AsyncSession):
        super().__init__(session, CampusEvent)
    
    async def get_upcoming(self, limit: int = 20) -> list[CampusEvent]: 
        """
        This function gets upcomming events, orders them from ascending roder, and only limits it to 20 event
        """
        results = await self.session.execute(
            select(CampusEvent).where(CampusEvent.starts_at > datetime.now(timezone.utc)).order_by(CampusEvent.starts_at.asc()).limit(limit)
        )
        return results.scalars().all() 
    
    async def get_by_category(self, category: str, limit: int = 20) -> list[CampusEvent]:
        # fetch upcoming events in the given category, ordered by start time
        # note: CampusEvent has no `date` field; use starts_at and compare to now
        results = await self.session.execute(
            select(CampusEvent)
            .where(
                CampusEvent.category == category,
                CampusEvent.starts_at > datetime.now(timezone.utc),
            )
            .order_by(CampusEvent.starts_at.asc())
            .limit(limit)
        )
        return results.scalars().all()
        
    async def delete_older_than(self, cutoff: datetime) -> int:
        # Automatically deletes a campus event if its older than 24hrs
        result = await self.session.execute(
        delete(CampusEvent).where(CampusEvent.starts_at < cutoff)
        )
        await self.session.flush()

        return result.rowcount 
    