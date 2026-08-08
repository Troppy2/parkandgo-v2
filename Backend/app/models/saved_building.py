from sqlalchemy import Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin

"""
A user's bookmarked campus buildings.

Deliberately a separate table from `saved_spots` rather than a shared one:
`saved_spots.spot_id` carries a foreign key to `parking_spots`, so buildings
cannot reuse it without either dropping that constraint or introducing a
polymorphic column. Both would weaken referential integrity on the parking
side, which is the older and more heavily used feature.
"""


class SavedBuilding(Base, TimestampMixin):
    __tablename__ = "saved_buildings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    building_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("campus_buildings.building_id", ondelete="CASCADE"), nullable=False
    )

    building = relationship("CampusBuilding")

    __table_args__ = (
        UniqueConstraint("user_id", "building_id", name="uq_user_building"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "building_id": self.building_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
