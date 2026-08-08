from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin

"""
Server side store for a signed in user's app preferences.

This is the authority for `data_consent`. The client may cache preferences in
localStorage for guests and for offline reads, but any decision about whether
analytics data may be collected is made from this row, never from a request
body or header. See `app/services/consent_service.py`.

One row per user, created lazily on first read or write.
"""


class UserPreferences(Base, TimestampMixin):
    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Privacy control. Server authoritative, only changed through the
    # dedicated consent endpoint so that every transition is audited.
    data_consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Ordinary preferences, synced across devices.
    map_style: Mapped[str] = mapped_column(String(20), nullable=False, default="standard")
    verified_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    directions_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dark_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    selected_tts_voice: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    campus_routing_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # TimestampMixin only supplies created_at, so updated_at is declared here,
    # matching the pattern in app/models/parking_history.py.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "data_consent": self.data_consent,
            "map_style": self.map_style,
            "verified_only": self.verified_only,
            "directions_only": self.directions_only,
            "dark_mode": self.dark_mode,
            "tts_enabled": self.tts_enabled,
            "selected_tts_voice": self.selected_tts_voice,
            "campus_routing_enabled": self.campus_routing_enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
