from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_private_spots import UserPrivateSpot
from app.schemas.user_private_spots import UserPrivateSpotCreate, UserPrivateSpotUpdate


class UserPrivateSpotRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_private_spot(self, user_id: int, spot_data: UserPrivateSpotCreate) -> UserPrivateSpot:
        spot = UserPrivateSpot(user_id=user_id, **spot_data.model_dump())
        self.session.add(spot)
        await self.session.flush()
        await self.session.refresh(spot)
        return spot

    async def get_by_user(self, user_id: int) -> list[UserPrivateSpot]:
        result = await self.session.execute(
            select(UserPrivateSpot).where(UserPrivateSpot.user_id == user_id).order_by(UserPrivateSpot.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_user_and_id(self, user_id: int, private_spot_id: int) -> UserPrivateSpot | None:
        result = await self.session.execute(
            select(UserPrivateSpot).where(
                UserPrivateSpot.user_id == user_id,
                UserPrivateSpot.private_spot_id == private_spot_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_private_spot(
        self,
        user_id: int,
        private_spot_id: int,
        updates: UserPrivateSpotUpdate,
    ) -> UserPrivateSpot | None:
        spot = await self.get_by_user_and_id(user_id, private_spot_id)
        if spot is None:
            return None
        for key, value in updates.model_dump(exclude_unset=True).items():
            setattr(spot, key, value)
        await self.session.flush()
        await self.session.refresh(spot)
        return spot

    async def delete_private_spot(self, user_id: int, private_spot_id: int) -> bool:
        spot = await self.get_by_user_and_id(user_id, private_spot_id)
        if spot is None:
            return False
        await self.session.delete(spot)
        await self.session.flush()
        return True