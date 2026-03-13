from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.core.config import settings

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"user_id": user_id, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])

def create_refresh_token(user_id: int) -> str:
    # use the value from settings so we can control it via .env
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "user_id": user_id,
        "exp": expire,
        "type": "refresh"   # marks this as a refresh token
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")

def decode_refresh_token(token: str) -> dict:
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    
    # check that payload.get("type") == "refresh"
    # if it doesn't match raise a ValueError with a clear message
    # this prevents someone from passing an access token to the refresh endpoint

    if payload.get("type") != "refresh":
        raise ValueError("Invalid token type: expected a refresh token")
    
    return payload