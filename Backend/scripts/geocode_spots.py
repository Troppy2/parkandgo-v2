#!/usr/bin/env python3
"""
Geocoding script for Park & Go V2

This script uses the Nominatim API (OpenStreetMap) to geocode parking spot addresses
and verify/update their latitude and longitude coordinates.

Usage:
    python geocode_spots.py              # Geocode all verified spots
    python geocode_spots.py --spot-id 1  # Geocode specific spot
    python geocode_spots.py --update     # Actually update the database
"""

import sys
import argparse
import time
from pathlib import Path
from functools import lru_cache
from typing import Optional

try:
    import httpx
    import tabulate
except ImportError:
    print("Please install required packages: pip install httpx tabulate")
    sys.exit(1)

# Add Backend app to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import psycopg2
    import psycopg2.extras
    from sqlalchemy.engine import make_url
    from app.core.config import settings
    from app.utils.geo import is_within_campus_bounds
except ImportError as e:
    print(f"Please install missing package: {e}")
    print("  pip install psycopg2-binary")
    sys.exit(1)


# ── Nominatim API Configuration ──
API_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {
    "User-Agent": "ParkAndGo-UMN-App/1.0"
}
API_RATE_LIMIT = 1.0  # seconds between requests (Nominatim asks for 1+ second delay)


class GeocodeError(Exception):
    """Raised when geocoding fails"""
    pass


@lru_cache(maxsize=256)
def geocode_address(address: str) -> Optional[dict]:
    """
    Convert an address to latitude/longitude using Nominatim API.
    Results are cached to avoid repeated API calls.
    
    Args:
        address: Full address string (e.g., "401 SE Oak St, Minneapolis, MN 55455")
    
    Returns:
        dict with 'lat' and 'lon' keys, or None if no result found
    
    Raises:
        GeocodeError if the API request fails
    """
    try:
        # Nominatim requires a delay between requests
        time.sleep(API_RATE_LIMIT)
        
        response = httpx.get(
            API_URL,
            params={
                "q": address,
                "format": "json",
                "limit": 1,
            },
            headers=HEADERS,
            timeout=10.0,
        )
        response.raise_for_status()
        
        data = response.json()
        
        if data and len(data) > 0:
            result = data[0]
            return {
                "lat": float(result["lat"]),
                "lon": float(result["lon"]),
                "display_name": result.get("display_name", ""),
            }
        return None
    except httpx.HTTPError as e:
        raise GeocodeError(f"API request failed for '{address}': {e}")
    except (ValueError, KeyError, IndexError) as e:
        raise GeocodeError(f"Failed to parse geocoding response for '{address}': {e}")


def get_db_connection():
    """Create a PostgreSQL connection"""
    from sqlalchemy.engine import make_url
    
    # Parse the database_url
    db_url = make_url(settings.database_url)
    
    return psycopg2.connect(
        host=db_url.host,
        port=db_url.port,
        database=db_url.database,
        user=db_url.username,
        password=db_url.password,
    )


def get_spots_to_geocode(
    conn,
    spot_id: Optional[int] = None,
    verified_only: bool = True,
) -> list[dict]:
    """
    Fetch parking spots from database.
    
    Args:
        conn: Database connection
        spot_id: If provided, fetch only this spot ID
        verified_only: If True, only fetch verified spots
    
    Returns:
        List of spot dicts
    """
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    if spot_id:
        query = "SELECT * FROM parking_spots WHERE spot_id = %s"
        cursor.execute(query, (spot_id,))
    elif verified_only:
        query = "SELECT * FROM parking_spots WHERE is_verified = TRUE ORDER BY spot_id"
        cursor.execute(query)
    else:
        query = "SELECT * FROM parking_spots ORDER BY spot_id"
        cursor.execute(query)
    
    spots = cursor.fetchall()
    cursor.close()
    return spots


