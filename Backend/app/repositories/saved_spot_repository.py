from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.saved_spot import SavedSpot
from app.repositories.base import BaseRepository


class SavedSpotRepository(BaseRepository):
    def __init__(self, session: AsyncSession):
        super().__init__(session, SavedSpot)

    async def get_by_user(self, user_id: int) -> list[SavedSpot]:
        result = await self.session.execute(
            select(SavedSpot).where(SavedSpot.user_id == user_id)
        )
        return result.scalars().all()

    async def get_by_user_and_spot(self, user_id: int, spot_id: int) -> SavedSpot | None:
        result = await self.session.execute(
            select(SavedSpot).where(
                SavedSpot.user_id == user_id,
                SavedSpot.spot_id == spot_id,
            )
        )
        return result.scalar_one_or_none()

    async def rename(self, saved_spot_id: int, custom_name: str) -> SavedSpot | None:
        spot = await self.get_by_id(saved_spot_id)
        if not spot:
            return None
        spot.custom_name = custom_name
        await self.session.flush()
        return spot

    async def delete_by_user_and_spot(self, user_id: int, spot_id: int) -> bool:
        saved = await self.get_by_user_and_spot(user_id, spot_id)
        if not saved:
            return False
        self.session.delete(saved)
        await self.session.flush()
        return True
