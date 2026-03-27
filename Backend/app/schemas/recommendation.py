from pydantic import BaseModel
from app.schemas.parking_spot import ParkingSpotResponse


class RecommendationResponse(BaseModel):
    spot: ParkingSpotResponse
    score: float
    score_breakdown: dict
    model_config = {"from_attributes": True}
