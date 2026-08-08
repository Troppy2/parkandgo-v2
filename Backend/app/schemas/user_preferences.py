from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

MapStyle = Literal["standard", "satellite", "3d"]


class UserPreferencesUpdate(BaseModel):
    """
    Partial update for ordinary preferences.

    `data_consent` is deliberately absent. Consent is a privacy control and only
    moves through PUT /users/me/preferences/consent so that every transition is
    written to the audit trail. Extra keys are rejected rather than ignored, so a
    client that tries to smuggle data_consent in here gets a clear 422.
    """

    map_style: Optional[MapStyle] = None
    verified_only: Optional[bool] = None
    directions_only: Optional[bool] = None
    dark_mode: Optional[bool] = None
    tts_enabled: Optional[bool] = None
    selected_tts_voice: Optional[str] = Field(default=None, max_length=120)
    campus_routing_enabled: Optional[bool] = None

    model_config = {"extra": "forbid"}


class UserPreferencesResponse(BaseModel):
    user_id: int
    data_consent: bool
    map_style: MapStyle
    verified_only: bool
    directions_only: bool
    dark_mode: bool
    tts_enabled: bool
    selected_tts_voice: Optional[str] = None
    campus_routing_enabled: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ConsentUpdate(BaseModel):
    granted: bool
    # Optional coarse client hint, for example "web" or "android".
    client_platform: Optional[str] = Field(default=None, max_length=50)

    model_config = {"extra": "forbid"}


class ConsentResponse(BaseModel):
    user_id: int
    data_consent: bool
    changed: bool
    updated_at: Optional[datetime] = None
