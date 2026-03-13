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
