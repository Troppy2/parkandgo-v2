from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# What comes IN when updating a profile
class UserProfileUpdate(BaseModel):
    prefered_name: Optional[str] = None
    major: Optional[str] = None
    major_category: Optional[str] = None
    grade_level: Optional[str] = None
    graduation_year: Optional[int] = None
    housing_type: Optional[str] = None
    preferred_parking_types: Optional[str] = None

# What goes OUT when returning user data
class UserResponse(BaseModel):
    user_id: int
    google_id: Optional[str] = None
    email: Optional[str] = None
    profile_pic: Optional[str] = None
    first_name: str
    last_name: str
    prefered_name: Optional[str] = None
    preferred_parking_types: Optional[str] = None
    major: Optional[str] = None
    major_category: Optional[str] = None
    grade_level: Optional[str] = None
    graduation_year: Optional[int] = None
    housing_type: Optional[str] = None
    is_profile_complete: bool
    created_at: Optional[datetime] = None
    is_admin: Optional[bool] = False

    model_config = {"from_attributes": True}

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str    # add this
    token_type: str
    user: UserResponse

class RefreshTokenRequest(BaseModel):
    refresh_token: str