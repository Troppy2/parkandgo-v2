import type { ParkingSpot } from "./parking.types"

/**
 * One intermediate stop on a trip.
 *
 * The place is a ParkingSpot because that is already the universal destination
 * shape in this app: buildings arrive through buildingToParkingSpot and private
 * spots through privateSpotToParkingSpot, so the whole navigation stack reads
 * one type. A stop is the same kind of thing as a destination, so it gets the
 * same treatment rather than a parallel model.
 *
 * The id is separate from place.spot_id on purpose. Parking spots and campus
 * buildings are separate autoincrement sequences, so building 12 and spot 12
 * both exist: keying rows on spot_id would collide across sources and mis-render
 * a reorder. The same place can also legitimately appear twice on one trip.
 */
export interface TripStop {
  id: string
  place: ParkingSpot
}

let stopCounter = 0

/** Stable client-side id for a stop row. Not persisted, not sent anywhere. */
export function createStopId(): string {
  stopCounter += 1
  return `stop-${stopCounter}`
}

/**
 * The synthetic place used when the user's live position has to become a real
 * endpoint, which happens when a trip starting at "Your location" is swapped so
 * that position becomes the destination.
 *
 * spot_id is negative so it can never be mistaken for a real spot or building
 * id by anything that logs it.
 */
export function userLocationPlace(coords: [number, number]): ParkingSpot {
  return {
    spot_id: -1,
    spot_name: "Your location",
    campus_location: null,
    parking_type: null,
    cost: null,
    walk_time: null,
    near_buildings: null,
    address: null,
    latitude: coords[1],
    longitude: coords[0],
    is_verified: null,
    submitted_by: null,
    created_at: null,
  }
}
