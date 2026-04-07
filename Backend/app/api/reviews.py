from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repositories.parking_repository import ParkingRepository
from app.repositories.spot_reviews_repository import SpotReviewsRepository
from app.schemas.spot_reviews import SpotReviewCreate, SpotReviewResponse

router = APIRouter(prefix="/reviews", tags=["reviews"])


class SpotReviewSummaryResponse:
    def __init__(self, average_rating: float, review_count: int):
        self.average_rating = average_rating
        self.review_count = review_count


@router.get("/{spot_id}", response_model=list[SpotReviewResponse])
async def list_reviews(
    spot_id: int,
    db: AsyncSession = Depends(get_db),
):
    repo = SpotReviewsRepository(db)
    return await repo.get_reviews_for_spot(spot_id)


@router.get("/{spot_id}/summary")
async def review_summary(
    spot_id: int,
    db: AsyncSession = Depends(get_db),
):
    repo = SpotReviewsRepository(db)
    average_rating, review_count = await repo.get_average_rating(spot_id)
    return {"average_rating": average_rating, "review_count": review_count}


@router.post("/", response_model=SpotReviewResponse, status_code=201)
async def create_or_update_review(
    body: SpotReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parking_repo = ParkingRepository(db)
    spot = await parking_repo.get_by_id(body.spot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Parking spot not found")

    repo = SpotReviewsRepository(db)
    review = await repo.create_review(current_user.user_id, body)
    return review