def verify_spot_coordinates(
    spot: dict,
    conn,
    update_db: bool = False,
    force_update: bool = False,
) -> dict:
    """
    Verify a parking spot's coordinates using Nominatim.
    
    Args:
        spot: Parking spot dict from database
        conn: Database connection
        update_db: If True, update database with new coordinates
        force_update: If True, update even if coordinates already exist
    
    Returns:
        dict with verification results
    """
    result = {
        "spot_id": spot["spot_id"],
        "spot_name": spot["spot_name"],
        "address": spot["address"],
        "status": "pending",
        "old_coords": None,
        "new_coords": None,
        "error": None,
        "updated": False,
    }
    
    # Check if address is available
    if not spot["address"]:
        result["status"] = "skip"
        result["error"] = "No address provided"
        return result
    
    # Try to geocode the address
    try:
        geocoded = geocode_address(spot["address"])
    except GeocodeError as e:
        result["status"] = "error"
        result["error"] = str(e)
        return result
    
    if not geocoded:
        result["status"] = "error"
        result["error"] = "Nominatim returned no results"
        return result
    
    new_lat = geocoded["lat"]
    new_lon = geocoded["lon"]
    
    # Store old coordinates
    if spot["latitude"] is not None and spot["longitude"] is not None:
        result["old_coords"] = {
            "lat": spot["latitude"],
            "lon": spot["longitude"],
        }
    
    result["new_coords"] = {
        "lat": new_lat,
        "lon": new_lon,
        "display_name": geocoded.get("display_name", ""),
    }
    
    # Check if coordinates are within UMN campus bounds
    if not is_within_campus_bounds(new_lat, new_lon):
        result["status"] = "warning"
        result["error"] = "Geocoded coordinates are NOT within UMN campus bounds!"
        return result
    
    # Check if coordinates changed
    if result["old_coords"]:
        old_lat, old_lon = result["old_coords"]["lat"], result["old_coords"]["lon"]
        lat_diff = abs(new_lat - old_lat)
        lon_diff = abs(new_lon - old_lon)
        
        if lat_diff < 0.0001 and lon_diff < 0.0001:
            # Coordinates match (within ~10 meters)
            result["status"] = "verified"
            result["updated"] = False
            return result
        else:
            # Coordinates differ, mark as mismatch
            result["status"] = "mismatch"
            if not force_update:
                return result
    
    # Update database if requested
    if update_db and (not result["old_coords"] or force_update or result["status"] == "mismatch"):
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE parking_spots SET latitude = %s, longitude = %s WHERE spot_id = %s",
            (new_lat, new_lon, spot["spot_id"])
        )
        conn.commit()
        cursor.close()
        result["updated"] = True
        result["status"] = "updated"
    
    return result


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Geocode parking spot addresses using Nominatim API"
    )
    parser.add_argument(
        "--spot-id",
        type=int,
        help="Geocode only a specific spot ID",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="Actually update the database with new coordinates",
    )
    parser.add_argument(
        "--force-update",
        action="store_true",
        help="Force update even if coordinates already exist",
    )
    parser.add_argument(
        "--all-spots",
        action="store_true",
        help="Geocode all spots (including unverified)",
    )
    
    args = parser.parse_args()
    
    try:
        # Connect to database
        conn = get_db_connection()
        db_url = make_url(settings.database_url)
        print(f"✅ Connected to database: {db_url.database}\n")
        
        print("🔍 Fetching parking spots...\n")
        
        # Fetch spots
        spots = get_spots_to_geocode(
            conn,
            spot_id=args.spot_id,
            verified_only=not args.all_spots,
        )
        
        if not spots:
            print("❌ No spots found")
            return
        
        print(f"📍 Found {len(spots)} spot(s) to geocode\n")
        
        # Verify each spot
        results = []
        for i, spot in enumerate(spots, 1):
            print(f"[{i}/{len(spots)}] Geocoding: {spot['spot_name']}")
            
            result = verify_spot_coordinates(
                spot,
                conn,
                update_db=args.update,
                force_update=args.force_update,
            )
            
            results.append(result)
        
        # Print results table
        print("\n" + "=" * 100)
        print("GEOCODING RESULTS")
        print("=" * 100 + "\n")
        
        table_data = []
        for r in results:
            # Format coordinates
            old_coord_str = (
                f"({r['old_coords']['lat']:.4f}, {r['old_coords']['lon']:.4f})"
                if r["old_coords"]
                else "None"
            )
            new_coord_str = (
                f"({r['new_coords']['lat']:.4f}, {r['new_coords']['lon']:.4f})"
                if r["new_coords"]
                else "N/A"
            )
            
            table_data.append([
                r["spot_id"],
                r["spot_name"][:20],
                r["status"].upper(),
                old_coord_str,
                new_coord_str,
                r["error"] or "—",
            ])
        
        headers = ["ID", "Spot Name", "Status", "Old Coords", "New Coords", "Error/Note"]
        print(tabulate.tabulate(
            table_data,
            headers=headers,
            tablefmt="grid",
            maxcolwidths=[5, 20, 12, 25, 25, 40],
        ))
        
        # Summary
        print("\n" + "=" * 100)
        print("SUMMARY")
        print("=" * 100)
        
        status_counts = {}
        for r in results:
            status = r["status"]
            status_counts[status] = status_counts.get(status, 0) + 1
        
        for status, count in sorted(status_counts.items()):
            print(f"  {status.upper()}: {count}")
        
        updated_count = sum(1 for r in results if r["updated"])
        if updated_count > 0:
            print(f"\n  ✅ {updated_count} spot(s) updated in database")
        elif args.update:
            print("\n  ℹ️  To preview what would be updated, run without --update")
        else:
            print("\n  ℹ️  To update the database, add --update flag")
        
        print()
        
        conn.close()
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
