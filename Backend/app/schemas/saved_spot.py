from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.parking_spot import ParkingSpotResponse


class SavedSpotCreate(BaseModel):
    spot_id: int
    custom_name: Optional[str] = None


class SavedSpotRename(BaseModel):
    custom_name: str


class SavedSpotResponse(BaseModel):
    id: int
    user_id: int
    spot_id: int
    custom_name: Optional[str] = None
    created_at: Optional[datetime] = None
    spot: ParkingSpotResponse

    model_config = {"from_attributes": True}