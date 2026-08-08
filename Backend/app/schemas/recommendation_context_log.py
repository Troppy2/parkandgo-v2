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


class ContextLogAck(BaseModel):
    """
    Acknowledgement for a context log submission.

    The endpoint always succeeds so callers need no new error handling, but
    `stored` reports whether the row was actually persisted. It is False when
    the user has not granted data consent, including for guests.
    """

    stored: bool
    log_id: Optional[int] = None