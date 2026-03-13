from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CampusEventResponse(BaseModel):
    event_id: int
    title: str
    location_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    category: str
    source_url: Optional[str] = None
    external_id: str
    price: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
