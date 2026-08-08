from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.user_preferences import UserPreferences

"""
Single server side source of truth for "may we collect analytics data".

Every collection path must call `has_consent`. Nothing here reads a request
body, a query parameter, or the X-Data-Consent header: a client cannot grant
itself consent. Callers that pass a user of None are treated as no consent,
which covers guests and unauthenticated requests.
"""


async def has_consent(db: AsyncSession, user: User | None) -> bool:
    if user is None:
        # Guests have no account, so there is nowhere to record a consent
        # decision. Fail closed.
        return False

    result = await db.execute(
        select(UserPreferences.data_consent).where(
            UserPreferences.user_id == user.user_id
        )
    )
    consent = result.scalar_one_or_none()

    # No preferences row yet means the user has never granted consent.
    return bool(consent)
