from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SpotReviewBase(BaseModel):
    spot_id: int
    rating: int = Field(ge=1, le=5)
    notes: Optional[str] = None


class SpotReviewCreate(SpotReviewBase):
    pass


class SpotReviewUpdate(BaseModel):
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    notes: Optional[str] = None


class SpotReviewResponse(SpotReviewBase):
    review_id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}