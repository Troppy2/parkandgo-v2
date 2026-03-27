import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.recommendations import invalidate_recommendation_cache
from app.core.caching import get_redis
from app.core.database import get_db
from app.models.user import User
from app.repositories.parking_repository import ParkingRepository
from app.schemas.parking_spot import ParkingSpotCreate, ParkingSpotResponse
from app.utils.geo import is_within_campus_bounds
from app.core.limiter import limiter
from app.utils.metrics import spot_submissions_total, search_queries_total

router = APIRouter(prefix="/parking", tags=["parking"])


@router.get("/", response_model=list[ParkingSpotResponse])
async def get_all_spots(db: AsyncSession = Depends(get_db)):
    """Return all parking spots. Cached for 5 minutes."""
    cache = await get_redis()
    cache_key = "parking:all"
    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await ParkingRepository(db).get_all()
    serialized = [ParkingSpotResponse.model_validate(s).model_dump(mode="json") for s in result]
    await cache.setex(cache_key, 300, json.dumps(serialized))
    return serialized


@router.get("/search", response_model=list[ParkingSpotResponse])
async def search_spots(
    q: str = Query(default="", description="Search query"),
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across spot name, campus, nearby buildings, and address. Cached per query."""
    search_queries_total.inc()
    cache = await get_redis()
    cache_key = f"parking:search:{q}"
    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await ParkingRepository(db).search(q)
    serialized = [ParkingSpotResponse.model_validate(s).model_dump(mode="json") for s in result]
    await cache.setex(cache_key, 300, json.dumps(serialized))
    return serialized


@router.get("/filter", response_model=list[ParkingSpotResponse])
async def filter_spots(
    campus: str | None = Query(default=None),
    parking_type: str | None = Query(default=None),
    max_cost: float | None = Query(default=None),
    verified_only: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Filter spots by any combination of campus, parking type, max cost, and verified status."""
    return await ParkingRepository(db).filter_spots(campus, parking_type, max_cost, verified_only)


@router.post("/", response_model=ParkingSpotResponse, status_code=201)
@limiter.limit("5/minute")
async def create_spot(
    request: Request,
    spot_data: ParkingSpotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a new parking spot. Validates coordinates are within a UMN campus boundary.
    New spots are unverified by default — an admin must verify them before they score higher."""
    if not is_within_campus_bounds(spot_data.latitude, spot_data.longitude):
        raise HTTPException(status_code=400, detail="Coordinates must be within a UMN campus boundary")

    data = spot_data.model_dump()
    data["is_verified"] = False           # always server-enforced, never from user input
    data["submitted_by"] = current_user.user_id

    spot = await ParkingRepository(db).create(data)
    spot_submissions_total.inc()

    # Bust the recommendations cache so the new spot is eligible immediately
    await invalidate_recommendation_cache(await get_redis())
    return spot
