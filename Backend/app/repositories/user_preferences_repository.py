from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent_event import ConsentEvent
from app.models.user_preferences import UserPreferences
from app.schemas.user_preferences import UserPreferencesUpdate


class UserPreferencesRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: int) -> UserPreferences | None:
        result = await self.session.execute(
            select(UserPreferences).where(UserPreferences.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, user_id: int) -> UserPreferences:
        """
        Rows are created lazily, so existing users who predate this table get
        defaults on first read. Defaults are consent off, which is the correct
        fail closed behavior for a privacy control.
        """
        prefs = await self.get(user_id)
        if prefs is not None:
            return prefs
        prefs = UserPreferences(user_id=user_id)
        self.session.add(prefs)
        await self.session.flush()
        await self.session.refresh(prefs)
        return prefs

    async def update(self, user_id: int, updates: UserPreferencesUpdate) -> UserPreferences:
        prefs = await self.get_or_create(user_id)
        # exclude_unset so an omitted field is left alone rather than nulled.
        for key, value in updates.model_dump(exclude_unset=True).items():
            setattr(prefs, key, value)
        await self.session.flush()
        await self.session.refresh(prefs)
        return prefs

    async def set_consent(
        self,
        user_id: int,
        granted: bool,
        source: str = "user_toggle",
        client_platform: str | None = None,
    ) -> tuple[UserPreferences, bool]:
        """
        Set the current consent flag and append an audit event.

        Returns (preferences, changed). A no-op toggle does not append an event,
        so the trail records real transitions rather than repeated clicks.
        """
        prefs = await self.get_or_create(user_id)
        changed = prefs.data_consent != granted
        if changed:
            prefs.data_consent = granted
            self.session.add(
                ConsentEvent(
                    user_id=user_id,
                    granted=granted,
                    source=source,
                    client_platform=client_platform,
                )
            )
            await self.session.flush()
            await self.session.refresh(prefs)
        return prefs, changed

    async def get_consent_events(self, user_id: int) -> list[ConsentEvent]:
        result = await self.session.execute(
            select(ConsentEvent)
            .where(ConsentEvent.user_id == user_id)
            .order_by(ConsentEvent.created_at.desc())
        )
        return list(result.scalars().all())
