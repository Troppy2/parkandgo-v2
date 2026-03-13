from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.recommendations import invalidate_recommendation_cache
from app.core.caching import get_redis
from app.api.deps import get_admin_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.parking_spot import ParkingSpotResponse
from app.repositories.parking_repository import ParkingRepository

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/")
async def admin_dashboard(
    current_admin: User = Depends(get_admin_user)
):
    return {"message": f"Welcome back, Admin {current_admin.first_name}"}

@router.get("/user")
async def get_admin_info(
    current_admin: User = Depends(get_admin_user)
):
    return current_admin.to_dict()

@router.patch("/spots/{spot_id}/verify", response_model=ParkingSpotResponse)
async def verify_spot(
    spot_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
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
