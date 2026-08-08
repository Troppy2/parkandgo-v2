from app.models.user import User
from app.models.parking_spot import ParkingSpot
from app.models.saved_spot import SavedSpot
from app.models.app_config import AppConfig
from app.models.campus_event import CampusEvent
from app.models.spot_reviews import SpotReview
from app.models.parking_history import ParkingHistory
from app.models.recommendation_context_log import RecommendationContextLog
from app.models.user_private_spots import UserPrivateSpot
from app.models.user_preferences import UserPreferences
from app.models.consent_event import ConsentEvent

__all__ = [
    "User",
    "ParkingSpot",
    "SavedSpot",
    "AppConfig",
    "CampusEvent",
    "SpotReview",
    "ParkingHistory",
    "RecommendationContextLog",
    "UserPrivateSpot",
    "UserPreferences",
    "ConsentEvent",
]
