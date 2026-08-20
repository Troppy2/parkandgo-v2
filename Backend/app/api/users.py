from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserProfileUpdate, UserResponse
from app.schemas.saved_spot import SavedSpotCreate, SavedSpotRename, SavedSpotResponse
from app.schemas.user_preferences import (
    ConsentResponse,
    ConsentUpdate,
    UserPreferencesResponse,
    UserPreferencesUpdate,
)
from app.schemas.campus_building import SavedBuildingCreate, SavedBuildingResponse
from app.repositories.saved_spot_repository import SavedSpotRepository
from app.repositories.parking_repository import ParkingRepository
from app.repositories.user_preferences_repository import UserPreferencesRepository
from app.repositories.campus_building_repository import CampusBuildingRepository
from app.repositories.saved_building_repository import SavedBuildingRepository
from app.services.account_deletion_service import delete_user_account

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/preferences", response_model=UserPreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the current user's preferences, creating defaults on first read.

    This is the value the client should treat as authoritative on app load.
    """
    repo = UserPreferencesRepository(db)
    return await repo.get_or_create(current_user.user_id)


@router.patch("/me/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    body: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update ordinary preferences. Only provided fields change.

    data_consent is not accepted here, the schema forbids extra keys so an
    attempt to set it returns 422. Use PUT /users/me/preferences/consent.
    """
    repo = UserPreferencesRepository(db)
    return await repo.update(current_user.user_id, body)


@router.put("/me/preferences/consent", response_model=ConsentResponse)
async def set_data_consent(
    body: ConsentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Grant or revoke data consent. Every real transition appends a ConsentEvent.

    This is the only way consent changes, which is what makes the audit trail
    complete and the flag trustworthy for collection decisions.
    """
    repo = UserPreferencesRepository(db)
    prefs, changed = await repo.set_consent(
        current_user.user_id,
        granted=body.granted,
        client_platform=body.client_platform,
    )
    return ConsentResponse(
        user_id=prefs.user_id,
        data_consent=prefs.data_consent,
        changed=changed,
        updated_at=prefs.updated_at,
    )


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    body: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile fields. Only provided fields are changed."""
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    await db.flush()
    return current_user


@router.delete("/me", status_code=204)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently delete the signed in user and all personal data attached to it.

    Irreversible, and deliberately available in the app rather than only by
    emailing a human: an account you can create in two taps should not take a
    support request to remove. What exactly is deleted, anonymized, or kept
    lives in `app/services/account_deletion_service.py`, which is the module
    the privacy policy is written against.

    204 with no body. The client is expected to drop its tokens afterwards,
    since they now authenticate a user that no longer exists.
    """
    await delete_user_account(db, current_user)
    return None


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


# ── Saved campus buildings ──
# Separate from saved spots above because saved_spots.spot_id is bound by a
# foreign key to parking_spots. Same shape, different table.


@router.get("/me/saved-buildings", response_model=list[SavedBuildingResponse])
async def get_saved_buildings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = SavedBuildingRepository(db)
    return await repo.get_by_user(current_user.user_id)


@router.post("/me/saved-buildings", response_model=SavedBuildingResponse, status_code=201)
async def save_building(
    body: SavedBuildingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    building_repo = CampusBuildingRepository(db)
    building = await building_repo.get_by_id(body.building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Campus building not found")

    repo = SavedBuildingRepository(db)
    existing = await repo.get_by_user_and_building(current_user.user_id, body.building_id)
    if existing:
        raise HTTPException(status_code=409, detail="Building already saved")

    return await repo.create({
        "user_id": current_user.user_id,
        "building_id": body.building_id,
    })


@router.delete("/me/saved-buildings/{building_id}", status_code=204)
async def unsave_building(
    building_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = SavedBuildingRepository(db)
    deleted = await repo.delete_by_user_and_building(current_user.user_id, building_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved building not found")
