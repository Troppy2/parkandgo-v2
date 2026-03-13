from typing import Optional
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampMixin
from app.core.database import Base


class AppConfig(Base, TimestampMixin):
    """Key-value settings table for app configuration.
    Stores event_sync_enabled, event_sync_last_run, event_sync_interval_days.
    """
    __tablename__ = "app_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "value": self.value,
            "description": self.description
        }