from typing import Optional
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampMixin
from app.core.database import Base

"""
This file does 3 things,
1. `User`: holds the model for user in the postgres table,
2. `TimestampMixin`: adds a timestamp for when a new user was made
3. `Base`: This registers the user class as a SQLAlchmy model 
"""
class User(Base, TimestampMixin):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    profile_pic: Mapped[Optional[str]] = mapped_column(String(500))
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prefered_name: Mapped[str] = mapped_column(String(100), nullable=False)
    preferred_parking_types: Mapped[Optional[str]] = mapped_column(String(250))
    major: Mapped[Optional[str]] = mapped_column(String(100))
    major_category: Mapped[Optional[str]] = mapped_column(String(100))
    grade_level: Mapped[Optional[str]] = mapped_column(String(100))
    graduation_year: Mapped[Optional[int]] = mapped_column(Integer)
    housing_type: Mapped[Optional[str]] = mapped_column(String(50))
    is_admin: Mapped[bool] = mapped_column(default=False, nullable=False)
    
    @property
    def is_profile_complete(self) -> bool:
        return all([self.first_name, self.last_name])

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "google_id": self.google_id,
            "email": self.email,
            "profile_pic": self.profile_pic,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "prefered_name": self.prefered_name,
            "preferred_parking_types": self.preferred_parking_types,
            "major": self.major,
            "major_category": self.major_category,
            "grade_level": self.grade_level,
            "graduation_year": self.graduation_year,
            "housing_type": self.housing_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_admin": self.is_admin,
        }
