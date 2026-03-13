from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, Integer, Double, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampMixin
from app.core.database import Base


class CampusEvent(Base, TimestampMixin):
    """Campus event sourced from UMN iCal feeds."""
    __tablename__ = "campus_events"

    event_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    location_name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    category: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    external_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    price: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "title": self.title,
            "location_name": self.location_name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "category": self.category,
            "source_url": self.source_url,
            "external_id": self.external_id,
            "price": self.price,
        }
