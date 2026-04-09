from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.parking_history import ParkingHistory
from app.schemas.parking_history import ParkingHistoryCreate, ParkingHistoryUpdate


class ParkingHistoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_history(self, user_id: int, history_data: ParkingHistoryCreate) -> ParkingHistory:
        history = ParkingHistory(user_id=user_id, **history_data.model_dump())
        self.session.add(history)
        await self.session.flush()
        await self.session.refresh(history)
        return history

    async def get_by_user(self, user_id: int) -> list[ParkingHistory]:
        result = await self.session.execute(
            select(ParkingHistory).where(ParkingHistory.user_id == user_id).order_by(ParkingHistory.start_time.desc())
        )
        return list(result.scalars().all())

    async def get_by_user_and_id(self, user_id: int, history_id: int) -> ParkingHistory | None:
        result = await self.session.execute(
            select(ParkingHistory).where(
                ParkingHistory.user_id == user_id,
                ParkingHistory.history_id == history_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_history(self, history: ParkingHistory | int, updates: ParkingHistoryUpdate) -> ParkingHistory | None:
        if isinstance(history, int):
            history = await self.session.get(ParkingHistory, history)
        if history is None:
            return None
        for key, value in updates.model_dump(exclude_unset=True).items():
            setattr(history, key, value)
        await self.session.flush()
        await self.session.refresh(history)
        return history