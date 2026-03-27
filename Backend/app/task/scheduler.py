from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.core.database import AsyncSessionLocal
from app.repositories.app_config_repository import AppConfigRepository
from app.services.event_sync_service import EventSyncService

scheduler = AsyncIOScheduler()

async def run_event_sync():
    async with AsyncSessionLocal() as session:
        config_repo = AppConfigRepository(session)

        # Initialize missing config on first run so fresh databases ingest events.
        enabled = await config_repo.get_value("event_sync_enabled")
        if enabled is None:
            await config_repo.set_value("event_sync_enabled", "true")
            enabled = "true"

        # check the pause switch before doing anything
        if enabled != "true":
            print("Event sync is paused — skipping")
            return

        # update last run timestamp immediately so admin can see it ran
        await config_repo.set_value(
            "event_sync_last_run",
            datetime.now(timezone.utc).isoformat()
        )

        sync_service = EventSyncService(session)
        count = await sync_service.sync_events()
        print(f"Event sync complete — {count} events inserted")

async def run_event_cleanup():
    async with AsyncSessionLocal() as session:
        sync_service = EventSyncService(session)
        deleted = await sync_service.cleanup_old_events()
        print(f"Event cleanup complete: {deleted} events deleted.")

def start_scheduler():
    scheduler.add_job(
        run_event_sync,
        trigger=CronTrigger(day_of_week="mon", hour=3, minute=0),
        id="event_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        run_event_cleanup,
        trigger=CronTrigger(hour=2, minute=0),  # runs every day at 2am UTC
        id="event_cleanup",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown()
