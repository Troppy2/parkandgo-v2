import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


async def verify_google_token(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code != 200:
        raise ValueError("Invalid Google token")
    return response.json()


async def google_login(db: AsyncSession, google_access_token: str) -> dict:
    google_user = await verify_google_token(google_access_token)

    google_id = google_user["sub"]
    email = google_user.get("email")
    first_name = google_user.get("given_name", "")
    last_name = google_user.get("family_name", "")
    profile_pic = google_user.get("picture")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            google_id=google_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            prefered_name=first_name,
            profile_pic=profile_pic,
        )
        db.add(user)
        await db.flush()

    # Sync is_admin from env var on every login — env is the source of truth
    user.is_admin = (email or "").lower() in settings.admin_email_set
    await db.flush()

    token = create_access_token(user.user_id)

    return {
    "access_token": token,
    "refresh_token": create_refresh_token(user.user_id),
    "token_type": "bearer",
    "user": user,
}
