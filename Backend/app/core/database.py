from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

"""
Base class for all SQLAlchemy models.
All models inherit from this to be registered with SQLAlchemy.
"""
class Base(DeclarativeBase):
    pass


def _normalize_asyncpg_url(raw_url: str) -> str:
    """Make Neon/libpq-style URL params compatible with asyncpg runtime."""
    if not raw_url.startswith("postgresql+asyncpg://"):
        return raw_url

    split = urlsplit(raw_url)
    params = dict(parse_qsl(split.query, keep_blank_values=True))

    # asyncpg expects `ssl`, not `sslmode`.
    if "sslmode" in params and "ssl" not in params:
        sslmode = params.pop("sslmode")
        if sslmode in {"require", "prefer", "allow", "verify-ca", "verify-full"}:
            params["ssl"] = "require"
        elif sslmode in {"disable", "false", "0"}:
            params["ssl"] = "disable"

    # libpq-only option; asyncpg does not accept this keyword.
    params.pop("channel_binding", None)

    normalized_query = urlencode(params)
    return urlunsplit((split.scheme, split.netloc, split.path, normalized_query, split.fragment))


engine = create_async_engine(_normalize_asyncpg_url(settings.database_url), echo=settings.debug)

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