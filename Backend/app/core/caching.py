import redis.asyncio as redis
from app.core.config import settings


class _NullRedis:
    """No-op Redis stub used when Redis is unavailable (e.g. local dev without Redis)."""
    async def get(self, key: str): return None
    async def setex(self, key: str, time: int, value: str): pass
    async def delete(self, *keys: str): pass
    async def keys(self, pattern: str): return []
    async def ping(self): return True


_redis_client: redis.Redis | None = None
_redis_available: bool = True


async def get_redis() -> redis.Redis | _NullRedis:
    global _redis_client, _redis_available
    if not _redis_available:
        return _NullRedis()
    if _redis_client is None:
        try:
            client = redis.from_url(settings.redis_url, decode_responses=True)
            await client.ping()
            _redis_client = client
        except Exception:
            _redis_available = False
            print("WARNING: Redis unavailable — caching disabled, running without cache.")
            return _NullRedis()
    return _redis_client


async def close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None
