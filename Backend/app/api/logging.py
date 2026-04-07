from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_optional_user
from app.core.database import get_db
from app.models.user import User
from app.repositories.parking_history_repository import ParkingHistoryRepository
from app.repositories.recommendation_context_log_repository import (
    RecommendationContextLogRepository,
)
from app.schemas.parking_history import ParkingHistoryCreate, ParkingHistoryResponse
from app.schemas.recommendation_context_log import (
    RecommendationContextLogCreate,
    RecommendationContextLogResponse,
)

router = APIRouter(prefix="/logging", tags=["logging"])
history_router = APIRouter(prefix="/history", tags=["history"])


@router.post("/context", response_model=RecommendationContextLogResponse, status_code=201)
async def create_context_log(
    body: RecommendationContextLogCreate,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    repo = RecommendationContextLogRepository(db)
    return await repo.create_log(
        action=body.action,
        context_data=body.context_data,
        user_id=user.user_id if user else None,
    )


@history_router.get("/me", response_model=list[ParkingHistoryResponse])
async def list_my_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ParkingHistoryRepository(db)
    return await repo.get_by_user(current_user.user_id)


@history_router.post("/", response_model=ParkingHistoryResponse, status_code=201)
async def create_history(
    body: ParkingHistoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ParkingHistoryRepository(db)
    payload = body.model_dump()
    if payload.get("start_time") is None:
        payload["start_time"] = datetime.now(timezone.utc)
    history = await repo.create_history(current_user.user_id, ParkingHistoryCreate(**payload))
    return history
