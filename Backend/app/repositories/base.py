from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, inspect

"""
BaseRepository provides reusable CRUD operations for all models.
Other repositories (UserRepository, ParkingSpotRepository) inherit from this
so they don't have to rewrite the same database logic.
"""
class BaseRepository:
    def __init__(self, session: AsyncSession, model):
        # session = the active database connection
        # model = the SQLAlchemy model class (e.g. User, ParkingSpot)
        self.session = session
        self.model = model

    async def get_by_id(self, id: int):
        # Builds a SELECT query filtered by primary key
        # Returns the model instance or None if not found
        pk_col = inspect(self.model).mapper.primary_key[0]
        result = await self.session.execute(
            select(self.model).where(pk_col == id)
        )
        return result.scalar_one_or_none()

    async def get_all(self):
        # Fetches every row from the model's table
        # .scalars().all() converts raw DB rows into model instances
        result = await self.session.execute(select(self.model))
        return result.scalars().all()

    async def create(self, data: dict):
        # Creates a new model instance from a dictionary of values
        # e.g. {"spot_name": "Oak St Ramp", "cost": 2.50}
        instance = self.model(**data)
        # Adds the instance to the session (stages it for insert)
        self.session.add(instance)
        # flush() sends the INSERT to the DB so we get back the generated ID,
        # but doesn't commit yet — commit happens in get_db()
        await self.session.flush()
        return instance
