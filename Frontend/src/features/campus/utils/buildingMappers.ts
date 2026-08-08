import type { CampusBuilding } from "../../../types/campus_building.types"
import type { ParkingSpot } from "../../../types/parking.types"

/**
 * Adapt a campus building to the shape navStore expects for a destination.
 *
 * navStore.destination is typed as ParkingSpot, and six components read off it
 * (RouteDisplay, TurnByTurn, ETAIndicator, useActiveNavigation, RouteLayer,
 * MapView). Converting at this one boundary means the entire navigation stack
 * routes to a building with no changes at all, which follows the precedent set
 * by privateSpotToParkingSpot in features/profile/utils/privateSpotMappers.ts.
 *
 * The parking-only fields are deliberately null rather than filled with
 * placeholder values. RouteDisplay hides its Parking Type and price rows when
 * they are null, so a building destination shows neither "Parking Type: --"
 * nor a fake cost.
 *
 * spot_id carries the building id. Nothing downstream writes it to a foreign
 * key: the only consumer is recommendation_context_log.context_data, which is
 * a plain JSON column.
 */
export function buildingToParkingSpot(building: CampusBuilding): ParkingSpot {
  return {
    spot_id: building.building_id,
    spot_name: building.name,
    campus_location: building.campus_location,
    parking_type: null,
    cost: null,
    walk_time: null,
    near_buildings: null,
    address: building.address,
    latitude: building.latitude,
    longitude: building.longitude,
    is_verified: null,
    submitted_by: null,
    created_at: building.created_at,
  }
}

/** Format a distance in miles for display on a building card. */
export function formatBuildingDistance(distanceMiles: number | null): string | null {
  if (distanceMiles === null) return null

  // Below a tenth of a mile, feet are easier to judge than a decimal.
  if (distanceMiles < 0.1) {
    const feet = Math.round(distanceMiles * 5280)
    return `${feet} ft`
  }
  return `${distanceMiles.toFixed(1)} mi`
}

/**
 * Rough walking time for a distance, in whole minutes.
 *
 * Uses 3 mph to match SPEED_MPH.walking in the routing service, so the card
 * estimate and the routed ETA do not visibly disagree before a route loads.
 */
export function estimateWalkMinutes(distanceMiles: number | null): string | null {
  if (distanceMiles === null) return null
  const minutes = Math.max(1, Math.round((distanceMiles / 3) * 60))
  return `${minutes} min walk`
}
