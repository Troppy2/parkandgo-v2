import logging
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import AsyncSessionLocal

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


async def run_startup_health_checks() -> None:
    """Validate critical schema/config assumptions and log actionable warnings."""
    async with AsyncSessionLocal() as session:
        await _check_required_columns(session)
        await _check_required_config_keys(session)


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
