from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# What goes OUT when returning parking spot data
class ParkingSpotResponse(BaseModel):
    spot_id: int
    spot_name: str
    campus_location: Optional[str] = None
    parking_type: Optional[str] = None
    cost: Optional[float] = None
    walk_time: Optional[str] = None
    near_buildings: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_verified: Optional[bool] = None
    submitted_by: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

# What comes IN when creating a new parking spot
class ParkingSpotCreate(BaseModel):
    spot_name: str
    campus_location: str
    parking_type: str
    cost: float
    walk_time: Optional[str] = None
    near_buildings: Optional[str] = None
    address: str
    latitude: float
    longitude: float

# What comes IN when updating a parking spot
class ParkingSpotUpdate(BaseModel):
    spot_name: Optional[str] = None
    campus_location: Optional[str] = None
    parking_type: Optional[str] = None
    cost: Optional[float] = None
    walk_time: Optional[str] = None
    near_buildings: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_verified: Optional[bool] = None
