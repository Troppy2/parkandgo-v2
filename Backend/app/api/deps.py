from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.core.security import decode_access_token
from sqlalchemy import select


# Reusable dependency for getting current user
async def get_current_user(
    authorization: str = Header(default=None),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    token = authorization.replace("Bearer ", "")
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return user


async def get_optional_user(
    authorization: str = Header(default=None),
    db: AsyncSession = Depends(get_db)
) -> User | None:
    if not authorization:
        return None
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        result = await db.execute(select(User).where(User.user_id == user_id))
        return result.scalar_one_or_none()
    except Exception:
        return None


async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Authorize admin access by checking the user's email against the
    ADMIN_EMAILS env var. The DB is_admin column alone is NOT sufficient —
    the env var is the single source of truth."""
    email = (current_user.email or "").lower()
    if email not in settings.admin_email_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative privileges."
        )
    return current_user