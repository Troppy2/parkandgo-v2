from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from jose import JWTError
from app.core.security import create_access_token, decode_refresh_token
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import RefreshTokenRequest, TokenResponse, UserResponse
from app.services.auth_service import google_login
from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    access_token: str


@router.post("/google", response_model=TokenResponse, status_code=201)
@limiter.limit("30/minute")
async def login_with_google(
    request: Request,
    body: GoogleLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a Google OAuth access token for a Park&Go JWT.
    Creates the user record on first login."""
    try:
        result = await google_login(db, body.access_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )
    return result


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return user


@router.post("/refresh", response_model=dict, status_code=201)
@limiter.limit("10/minute")
async def refresh_access_token(
    request: Request,
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Issue a new access token using a valid refresh token.
    Does NOT require an Authorization header — the whole point is that
    the access token may already be expired when this is called."""
    try:
        payload = decode_refresh_token(body.refresh_token)
        user_id = payload.get("user_id")
    except (ValueError, JWTError) as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return {"access_token": create_access_token(user.user_id), "token_type": "bearer"}
