from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin

"""
Append only audit trail of data consent transitions.

Rows are never updated or deleted. `UserPreferences.data_consent` holds the
current value for fast reads, this table answers "was consent granted at the
time that row was collected", which is the question that actually matters for
a privacy control.
"""


class ConsentEvent(Base, TimestampMixin):
    __tablename__ = "consent_events"

    event_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )

    # True on grant, False on revoke.
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # Where the change came from, for example "user_toggle" or "account_created".
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="user_toggle")

    # Coarse request context. Useful for disputes, deliberately not a full UA string.
    client_platform: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    __table_args__ = (
        Index("ix_consent_events_user_id_created_at", "user_id", "created_at"),
    )

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "user_id": self.user_id,
            "granted": self.granted,
            "source": self.source,
            "client_platform": self.client_platform,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
