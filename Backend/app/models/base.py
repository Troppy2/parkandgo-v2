from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

"""
This class is used to create a timestamp mixin for the models
"""
class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    