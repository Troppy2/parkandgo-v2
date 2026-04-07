from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repositories.user_private_spots_repository import UserPrivateSpotRepository
from app.schemas.user_private_spots import (
    UserPrivateSpotCreate,
    UserPrivateSpotResponse,
    UserPrivateSpotUpdate,
)

router = APIRouter(prefix="/private-spots", tags=["private-spots"])


@router.get("/", response_model=list[UserPrivateSpotResponse])
async def list_private_spots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserPrivateSpotRepository(db)
    return await repo.get_by_user(current_user.user_id)


@router.post("/", response_model=UserPrivateSpotResponse, status_code=201)
async def create_private_spot(
    body: UserPrivateSpotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserPrivateSpotRepository(db)
    return await repo.create_private_spot(current_user.user_id, body)


@router.patch("/{private_spot_id}", response_model=UserPrivateSpotResponse)
async def update_private_spot(
    private_spot_id: int,
    body: UserPrivateSpotUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserPrivateSpotRepository(db)
    updated = await repo.update_private_spot(current_user.user_id, private_spot_id, body)
    if updated is None:
        raise HTTPException(status_code=404, detail="Private spot not found")
    return updated


@router.delete("/{private_spot_id}", status_code=204)
async def delete_private_spot(
    private_spot_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserPrivateSpotRepository(db)
    deleted = await repo.delete_private_spot(current_user.user_id, private_spot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Private spot not found")
    return None
