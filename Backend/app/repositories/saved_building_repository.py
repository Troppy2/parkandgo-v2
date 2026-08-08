from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.saved_building import SavedBuilding
from app.repositories.base import BaseRepository


class SavedBuildingRepository(BaseRepository):
    def __init__(self, session: AsyncSession):
        super().__init__(session, SavedBuilding)

    async def get_by_user(self, user_id: int) -> list[SavedBuilding]:
        result = await self.session.execute(
            select(SavedBuilding)
            .options(selectinload(SavedBuilding.building))
            .where(SavedBuilding.user_id == user_id)
        )
        return result.scalars().all()

    async def get_by_user_and_building(
        self, user_id: int, building_id: int
    ) -> SavedBuilding | None:
        result = await self.session.execute(
            select(SavedBuilding)
            .options(selectinload(SavedBuilding.building))
            .where(
                SavedBuilding.user_id == user_id,
                SavedBuilding.building_id == building_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> SavedBuilding:
        instance = SavedBuilding(**data)
        self.session.add(instance)
        await self.session.flush()
        # Eager load the relationship so the response schema can serialize the
        # nested building without a lazy load on an already closed session.
        await self.session.refresh(instance, ["building"])
        return instance

    async def delete_by_user_and_building(self, user_id: int, building_id: int) -> bool:
        saved = await self.get_by_user_and_building(user_id, building_id)
        if not saved:
            return False
        await self.session.delete(saved)
        await self.session.flush()
        return True
