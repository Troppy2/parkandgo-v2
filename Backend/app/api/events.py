from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.event_repository import EventRepository
from app.schemas.campus_event import CampusEventResponse
from app.utils.ical_feeds import CATEGORY_FEEDS

router = APIRouter(prefix="/events", tags=["events"])

# cached set of allowed category values (keys of CATEGORY_FEEDS)
VALID_CATEGORIES = frozenset(CATEGORY_FEEDS.keys())


@router.get("/", response_model=list[CampusEventResponse])
async def get_events(
    # using Literal here would shift validation to FastAPI/Pydantic and return 422,
    # but we still perform a manual membership check to give a clean 400 response.
    category: str | None = Query(default=None, description="Filter by category"),
    limit: int = Query(default=20),
    db: AsyncSession = Depends(get_db)
):
    repo = EventRepository(db)

    if category:
        # ensure category is one of the five known values
        if category not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category '{category}'. Must be one of {sorted(VALID_CATEGORIES)}",
            )
        events = await repo.get_by_category(category, limit)
    else:
        events = await repo.get_upcoming(limit)
    return events


@router.get("/{event_id}", response_model=CampusEventResponse)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = EventRepository(db)
    event = await repo.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event