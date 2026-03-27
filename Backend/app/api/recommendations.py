import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
from app.services.recommendation_engine import RecommendationEngine, ScoredSpot
from app.core.database import get_db
from app.api.deps import get_current_user, get_optional_user
from app.models.user import User
from app.repositories.parking_repository import ParkingRepository
from app.repositories.event_repository import EventRepository
from app.schemas.parking_spot import ParkingSpotResponse
from app.schemas.recommendation import RecommendationResponse
import json
from app.core.caching import get_redis
from app.utils.metrics import recommendation_requests_total

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


async def invalidate_recommendation_cache(cache: redis.Redis, pattern: str = "recommendations:*"):
    keys = await cache.keys(pattern)
    if keys:
        await cache.delete(*keys)

@router.get("/", response_model=list[RecommendationResponse])
async def get_recommendations(
    user: User | None = Depends(get_optional_user),
    user_lat: float | None = Query(default=None),
    user_lon: float | None = Query(default=None),
    campus_location: str | None = Query(default=None, description="Filter recommendations to a specific campus"),
    limit: int = Query(default=3),
    event_id: int | None = Query(default=None, description="Event ID to boost nearby parking spots"),
    event_lat: float | None = Query(default=None, description="Latitude of event for proximity scoring"),
    event_lon: float | None = Query(default=None, description="Longitude of event for proximity scoring"),
    verified_only: bool | None = Query(default=None, description="Only return verified spots"),
    travel_mode: str = Query(default="driving", description="Travel mode: walking, cycling, or driving"),  # NEW
    db: AsyncSession = Depends(get_db)
):
    # If event_id is provided, fetch the event and use its coordinates
    if event_id is not None:
        event_repo = EventRepository(db)
        event = await event_repo.get_by_id(event_id)
        if event is None:
            raise HTTPException(status_code=404, detail="Event not found")
        event_lat = event.latitude
        event_lon = event.longitude

    recommendation_requests_total.labels(
        campus_location=campus_location or "all",
        verified_only=str(verified_only or False),
    ).inc()

    cache_key = f"recommendations:{user.user_id if user else 'guest'}:{user_lat}:{user_lon}:{limit}:{campus_location}:{event_id}:{event_lat}:{event_lon}:{verified_only}:{travel_mode}"  # UPDATED: added travel_mode

    try:
        cache = await get_redis()
        cached = await cache.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        cache = None  # Redis unavailable — fall through to live query

    repo = ParkingRepository(db)
    engine = RecommendationEngine(repo)
    scored_spots = await engine.get_recommendations(
        user, user_lat, user_lon, limit, event_lat=event_lat, event_lon=event_lon, travel_mode=travel_mode  # ADDED: travel_mode
    )

    if campus_location is not None:
        scored_spots = [
            s for s in scored_spots
            if s.spot.campus_location and s.spot.campus_location.lower() == campus_location.lower()
        ]

    if verified_only:
        scored_spots = [
            s for s in scored_spots
            if s.spot.is_verified
        ]

    result = [
        RecommendationResponse(
            spot=spot.spot,
            score=spot.score,
            score_breakdown=spot.score_breakdown,
        )
        for spot in scored_spots
    ]

    try:
        if cache is not None:
            await cache.setex(cache_key, 300, json.dumps([r.model_dump(mode="json") for r in result]))
    except Exception as e:
        logger.warning("Cache write failed for key %s: %s", cache_key, e)

    return result
