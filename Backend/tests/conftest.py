"""
Shared test fixtures for the Park & Go backend test suite.

Uses an in-memory SQLite database so tests are fast and isolated.
Mocks Redis with the existing _NullRedis stub so no Redis server is needed.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.core.caching import _NullRedis, get_redis

# ── Set test admin email so admin fixtures pass the env var check ──
settings.admin_emails = "admin@umn.edu"
from app.models.user import User
from app.models.parking_spot import ParkingSpot
from app.models.saved_spot import SavedSpot
from app.models.campus_event import CampusEvent
from app.models.app_config import AppConfig
from app.main import app

# ── In-memory SQLite engine (async via aiosqlite) ──
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


# ── Override get_db to use the test database ──
async def override_get_db():
    async with TestSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Override get_redis to return a no-op stub ──
async def override_get_redis():
    return _NullRedis()


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_redis] = override_get_redis


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test, drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Provide a raw async DB session for direct data insertion in tests."""
    async with TestSession() as session:
        yield session
        await session.commit()


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """HTTPX async test client bound to the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Factory fixtures ──

@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Insert a standard test user and return the ORM instance."""
    user = User(
        google_id="google_test_123",
        email="test@umn.edu",
        first_name="Alex",
        last_name="Johnson",
        prefered_name="Alex",
        preferred_parking_types="Parking Garage,Surface Lot",
        major="Computer Science",
        major_category="STEM",
        grade_level="Senior",
        graduation_year=2026,
        housing_type="Off Campus",
        is_admin=False,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Insert an admin user and return the ORM instance."""
    user = User(
        google_id="google_admin_456",
        email="admin@umn.edu",
        first_name="Admin",
        last_name="User",
        prefered_name="Admin",
        is_admin=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def test_spot(db_session: AsyncSession) -> ParkingSpot:
    """Insert a verified parking spot on East Bank."""
    spot = ParkingSpot(
        spot_name="Oak Street Ramp",
        campus_location="East Bank",
        parking_type="Parking Garage",
        cost=1.50,
        walk_time="5 min walk",
        near_buildings="Keller Hall, Walter Library",
        address="500 Oak St SE, Minneapolis",
        latitude=44.9740,
        longitude=-93.2277,
        is_verified=True,
    )
    db_session.add(spot)
    await db_session.flush()
    return spot


@pytest_asyncio.fixture
async def unverified_spot(db_session: AsyncSession, test_user: User) -> ParkingSpot:
    """Insert an unverified user-submitted spot."""
    spot = ParkingSpot(
        spot_name="My Secret Lot",
        campus_location="West Bank",
        parking_type="Surface Lot",
        cost=0.0,
        address="100 West Bank Ave",
        latitude=44.9710,
        longitude=-93.2450,
        is_verified=False,
        submitted_by=test_user.user_id,
    )
    db_session.add(spot)
    await db_session.flush()
    return spot


@pytest_asyncio.fixture
async def multiple_spots(db_session: AsyncSession) -> list[ParkingSpot]:
    """Insert several spots with varying cost/campus for recommendation testing."""
    spots_data = [
        {"spot_name": "Free Lot", "campus_location": "East Bank", "parking_type": "Surface Lot",
         "cost": 0.0, "latitude": 44.974, "longitude": -93.228, "is_verified": True, "address": "100 Free St"},
        {"spot_name": "Mid Ramp", "campus_location": "East Bank", "parking_type": "Parking Garage",
         "cost": 2.50, "latitude": 44.975, "longitude": -93.229, "is_verified": True, "address": "200 Mid St"},
        {"spot_name": "Expensive Garage", "campus_location": "West Bank", "parking_type": "Parking Garage",
         "cost": 5.00, "latitude": 44.971, "longitude": -93.245, "is_verified": False, "address": "300 Exp St"},
        {"spot_name": "Street Meter", "campus_location": "East Bank", "parking_type": "Street Parking",
         "cost": 1.00, "latitude": 44.973, "longitude": -93.227, "is_verified": True, "address": "400 Street Ave"},
    ]
    spots = []
    for data in spots_data:
        spot = ParkingSpot(**data)
        db_session.add(spot)
        spots.append(spot)
    await db_session.flush()
    return spots


def auth_header(user: User) -> dict[str, str]:
    """Generate an Authorization header with a valid JWT for the given user."""
    token = create_access_token(user.user_id)
    return {"Authorization": f"Bearer {token}"}
