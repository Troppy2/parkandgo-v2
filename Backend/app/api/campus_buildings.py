import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.caching import get_redis
from app.core.database import get_db
from app.repositories.campus_building_repository import CampusBuildingRepository
from app.schemas.campus_building import CampusBuildingResponse
from app.utils.geo import CAMPUS_BOUNDS

router = APIRouter(prefix="/campus-buildings", tags=["campus-buildings"])

# Buildings are reference data seeded by a migration. They only change when
# someone reruns the extraction script and ships a new migration, so this is
# cached far longer than the 5 minutes used for parking spots.
CACHE_TTL_SECONDS = 3600

VALID_CAMPUSES = frozenset(CAMPUS_BOUNDS.keys())


@router.get("/", response_model=list[CampusBuildingResponse])
async def get_all_buildings(
    campus: str | None = Query(default=None, description="East Bank, West Bank, or St. Paul"),
    db: AsyncSession = Depends(get_db),
):
    """Return all campus buildings, optionally filtered by campus. Cached for an hour."""
    if campus and campus not in VALID_CAMPUSES:
        raise HTTPException(
            status_code=400,
            detail=f"campus must be one of: {', '.join(sorted(VALID_CAMPUSES))}",
        )

    cache = await get_redis()
    cache_key = f"campus_buildings:all:{campus or 'any'}"
    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await CampusBuildingRepository(db).filter_by_campus(campus)
    serialized = [
        CampusBuildingResponse.model_validate(b).model_dump(mode="json") for b in result
    ]
    await cache.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(serialized))
    return serialized


@router.get("/search", response_model=list[CampusBuildingResponse])
async def search_buildings(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Search buildings by name, official abbreviation, or address.

    An empty query returns nothing rather than the whole table, so a cleared
    search box does not silently turn into a 261 row response.
    """
    query = q.strip()
    if not query:
        return []

    cache = await get_redis()
    cache_key = f"campus_buildings:search:{query}:{limit}"
    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await CampusBuildingRepository(db).search(query, limit)
    serialized = [
        CampusBuildingResponse.model_validate(b).model_dump(mode="json") for b in result
    ]
    await cache.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(serialized))
    return serialized


@router.get("/nearby", response_model=list[CampusBuildingResponse])
async def get_nearby_buildings(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    limit: int = Query(default=20, ge=1, le=100),
    radius_miles: float = Query(default=1.5, gt=0, le=25),
    db: AsyncSession = Depends(get_db),
):
    """
    Buildings nearest to a point, closest first, with the distance attached.

    Not cached: the key would be the user's exact coordinates, so it would miss
    on essentially every request while filling Redis with single use entries.
    """
    pairs = await CampusBuildingRepository(db).find_nearby(lat, lon, limit, radius_miles)

    responses = []
    for building, distance in pairs:
        response = CampusBuildingResponse.model_validate(building)
        response.distance_miles = round(distance, 3)
        responses.append(response)
    return responses


@router.get("/{building_id}", response_model=CampusBuildingResponse)
async def get_building(building_id: int, db: AsyncSession = Depends(get_db)):
    """Return a single building by id."""
    building = await CampusBuildingRepository(db).get_by_id(building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return building
