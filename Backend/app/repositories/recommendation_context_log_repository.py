from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recommendation_context_log import RecommendationContextLog


class RecommendationContextLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_log(
        self,
        action: str,
        context_data: dict,
        user_id: int | None = None,
    ) -> RecommendationContextLog:
        log = RecommendationContextLog(action=action, context_data=context_data, user_id=user_id)
        self.session.add(log)
        await self.session.flush()
        await self.session.refresh(log)
        return log

    async def get_recent(self, limit: int = 25) -> list[RecommendationContextLog]:
        result = await self.session.execute(
            select(RecommendationContextLog).order_by(RecommendationContextLog.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())