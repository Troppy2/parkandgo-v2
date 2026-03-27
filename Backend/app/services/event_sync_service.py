import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campus_event import CampusEvent
from app.repositories.event_repository import EventRepository
# Reuse the canonical feed definitions and parsers from utils/ical_feeds.py.
# ical_feeds.py is the single source of truth for feed URLs and iCal parsing
# (it also handles timezone normalization that the old version of this file did not).
from app.utils.ical_feeds import CATEGORY_FEEDS, fetch_feed, parse_feed


class EventSyncService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def sync_events(self) -> int:
        """Fetch all iCal feeds in parallel, deduplicate, and insert events not already in the DB.
        Returns the number of newly inserted events."""
        event_repo = EventRepository(self.session)

        # Build a flat list of (category, url) pairs so we can fan-out all fetches at once.
        # Sequential fetching (old approach) summed every feed's latency; parallel reduces it
        # to the slowest single feed, keeping the total well under the client's 30s timeout.
        feed_tasks = [
            (category, url)
            for category, urls in CATEGORY_FEEDS.items()
            for url in urls
        ]

        raw_results = await asyncio.gather(
            *[fetch_feed(url) for _, url in feed_tasks],
            return_exceptions=True,
        )

        all_events: list[dict] = []
        for (category, url), result in zip(feed_tasks, raw_results):
            if isinstance(result, Exception):
                # Log but don't crash — one bad feed shouldn't stop the rest
                print(f"Failed to fetch {url}: {result}")
                continue
            try:
                parsed = parse_feed(result, category)
                all_events.extend(parsed)
            except Exception as e:
                print(f"Failed to parse {url}: {e}")

        # Deduplicate in-memory first (two feeds can share the same event UID)
        seen: set[str] = set()
        unique_events = []
        for event in all_events:
            if event["external_id"] not in seen:
                seen.add(event["external_id"])
                unique_events.append(event)

        # Fetch all existing external_ids in one query to avoid N SELECT round trips
        existing_result = await self.session.execute(select(CampusEvent.external_id))
        existing_ids: set[str] = {row[0] for row in existing_result.all()}

        inserted = 0
        for event_data in unique_events:
            if event_data["external_id"] not in existing_ids:
                await event_repo.create(event_data)
                inserted += 1

        return inserted

    async def cleanup_old_events(self) -> int:
        """Delete all events whose starts_at is more than 24 hours in the past."""
        event_repo = EventRepository(self.session)
        cutoff = datetime.utcnow() - timedelta(hours=24)
        return await event_repo.delete_older_than(cutoff)
