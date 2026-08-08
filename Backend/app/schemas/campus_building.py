from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CampusBuildingResponse(BaseModel):
    building_id: int
    name: str
    short_name: Optional[str] = None
    campus_location: Optional[str] = None
    address: Optional[str] = None
    latitude: float
    longitude: float
    osm_id: Optional[str] = None
    created_at: Optional[datetime] = None

    # Populated only by the nearby endpoint, which knows where the user is.
    # Left as None everywhere else rather than faked, so the client can tell
    # "no distance available" apart from "zero miles away".
    distance_miles: Optional[float] = None

    model_config = {"from_attributes": True}


class SavedBuildingCreate(BaseModel):
    building_id: int

    model_config = {"extra": "forbid"}


class SavedBuildingResponse(BaseModel):
    id: int
    user_id: int
    building_id: int
    created_at: Optional[datetime] = None
    building: CampusBuildingResponse

    model_config = {"from_attributes": True}
