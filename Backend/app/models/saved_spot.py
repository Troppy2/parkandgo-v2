from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampMixin
from app.core.database import Base


class SavedSpot(Base, TimestampMixin):
    __tablename__ = "saved_spots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.user_id"), nullable=False)
    spot_id: Mapped[int] = mapped_column(Integer, ForeignKey("parking_spots.spot_id"), nullable=False)
    custom_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    spot = relationship("ParkingSpot", lazy="joined")

    __table_args__ = (
        UniqueConstraint("user_id", "spot_id", name="uq_user_spot"),
    )