from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

"""
Base class for all SQLAlchemy models.
All models inherit from this to be registered with SQLAlchemy.
"""
class Base(DeclarativeBase):
    pass

engine = create_async_engine(settings.database_url, echo=settings.debug)

"""
Session factory for creating async database sessions.
"""
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise