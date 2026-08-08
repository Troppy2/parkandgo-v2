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
    ContextLogAck,
    RecommendationContextLogCreate,
)
from app.services.consent_service import has_consent

router = APIRouter(prefix="/logging", tags=["logging"])
history_router = APIRouter(prefix="/history", tags=["history"])


@router.post("/context", response_model=ContextLogAck, status_code=201)
async def create_context_log(
    body: RecommendationContextLogCreate,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Record an analytics context event, if and only if the server says the user
    has granted data consent.

    Consent is read from the database, never from the request body or the
    X-Data-Consent header, so a client cannot opt itself in. Guests and
    unauthenticated callers always fail closed. The endpoint still returns 201
    when nothing is stored, so callers need no new error handling.
    """
    if not await has_consent(db, user):
        return ContextLogAck(stored=False, log_id=None)

    repo = RecommendationContextLogRepository(db)
    log = await repo.create_log(
        action=body.action,
        context_data=body.context_data,
        user_id=user.user_id if user else None,
    )
    return ContextLogAck(stored=True, log_id=log.log_id)


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
    """
    Record a parking history row for the signed in user.

    The row is always written: this is the user's own parking history, a
    product feature, not analytics. What consent controls is `consent_flag`,
    which marks whether the row may be used for analytics and recommendations.
    That flag is stamped from the server's stored consent and any value sent by
    the client is ignored.
    """
    repo = ParkingHistoryRepository(db)
    payload = body.model_dump()
    if payload.get("start_time") is None:
        payload["start_time"] = datetime.now(timezone.utc)
    payload["consent_flag"] = await has_consent(db, current_user)
    history = await repo.create_history(current_user.user_id, ParkingHistoryCreate(**payload))
    return history
