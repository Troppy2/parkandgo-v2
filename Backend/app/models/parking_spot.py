from typing import Optional
from sqlalchemy import String, Double, Text, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampMixin
from app.core.database import Base

"""
This file does 3 things:
1. `ParkingSpot`: holds the model for parking_spot in the postgres table,
2. `TimestampMixin`: adds a timestamp for when a parking_spot was made or updated
3. `Base`: This registers the parking_spot class as a SQLAlchemy model
"""
class ParkingSpot(Base, TimestampMixin):
  __tablename__ = "parking_spots"
  spot_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
  spot_name: Mapped[str] = mapped_column(String(100), nullable=False)
  campus_location: Mapped[Optional[str]] = mapped_column(String(100))
  parking_type: Mapped[Optional[str]] = mapped_column(String(100))
  cost: Mapped[Optional[float]] = mapped_column(Double)
  walk_time: Mapped[Optional[str]] = mapped_column(String(100))
  near_buildings: Mapped[Optional[str]] = mapped_column(Text)
  address: Mapped[Optional[str]] = mapped_column(String(255))
  latitude: Mapped[Optional[float]] = mapped_column(Double)
  longitude: Mapped[Optional[float]] = mapped_column(Double)
  is_verified: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
  submitted_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.user_id"), nullable=True)

  def to_dict(self) -> dict:
    return {
      "spot_id": self.spot_id,
      "spot_name": self.spot_name,
      "campus_location": self.campus_location,
      "parking_type": self.parking_type,
      "cost": self.cost,
      "walk_time": self.walk_time,
      "near_buildings": self.near_buildings,
      "address": self.address,
      "latitude": self.latitude,
      "longitude": self.longitude,
      "is_verified": self.is_verified,
      "submitted_by": self.submitted_by,
      "created_at": self.created_at.isoformat() if self.created_at else None,
    }