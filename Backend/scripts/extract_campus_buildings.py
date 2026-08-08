#!/usr/bin/env python3
"""
UMN campus building extraction for Park & Go V2

Pulls named buildings from OpenStreetMap via the Overpass API for each of the
three UMN campus bounding boxes, and writes them to a JSON file that the
alembic migration seeds into the campus_buildings table.

The output file is committed to the repository on purpose. Seeding a database
must not depend on Overpass being reachable, and pinning the data means a
deploy cannot silently pick up a different set of buildings than the one that
was reviewed.

Overpass is keyless, which keeps this consistent with the rest of the stack:
routing is OSRM, geocoding is Nominatim, and tiles are OpenFreeMap, all
OpenStreetMap based and all without an API key.

Usage:
    python scripts/extract_campus_buildings.py            # dry run, prints a summary
    python scripts/extract_campus_buildings.py --write    # write the JSON file
    python scripts/extract_campus_buildings.py --write --include-minor
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

try:
    import httpx
except ImportError:
    print("Please install required packages: pip install httpx")
    sys.exit(1)

# Add Backend app to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.utils.geo import CAMPUS_BOUNDS, campus_for_coordinates, haversine_miles  # noqa: E402


OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "ParkAndGo-UMN-App/1.0"}


def print_table(headers: list[str], rows: list[list[str]]) -> None:
    """
    Minimal column-aligned table.

    Deliberately hand rolled rather than pulling in tabulate: it is not in any
    requirements file, so depending on it would make this script fail on a
    clean checkout the way scripts/geocode_spots.py currently does.
    """
    widths = [len(h) for h in headers]
    for row in rows:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], len(str(cell)))

    print("  ".join(h.ljust(widths[i]) for i, h in enumerate(headers)))
    print("  ".join("-" * w for w in widths))
    for row in rows:
        print("  ".join(str(cell).ljust(widths[i]) for i, cell in enumerate(row)))

# Overpass is a shared free service that rate limits by slot availability, not
# by a fixed quota, so a 429 means "wait", not "you are blocked". Retrying with
# backoff is the documented way to use it politely.
REQUEST_TIMEOUT_SECONDS = 180
PAUSE_BETWEEN_CAMPUSES = 8.0
MAX_RETRIES = 6
INITIAL_BACKOFF_SECONDS = 20.0

OUTPUT_PATH = Path(__file__).parent.parent / "app" / "data" / "umn_campus_buildings.json"

# OSM tags a lot of things as buildings that nobody would ever ask for walking
# directions to. Excluding these is what separates a usable destination list
# from a dump of every structure on campus.
EXCLUDED_BUILDING_VALUES = {
    "garage", "garages", "shed", "roof", "carport", "greenhouse",
    "hut", "container", "kiosk", "service", "transformer_tower",
    "water_tower", "silo", "storage_tank", "bunker", "ruins",
    "construction", "no",
}

# Names that are clearly infrastructure rather than destinations.
EXCLUDED_NAME_FRAGMENTS = (
    "parking ramp", "parking garage", "substation", "storage",
    "maintenance shed", "utility", "pump station", "loading dock",
)

# The Minnesota State Fairgrounds sits immediately east of the St. Paul campus
# and falls inside the St. Paul bounding box, so an unfiltered query returns
# roughly 60 food stands and media booths (Sweet Martha's Cookies, Pronto Pups,
# the Giant Slide) as if they were campus buildings.
#
# This box cannot simply be cut out of CAMPUS_BOUNDS for two reasons. First,
# CAMPUS_BOUNDS is shared with is_within_campus_bounds, which validates user
# submitted parking spots, and narrowing it would silently change what spots
# people can submit. Second, several genuine UMN agricultural research
# facilities (the Leatherdale Equine Center, Poultry Teaching and Research,
# Dairy Cattle Teaching and Research) sit interleaved with the fairgrounds.
#
# So the box only suppresses entries that lack UMN provenance. UMN operated
# buildings inside it are kept.
STATE_FAIRGROUNDS_BOUNDS = {
    "lat_min": 44.9775, "lat_max": 44.9885,
    "lon_min": -93.1800, "lon_max": -93.1670,
}

# Tags that mark a structure as a business or attraction rather than a place a
# student would ask for walking directions to. Only applied to entries without
# UMN provenance, so a UMN building that happens to contain a cafe is kept.
COMMERCIAL_TAGS = {
    "amenity": {
        "fast_food", "restaurant", "cafe", "bar", "pub", "nightclub",
        "ice_cream", "studio", "marketplace", "bank", "fuel", "atm",
        "toilets", "shelter", "vending_machine", "car_wash",
    },
    "tourism": {"hotel", "motel", "hostel", "attraction", "artwork"},
    "attraction": {"amusement_ride", "carousel", "water_slide", "animal"},
    "aerialway": {"station"},
}
# Any value of these keys is disqualifying on a non-UMN entry.
COMMERCIAL_KEYS = ("shop", "craft", "office")


def has_umn_provenance(tags: dict) -> bool:
    """
    True when OSM records this building as belonging to the University.

    UMN's own facilities dataset was imported into OSM, so real campus
    buildings carry operator=University of Minnesota along with
    umn:BuildingNumber, umn:CampusNumber, and the official short_name
    abbreviation. Nothing at the State Fairgrounds carries any of it, which
    makes this the single most reliable signal available.
    """
    return tags.get("operator") == "University of Minnesota" or "umn:BuildingNumber" in tags


def is_in_state_fairgrounds(latitude: float, longitude: float) -> bool:
    b = STATE_FAIRGROUNDS_BOUNDS
    return (b["lat_min"] <= latitude <= b["lat_max"]) and \
           (b["lon_min"] <= longitude <= b["lon_max"])


def is_commercial(tags: dict) -> str | None:
    """Return the disqualifying tag for a business or attraction, or None."""
    for key, bad_values in COMMERCIAL_TAGS.items():
        value = tags.get(key)
        if value in bad_values:
            return f"{key}={value}"
    for key in COMMERCIAL_KEYS:
        if key in tags:
            return f"{key}={tags[key]}"
    return None


def build_query(bounds: dict) -> str:
    """
    Overpass QL for every named building in one bounding box.

    "out center" gives ways and relations a computed centroid, so buildings
    mapped as areas (which is most of them) come back with usable coordinates
    rather than just a node list.

    The leisure=stadium clause is not redundant. Huntington Bank Stadium is
    mapped with no building tag at all, so a building-only query silently drops
    the largest venue on campus. Williams Arena and 3M Arena carry both tags
    and are deduplicated by OSM id.
    """
    bbox = f'{bounds["lat_min"]},{bounds["lon_min"]},{bounds["lat_max"]},{bounds["lon_max"]}'
    return f"""
    [out:json][timeout:120];
    (
      node["building"]["name"]({bbox});
      way["building"]["name"]({bbox});
      relation["building"]["name"]({bbox});
      way["leisure"="stadium"]["name"]({bbox});
      relation["leisure"="stadium"]["name"]({bbox});
    );
    out center tags;
    """


def fetch_campus(client: httpx.Client, campus: str, bounds: dict) -> list[dict]:
    """
    Run the Overpass query for one campus and return raw elements.

    Retries on 429 and 504 with exponential backoff. Overpass hands out
    execution slots rather than enforcing a quota, so those two statuses mean
    the server is busy and the same request will succeed shortly.
    """
    backoff = INITIAL_BACKOFF_SECONDS

    for attempt in range(1, MAX_RETRIES + 1):
        response = client.post(
            OVERPASS_URL,
            data={"data": build_query(bounds)},
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        if response.status_code in (429, 504):
            if attempt == MAX_RETRIES:
                response.raise_for_status()
            print(f"  {campus:12s} busy ({response.status_code}), "
                  f"retrying in {backoff:.0f}s [attempt {attempt}/{MAX_RETRIES}]")
            time.sleep(backoff)
            backoff *= 2
            continue

        response.raise_for_status()
        elements = response.json().get("elements", [])
        print(f"  {campus:12s} {len(elements):4d} raw elements")
        return elements

    return []


def extract_coordinates(element: dict) -> tuple[float, float] | None:
    """Nodes carry lat/lon directly, ways and relations carry a computed center."""
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center")
    if center:
        return float(center["lat"]), float(center["lon"])
    return None


def compose_address(tags: dict) -> str | None:
    """Build a street address from OSM addr:* tags, or None when absent."""
    housenumber = tags.get("addr:housenumber")
    street = tags.get("addr:street")
    if not street:
        return None
    return f"{housenumber} {street}".strip() if housenumber else street


def should_exclude(tags: dict, name: str) -> str | None:
    """Return the reason this element is not a walking destination, or None."""
    building_value = (tags.get("building") or "").lower()
    if building_value in EXCLUDED_BUILDING_VALUES:
        return f"building={building_value}"

    lowered = name.lower()
    for fragment in EXCLUDED_NAME_FRAGMENTS:
        if fragment in lowered:
            return f"name contains '{fragment}'"

    return None


def normalize(
    element: dict, include_minor: bool, umn_only: bool = False
) -> tuple[dict | None, str | None]:
    """
    Turn one Overpass element into a building row.

    Returns (row, skip_reason). Exactly one of the two is None.
    """
    tags = element.get("tags", {})
    name = (tags.get("name") or "").strip()
    if not name:
        return None, "no name"

    if not include_minor:
        reason = should_exclude(tags, name)
        if reason:
            return None, reason

    coordinates = extract_coordinates(element)
    if coordinates is None:
        return None, "no coordinates"

    latitude, longitude = coordinates

    # Assign the campus from the same bounding boxes that validate user
    # submitted spots, rather than trusting which query returned the row.
    campus = campus_for_coordinates(latitude, longitude)
    if campus is None:
        return None, "outside campus bounds"

    # UMN operated buildings are always kept. Everything else has to earn its
    # place, which is what keeps the State Fairgrounds out of the list without
    # also dropping the agricultural research facilities mixed in with it.
    umn = has_umn_provenance(tags)
    if not umn:
        if umn_only:
            return None, "not UMN operated"
        if is_in_state_fairgrounds(latitude, longitude):
            return None, "State Fairgrounds"
        commercial = is_commercial(tags)
        if commercial:
            return None, commercial

    short_name = tags.get("short_name") or tags.get("alt_name")

    return {
        "osm_id": f'{element["type"]}/{element["id"]}',
        "name": name,
        "short_name": short_name.strip() if short_name else None,
        "campus_location": campus,
        "address": compose_address(tags),
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        # Not persisted. Used only to pick a winner between duplicate mappings.
        "_umn": umn,
        "_tag_count": len(tags),
    }, None


def deduplicate(rows: list[dict]) -> tuple[list[dict], int]:
    """
    Collapse buildings that OSM maps more than once.

    A building traced as both a way and a relation, or split across two
    footprints, comes back as separate elements with the same name. Matching on
    a normalized name plus proximity avoids merging genuinely distinct places
    that share a name, which on this campus means the two Jimmy John's on
    opposite banks of the river.

    The surviving copy is the one with UMN provenance, then the one with more
    tags, since that is the richer record.
    """
    def name_key(row: dict) -> str:
        return re.sub(r"[^a-z0-9]", "", row["name"].lower().replace("&", "and"))

    def is_near(a: dict, b: dict) -> bool:
        # Roughly 200 metres. Comfortably larger than the offset between two
        # tracings of one building, far smaller than the distance between two
        # different places that happen to share a name.
        return haversine_miles(
            a["latitude"], a["longitude"], b["latitude"], b["longitude"]
        ) < 0.125

    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(name_key(row), []).append(row)

    kept: list[dict] = []
    removed = 0

    for candidates in groups.values():
        clusters: list[list[dict]] = []
        for row in candidates:
            for cluster in clusters:
                if is_near(cluster[0], row):
                    cluster.append(row)
                    break
            else:
                clusters.append([row])

        for cluster in clusters:
            cluster.sort(key=lambda r: (r["_umn"], r["_tag_count"]), reverse=True)
            kept.append(cluster[0])
            removed += len(cluster) - 1

    return kept, removed


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract UMN campus buildings from OpenStreetMap")
    parser.add_argument("--write", action="store_true",
                        help="Write the JSON file. Without this the script only prints a summary.")
    parser.add_argument("--include-minor", action="store_true",
                        help="Keep sheds, garages, greenhouses and similar structures.")
    parser.add_argument("--umn-only", action="store_true",
                        help="Keep only buildings OSM records as operated by the University. "
                             "Strictest option: drops campus adjacent places students still use, "
                             "such as fraternity houses and the Dinkydome.")
    parser.add_argument("--raw-dump", metavar="PATH",
                        help="Save the raw Overpass elements to PATH. Useful for tuning the "
                             "filters offline, since the public endpoint rate limits repeat runs.")
    parser.add_argument("--from-raw", metavar="PATH",
                        help="Load elements from a previous --raw-dump instead of querying "
                             "Overpass. Lets filter changes be re-run without a network call.")
    args = parser.parse_args()

    raw_elements: list[dict] = []

    if args.from_raw:
        raw_elements = json.loads(Path(args.from_raw).read_text(encoding="utf-8"))
        print(f"Loaded {len(raw_elements)} raw elements from {args.from_raw}\n")
    else:
        print("Querying Overpass for UMN campus buildings")
        print(f"  endpoint: {OVERPASS_URL}\n")
        try:
            with httpx.Client() as client:
                for index, (campus, bounds) in enumerate(CAMPUS_BOUNDS.items()):
                    raw_elements.extend(fetch_campus(client, campus, bounds))
                    if index < len(CAMPUS_BOUNDS) - 1:
                        time.sleep(PAUSE_BETWEEN_CAMPUSES)
        except httpx.HTTPError as exc:
            print(f"\nOverpass request failed: {exc}")
            print("The public endpoint rate limits under load. Wait a minute and retry.")
            return 1

        print(f"\n{len(raw_elements)} raw elements fetched\n")

    if args.raw_dump:
        Path(args.raw_dump).write_text(
            json.dumps(raw_elements, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"Raw elements saved to {args.raw_dump}\n")

    buildings: dict[str, dict] = {}
    skipped: dict[str, int] = {}

    for element in raw_elements:
        row, reason = normalize(element, args.include_minor, args.umn_only)
        if row is None:
            skipped[reason] = skipped.get(reason, 0) + 1
            continue
        # Campus bounding boxes are disjoint, but a building can still be
        # returned twice if it sits on a shared edge. Keyed by OSM id, so the
        # second copy simply overwrites the first with identical data.
        buildings[row["osm_id"]] = row

    deduped, duplicates_removed = deduplicate(list(buildings.values()))
    rows = sorted(deduped, key=lambda b: (b["campus_location"], b["name"]))

    if skipped:
        print("Skipped:")
        for reason, count in sorted(skipped.items(), key=lambda kv: -kv[1]):
            print(f"  {count:4d}  {reason}")
        print()

    if duplicates_removed:
        print(f"Collapsed {duplicates_removed} duplicate mappings of the same building\n")

    by_campus: dict[str, int] = {}
    with_address = 0
    with_short_name = 0
    umn_operated = 0
    for row in rows:
        by_campus[row["campus_location"]] = by_campus.get(row["campus_location"], 0) + 1
        with_address += 1 if row["address"] else 0
        with_short_name += 1 if row["short_name"] else 0
        umn_operated += 1 if row["_umn"] else 0

    # Internal scoring fields are for deduplication only, never persisted.
    for row in rows:
        row.pop("_umn", None)
        row.pop("_tag_count", None)

    print_table(
        ["Campus", "Buildings"],
        [[campus, count] for campus, count in sorted(by_campus.items())],
    )
    print(f"\nTotal: {len(rows)} buildings")
    print(f"  UMN operated:    {umn_operated}")
    print(f"  with address:    {with_address}")
    print(f"  with short_name: {with_short_name}\n")

    print("Sample:")
    print_table(
        ["Name", "Short", "Campus", "Address"],
        [[r["name"][:38], r["short_name"] or "", r["campus_location"], (r["address"] or "")[:28]]
         for r in rows[:12]],
    )

    if not args.write:
        print(f"\nDry run. Re-run with --write to save to {OUTPUT_PATH}")
        return 0

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(rows, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"\nWrote {len(rows)} buildings to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
