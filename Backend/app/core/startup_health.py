import logging
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import AsyncSessionLocal
from app.models.parking_spot import ParkingSpot
from app.repositories.app_config_repository import AppConfigRepository
from app.services.event_sync_service import EventSyncService

logger = logging.getLogger("app.startup.health")

REQUIRED_TABLE_COLUMNS: dict[str, set[str]] = {
    "campus_events": {
        "event_id",
        "title",
        "location_name",
        "starts_at",
        "ends_at",
        "category",
        "external_id",
        "price",
    },
    "app_config": {"key", "value"},
}

REQUIRED_CONFIG_KEYS: set[str] = {
    "event_sync_enabled",
    "event_sync_last_run",
    "event_sync_interval_days",
}

BASELINE_PARKING_SPOTS: tuple[dict[str, object], ...] = (
    {
        "spot_name": "Oak Street Ramp",
        "campus_location": "East Bank",
        "parking_type": "Parking Garage",
        "cost": 2.50,
        "walk_time": "5 min to Coffman",
        "near_buildings": "Coffman Union, Walter Library, Carlson School, Northrop Auditorium",
        "address": "401 SE Oak St, Minneapolis, MN 55455",
        "latitude": 44.9739,
        "longitude": -93.2312,
        "is_verified": True,
    },
    {
        "spot_name": "19th Ave Meters",
        "campus_location": "East Bank",
        "parking_type": "Street Parking",
        "cost": 1.50,
        "walk_time": "8 min to Keller",
        "near_buildings": "Keller Hall, Tate Lab, Recreation Center",
        "address": "19th Ave SE & University Ave SE, Minneapolis, MN 55455",
        "latitude": 44.9785,
        "longitude": -93.2345,
        "is_verified": True,
    },
    {
        "spot_name": "Church Street Garage",
        "campus_location": "East Bank",
        "parking_type": "Parking Garage",
        "cost": 2.00,
        "walk_time": "3 min to Anderson",
        "near_buildings": "Anderson Hall, Bruininks Hall, Nicholson Hall",
        "address": "80 Church St SE, Minneapolis, MN 55455",
        "latitude": 44.9763,
        "longitude": -93.2343,
        "is_verified": True,
    },
    {
        "spot_name": "4th St Ramp",
        "campus_location": "East Bank",
        "parking_type": "Parking Garage",
        "cost": 2.50,
        "walk_time": "7 min to Walter Library",
        "near_buildings": "Walter Library, Coffman Union",
        "address": "1625 4th St SE, Minneapolis, MN 55455",
        "latitude": 44.9806,
        "longitude": -93.2355,
        "is_verified": True,
    },
    {
        "spot_name": "East River Road Garage",
        "campus_location": "East Bank",
        "parking_type": "Parking Garage",
        "cost": 1.00,
        "walk_time": "10 min to Northrop",
        "near_buildings": "Northrop Auditorium, Kolthoff Hall",
        "address": "385 East River Pkwy, Minneapolis, MN 55455",
        "latitude": 44.9732,
        "longitude": -93.2392,
        "is_verified": True,
    },
    {
        "spot_name": "Washington Ave Bridge Lot",
        "campus_location": "West Bank",
        "parking_type": "Surface Lot",
        "cost": 1.00,
        "walk_time": "2 min to Wilson Library",
        "near_buildings": "Wilson Library, West Bank Buildings",
        "address": "224 19th Ave S, Minneapolis, MN 55455",
        "latitude": 44.9729,
        "longitude": -93.2435,
        "is_verified": True,
    },
    {
        "spot_name": "21st Ave Ramp",
        "campus_location": "West Bank",
        "parking_type": "Parking Garage",
        "cost": 2.50,
        "walk_time": "4 min to Blegen",
        "near_buildings": "Blegen Hall, Ferguson Hall",
        "address": "400 21st Ave S, Minneapolis, MN 55455",
        "latitude": 44.9708,
        "longitude": -93.2421,
        "is_verified": True,
    },
    {
        "spot_name": "19th Ave Ramp (West Bank)",
        "campus_location": "West Bank",
        "parking_type": "Parking Garage",
        "cost": 1.50,
        "walk_time": "5 min to Rarig",
        "near_buildings": "Rarig Center, West Bank Arts Buildings",
        "address": "300 19th Ave S, Minneapolis, MN 55455",
        "latitude": 44.9719,
        "longitude": -93.2443,
        "is_verified": True,
    },
)


