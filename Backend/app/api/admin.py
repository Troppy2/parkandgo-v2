from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user
from app.api.recommendations import invalidate_recommendation_cache
from app.core.caching import get_redis
from app.core.database import get_db
from app.models.parking_spot import ParkingSpot
from app.models.user import User
from app.models.campus_event import CampusEvent
from app.repositories.app_config_repository import AppConfigRepository
from app.repositories.parking_repository import ParkingRepository
from app.schemas.parking_spot import ParkingSpotResponse
from app.services.event_sync_service import EventSyncService

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Schemas ──

class ConfigUpdate(BaseModel):
    value: str


class StatsResponse(BaseModel):
    total_spots: int
    verified_spots: int
    unverified_spots: int
    total_users: int
    total_events: int


# ── Dashboard / user info ──

@router.get("/")
async def admin_dashboard(current_admin: User = Depends(get_admin_user)):
    return {"message": f"Welcome back, Admin {current_admin.first_name}"}


@router.get("/user")
async def get_admin_info(current_admin: User = Depends(get_admin_user)):
    return current_admin.to_dict()


# ── Spot management ──

@router.get("/spots/unverified", response_model=list[ParkingSpotResponse])
async def get_unverified_spots(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all spots where is_verified is False."""
    result = await db.execute(
        select(ParkingSpot).where(ParkingSpot.is_verified == False)
    )
    return result.scalars().all()


@router.patch("/spots/{spot_id}/verify", response_model=ParkingSpotResponse)
async def verify_spot(
    spot_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ParkingRepository(db)
    spot = await repo.get_by_id(spot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Parking spot not found")

    spot.is_verified = True
    await db.flush()
    cache = await get_redis()
    await invalidate_recommendation_cache(cache)
    return spot


@router.delete("/spots/{spot_id}", status_code=204)
async def delete_spot(
    spot_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a parking spot (reject a community submission)."""
    repo = ParkingRepository(db)
    spot = await repo.get_by_id(spot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Parking spot not found")
    await db.delete(spot)
    await db.flush()
    cache = await get_redis()
    await invalidate_recommendation_cache(cache)


# ── Stats ──

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate stats for the admin dashboard."""
    total_spots = (await db.execute(select(func.count(ParkingSpot.spot_id)))).scalar() or 0
    verified = (await db.execute(
        select(func.count(ParkingSpot.spot_id)).where(ParkingSpot.is_verified == True)
    )).scalar() or 0
    total_users = (await db.execute(select(func.count(User.user_id)))).scalar() or 0
    total_events = (await db.execute(select(func.count(CampusEvent.event_id)))).scalar() or 0

    return StatsResponse(
        total_spots=total_spots,
        verified_spots=verified,
        unverified_spots=total_spots - verified,
        total_users=total_users,
        total_events=total_events,
    )


# ── Event sync ──

@router.post("/events/sync", status_code=201)
async def manual_event_sync(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a one-off event sync regardless of schedule."""
    config_repo = AppConfigRepository(db)
    await config_repo.set_value(
        "event_sync_last_run",
        datetime.now(timezone.utc).isoformat(),
    )
    sync_service = EventSyncService(db)
    count = await sync_service.sync_events()
    return {"synced": count}


# ── Config (key-value settings) ──

@router.get("/config")
async def get_all_config(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all key-value config entries."""
    repo = AppConfigRepository(db)
    rows = await repo.get_all()
    return [r.to_dict() for r in rows]


@router.patch("/config/{key}")
async def update_config(
    key: str,
    body: ConfigUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a single config entry by key."""
    repo = AppConfigRepository(db)
    config = await repo.set_value(key, body.value)
    return config.to_dict()
