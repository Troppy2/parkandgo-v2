from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ParkingHistoryCreate(BaseModel):
    spot_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    consent_flag: bool = False


class ParkingHistoryUpdate(BaseModel):
    end_time: Optional[datetime] = None
    consent_flag: Optional[bool] = None


class ParkingHistoryResponse(ParkingHistoryCreate):
    history_id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}