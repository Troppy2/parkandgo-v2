import httpx
import zoneinfo
from icalendar import Calendar
from datetime import date, datetime, timezone


CATEGORY_FEEDS: dict[str, list[str]] = {
    "Sports": [
        "https://events.tc.umn.edu/live/ical/events/category/Athletics%2C%20Sports%2C%20and%20Recreation/header/Athletics%2C%20Sports%2C%20and%20Recreation%20Events",
    ],
    "Student Life": [
        "https://events.tc.umn.edu/live/ical/events/category/Student%20Life/header/Student%20Life%20Events",
        "https://events.tc.umn.edu/live/ical/events/category/Campus%20Affairs/header/Campus%20Affairs%20Events",
    ],
    "Academics": [
        "https://events.tc.umn.edu/live/ical/events/category/Academics%2C%20Research%2C%20and%20Education/header/Academics%2C%20Research%2C%20and%20Education%20Events",
        "https://events.tc.umn.edu/live/ical/events/category/Professional%20Development/header/Professional%20Development%20Events",
    ],
    "STEM": [
        "https://events.tc.umn.edu/live/ical/events/category/Science%2C%20Engineering%2C%20and%20Technology/header/Science%2C%20Engineering%2C%20and%20Technology%20Events",
        "https://events.tc.umn.edu/live/ical/events/category/Artificial%20Intelligence%20(AI)/header/Artificial%20Intelligence%20(AI)%20Events",
    ],
    "Arts": [
        "https://events.tc.umn.edu/live/ical/events/category/Arts%2C%20Culture%2C%20Architecture%2C%20and%20Design/header/Arts%2C%20Culture%2C%20Architecture%2C%20and%20Design%20Events",
        "https://events.tc.umn.edu/live/ical/events/category/Exhibition/header/Exhibition%20Events",
    ],
}

async def fetch_feed(url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=10)
        response.raise_for_status()
        return response.content

def parse_feed(raw_bytes: bytes, category: str) -> list[dict]:
    cal = Calendar.from_ical(raw_bytes)
    events = []

    for component in cal.walk():
        if component.name != "VEVENT":
            continue  # skip non-event components like VCALENDAR header

        # extract fields — icalendar returns special objects so you need str() or .dt
        title = str(component.get("SUMMARY", "Untitled"))
        location = str(component.get("LOCATION", ""))
        external_id = str(component.get("UID", ""))
        source_url = str(component.get("URL", "")) or None

        dtstart = component.get("DTSTART")
        dtend = component.get("DTEND")
        starts_at = normalize_to_utc(dtstart.dt if dtstart else None)
        ends_at = normalize_to_utc(dtend.dt if dtend else None)

        events.append({
            "title": title,
            "location_name": location or "TBD",
            "external_id": external_id,
            "category": category,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "source_url": source_url,
            "latitude": None,
            "longitude": None,
        })

    return events


def normalize_to_utc(dt) -> datetime | None:
    if dt is None:
        return None
    # campus_events stores TIMESTAMP WITHOUT TIME ZONE, so return naive UTC.
    # icalendar returns date for all-day events — normalize to midnight UTC.
    if isinstance(dt, date) and not isinstance(dt, datetime):
        dt = datetime.combine(dt, datetime.min.time(), tzinfo=timezone.utc)
        return dt.replace(tzinfo=None)
    # naive datetime — assume America/Chicago (UMN local time)
    if dt.tzinfo is None:
        local_tz = zoneinfo.ZoneInfo("America/Chicago")
        dt = dt.replace(tzinfo=local_tz)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)
