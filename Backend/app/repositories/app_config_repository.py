from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.app_config import AppConfig
from app.repositories.base import BaseRepository


class AppConfigRepository(BaseRepository):
    def __init__(self, session: AsyncSession):
        super().__init__(session, AppConfig)

    async def get_value(self, key: str) -> str | None:
        result = await self.session.execute(
            select(AppConfig).where(AppConfig.key == key)
        )
        row = result.scalar_one_or_none()
        return row.value if row else None

    async def set_value(self, key: str, value: str) -> AppConfig:
        """Upsert: update the row if the key exists, create it if it doesn't."""
        result = await self.session.execute(
            select(AppConfig).where(AppConfig.key == key)
        )
        config = result.scalar_one_or_none()

        if config:
            config.value = value
        else:
            config = AppConfig(key=key, value=value)
            self.session.add(config)  # only new instances need to be added to the session

        await self.session.flush()
        return config

    async def get_all(self) -> list[AppConfig]:
        """Return every config row. Used by the admin dashboard."""
        result = await self.session.execute(select(AppConfig))
        return result.scalars().all()
