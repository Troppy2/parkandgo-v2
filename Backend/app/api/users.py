from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.saved_spot import SavedSpotCreate, SavedSpotRename, SavedSpotResponse
from app.repositories.saved_spot_repository import SavedSpotRepository
from app.repositories.parking_repository import ParkingRepository

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/saved", response_model=list[SavedSpotResponse])
async def get_saved_spots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = SavedSpotRepository(db)
    return await repo.get_by_user(current_user.user_id)


@router.post("/me/saved", response_model=SavedSpotResponse, status_code=201)
async def save_spot(
    body: SavedSpotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parking_repo = ParkingRepository(db)
    spot = await parking_repo.get_by_id(body.spot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Parking spot not found")

    repo = SavedSpotRepository(db)
    existing = await repo.get_by_user_and_spot(current_user.user_id, body.spot_id)
    if existing:
        raise HTTPException(status_code=409, detail="Spot already saved")

    data = {
        "user_id": current_user.user_id,
        "spot_id": body.spot_id,
        "custom_name": body.custom_name,
    }
    return await repo.create(data)


@router.delete("/me/saved/{spot_id}", status_code=204)
async def unsave_spot(
    spot_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = SavedSpotRepository(db)
    deleted = await repo.delete_by_user_and_spot(current_user.user_id, spot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved spot not found")


@router.patch("/me/saved/{spot_id}", response_model=SavedSpotResponse)
async def rename_saved_spot(
    spot_id: int,
    body: SavedSpotRename,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = SavedSpotRepository(db)
    saved = await repo.get_by_user_and_spot(current_user.user_id, spot_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved spot not found")

    saved.custom_name = body.custom_name
    await db.flush()
    return saved
