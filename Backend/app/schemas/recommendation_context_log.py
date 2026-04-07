from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class RecommendationContextLogCreate(BaseModel):
    action: str = Field(min_length=1, max_length=100)
    context_data: dict[str, Any]


class RecommendationContextLogResponse(RecommendationContextLogCreate):
    log_id: int
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}