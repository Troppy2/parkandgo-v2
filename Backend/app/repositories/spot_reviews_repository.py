from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.spot_reviews import SpotReview
from app.schemas.spot_reviews import SpotReviewCreate, SpotReviewUpdate


class SpotReviewsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_review(self, user_id: int, review_data: SpotReviewCreate) -> SpotReview:
        existing = await self.get_by_user_and_spot(user_id, review_data.spot_id)
        if existing is not None:
            for key, value in review_data.model_dump().items():
                setattr(existing, key, value)
            await self.session.flush()
            await self.session.refresh(existing)
            return existing

        review = SpotReview(user_id=user_id, **review_data.model_dump())
        self.session.add(review)
        await self.session.flush()
        await self.session.refresh(review)
        return review

    async def get_reviews_for_spot(self, spot_id: int) -> list[SpotReview]:
        result = await self.session.execute(
            select(SpotReview).where(SpotReview.spot_id == spot_id).order_by(SpotReview.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_reviews_for_user(self, user_id: int) -> list[SpotReview]:
        result = await self.session.execute(
            select(SpotReview).where(SpotReview.user_id == user_id).order_by(SpotReview.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_user_and_spot(self, user_id: int, spot_id: int) -> SpotReview | None:
        result = await self.session.execute(
            select(SpotReview).where(SpotReview.user_id == user_id, SpotReview.spot_id == spot_id)
        )
        return result.scalar_one_or_none()

    async def update_review(self, review_id: int, updates: SpotReviewUpdate) -> SpotReview | None:
        review = await self.session.get(SpotReview, review_id)
        if review is None:
            return None
        for key, value in updates.model_dump(exclude_unset=True).items():
            setattr(review, key, value)
        await self.session.flush()
        await self.session.refresh(review)
        return review

    async def get_average_rating(self, spot_id: int) -> tuple[float, int]:
        result = await self.session.execute(
            select(func.avg(SpotReview.rating), func.count(SpotReview.review_id)).where(SpotReview.spot_id == spot_id)
        )
        avg_rating, count = result.one()
        return float(avg_rating or 0), int(count or 0)
