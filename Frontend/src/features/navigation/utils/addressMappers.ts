import type { GeocodeResult } from "../../parking/services/geocodingService"
import type { ParkingSpot } from "../../../types/parking.types"

/**
 * Adapt a geocoded address to the shape a trip expects.
 *
 * Same boundary trick as buildingToParkingSpot: convert once, on the way in,
 * and the whole navigation stack routes to an arbitrary address without
 * knowing one exists.
 */

/**
 * Marks a place that came from the geocoder rather than from our own data.
 *
 * Negative so it can never be mistaken for a real spot or building id, and a
 * single shared value rather than a counter because nothing keys off it: stops
 * carry their own ids, and the only reader is the JSON context log. Anything
 * that needs to tell two addresses apart should use the coordinates.
 */
export const ADDRESS_PLACE_ID = -2

/**
 * Nominatim returns a long comma-separated display name, for example
 * "300, Washington Avenue Southeast, Marcy-Holmes, Minneapolis, ...". The first
 * two parts are the street address, which is what identifies the place in a
 * narrow row; the whole string is kept as the address for the details panel.
 */
export function addressToParkingSpot(result: GeocodeResult): ParkingSpot {
  const parts = result.displayName.split(",").map((part) => part.trim())
  const shortName = parts.slice(0, 2).join(" ") || result.displayName

  return {
    spot_id: ADDRESS_PLACE_ID,
    spot_name: shortName,
    campus_location: null,
    parking_type: null,
    cost: null,
    walk_time: null,
    near_buildings: null,
    address: result.displayName,
    latitude: result.lat,
    longitude: result.lon,
    is_verified: null,
    submitted_by: null,
    created_at: null,
  }
}
