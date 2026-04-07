from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserPrivateSpotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    latitude: float
    longitude: float
    notes: Optional[str] = None
    is_default: bool = False


class UserPrivateSpotUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    is_default: Optional[bool] = None


class UserPrivateSpotResponse(UserPrivateSpotCreate):
    private_spot_id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}