async def run_startup_health_checks() -> None:
    """Validate critical schema/config assumptions and bootstrap critical baseline data."""
    async with AsyncSessionLocal() as session:
        await _check_required_columns(session)
        await _ensure_event_sync_config(session)
        await _check_required_config_keys(session)
        await _seed_baseline_parking_spots(session)
        await _bootstrap_events_if_empty(session)
        await session.commit()


async def _check_required_columns(session) -> None:
    for table_name, required_columns in REQUIRED_TABLE_COLUMNS.items():
        try:
            present_columns = await _get_table_columns(session, table_name)
        except SQLAlchemyError as exc:
            logger.warning(
                "Startup health check: unable to inspect table '%s': %s",
                table_name,
                exc,
            )
            continue

        if not present_columns:
            logger.warning(
                "Startup health check: table '%s' is missing or inaccessible. "
                "Run database migrations (alembic upgrade head).",
                table_name,
            )
            continue

        missing_columns = sorted(required_columns - present_columns)
        if missing_columns:
            logger.warning(
                "Startup health check: table '%s' is missing required columns: %s. "
                "Run database migrations (alembic upgrade head).",
                table_name,
                ", ".join(missing_columns),
            )


async def _check_required_config_keys(session) -> None:
    try:
        result = await session.execute(text("SELECT key FROM app_config"))
        existing_keys = {row[0] for row in result.all()}
    except SQLAlchemyError as exc:
        logger.warning(
            "Startup health check: unable to read app_config keys: %s",
            exc,
        )
        return

    missing_keys = sorted(REQUIRED_CONFIG_KEYS - existing_keys)
    if missing_keys:
        logger.warning(
            "Startup health check: app_config is missing keys: %s. "
            "Event sync may be paused or partially configured until keys are set.",
            ", ".join(missing_keys),
        )


async def _seed_baseline_parking_spots(session) -> None:
    try:
        result = await session.execute(text("SELECT COUNT(*) FROM parking_spots"))
    except SQLAlchemyError as exc:
        logger.warning("Startup bootstrap: unable to count parking spots: %s", exc)
        return

    count = result.scalar() or 0
    if count > 0:
        return

    session.add_all(ParkingSpot(**spot) for spot in BASELINE_PARKING_SPOTS)
    await session.flush()
    logger.info(
        "Startup bootstrap: inserted %s baseline parking spots into an empty database.",
        len(BASELINE_PARKING_SPOTS),
    )


async def _ensure_event_sync_config(session) -> None:
    config_repo = AppConfigRepository(session)

    default_config = {
        "event_sync_enabled": "true",
        "event_sync_last_run": "",
        "event_sync_interval_days": "7",
    }

    for key, value in default_config.items():
        existing = await config_repo.get_value(key)
        if existing is None:
            await config_repo.set_value(key, value)


async def _bootstrap_events_if_empty(session) -> None:
    try:
        result = await session.execute(text("SELECT COUNT(*) FROM campus_events"))
    except SQLAlchemyError as exc:
        logger.warning("Startup bootstrap: unable to count campus events: %s", exc)
        return

    event_count = result.scalar() or 0
    if event_count > 0:
        return

    config_repo = AppConfigRepository(session)
    enabled = await config_repo.get_value("event_sync_enabled")
    if enabled == "false":
        logger.info("Startup bootstrap: event sync is disabled, skipping initial event import.")
        return

    sync_service = EventSyncService(session)
    try:
        inserted = await sync_service.sync_events()
    except Exception as exc:  # pragma: no cover - network failures are logged and tolerated
        logger.warning("Startup bootstrap: initial event sync failed: %s", exc)
        return

    await config_repo.set_value("event_sync_last_run", datetime.now(timezone.utc).isoformat())

    logger.info(
        "Startup bootstrap: initial event sync completed with %s imported events.",
        inserted,
    )


async def _get_table_columns(session, table_name: str) -> set[str]:
    query = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = :table_name
        """
    )
    result = await session.execute(query, {"table_name": table_name})
    return _rows_to_set(result.all())


def _rows_to_set(rows: Iterable[tuple[str]]) -> set[str]:
    return {row[0] for row in rows}
