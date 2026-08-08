from math import radians, sin, cos, sqrt, atan2

# Earth's radius in miles. Distances in this project are reported in miles
# because the recommendation score breakdown and the UI both use miles.
EARTHS_RADIUS_MILES = 3959

# UMN campus bounding boxes used to validate user-submitted parking spot coordinates.
# A spot is accepted if its coordinates fall within ANY of the three campus regions.
CAMPUS_BOUNDS = {
    "East Bank": {
        # From the Mississippi River to Huntington Bank Stadium,
        # and from 4th St SE down to East River Parkway.
        "lat_min": 44.9680, "lat_max": 44.9810,
        "lon_min": -93.2420, "lon_max": -93.2200,
    },
    "West Bank": {
        # Around Carlson School, Blegen Hall, and Middlebrook Hall,
        # west of the Mississippi River.
        "lat_min": 44.9670, "lat_max": 44.9750,
        "lon_min": -93.2480, "lon_max": -93.2380,
    },
    "St. Paul": {
        # Falcon Heights area from Larpenteur Ave to Commonwealth Ave,
        # and from Cleveland Ave to Gortner Ave.
        "lat_min": 44.9800, "lat_max": 44.9950,
        "lon_min": -93.1850, "lon_max": -93.1700,
    },
}


def is_within_campus_bounds(latitude: float, longitude: float) -> bool:
    for bounds in CAMPUS_BOUNDS.values():
        if (bounds["lat_min"] <= latitude <= bounds["lat_max"]) and \
           (bounds["lon_min"] <= longitude <= bounds["lon_max"]):
            return True
    return False


def campus_for_coordinates(latitude: float, longitude: float) -> str | None:
    """
    Return the name of the campus whose bounding box contains this point.

    Returns None when the point is outside every campus. Boxes do not overlap,
    so the first match is the only match. This exists so campus assignment for
    imported reference data reuses the same boxes that validate user submitted
    spots, instead of a second set of coordinates that could drift out of step.
    """
    for name, bounds in CAMPUS_BOUNDS.items():
        if (bounds["lat_min"] <= latitude <= bounds["lat_max"]) and \
           (bounds["lon_min"] <= longitude <= bounds["lon_max"]):
            return name
    return None


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the real-world distance between two lat/lon points in miles.
    Uses the Haversine formula which accounts for Earth's curvature.
    """
    # Convert degrees to radians (required for trig functions)
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    # Haversine formula
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return EARTHS_RADIUS_MILES * c


def bounding_box_for_radius(
    latitude: float, longitude: float, radius_miles: float
) -> tuple[float, float, float, float]:
    """
    Return (lat_min, lat_max, lon_min, lon_max) covering a radius around a point.

    Used as a cheap SQL prefilter before an exact Haversine sort in Python. The
    box is deliberately a slight overestimate: it never excludes a row that the
    exact distance check would have kept, so correctness rests on the Haversine
    pass and this only limits how many rows it has to look at. Plain arithmetic
    on latitude and longitude keeps it portable across PostgreSQL and the
    SQLite engine the tests run on, which is why there is no PostGIS here.
    """
    # One degree of latitude is ~69 miles anywhere on the globe.
    lat_delta = radius_miles / 69.0

    # Degrees of longitude shrink toward the poles by cos(latitude). Clamp the
    # divisor so a tiny cosine near the poles cannot blow the box up or divide
    # by zero. At UMN latitudes cos is ~0.71, so this clamp never binds here.
    lon_degree_miles = max(cos(radians(latitude)) * 69.0, 0.1)
    lon_delta = radius_miles / lon_degree_miles

    return (
        latitude - lat_delta,
        latitude + lat_delta,
        longitude - lon_delta,
        longitude + lon_delta,
    )
