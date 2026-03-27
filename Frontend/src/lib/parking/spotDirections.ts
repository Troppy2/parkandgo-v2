import type { ParkingSpot } from "../../types/parking.types"
import type { RecommendationResponse } from "../../types/recommendation.types"

export function spotHasDirections(spot: Pick<ParkingSpot, "latitude" | "longitude">): boolean {
  return Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude)
}

export function recommendationHasDirections(
  recommendation: Pick<RecommendationResponse, "spot">
): boolean {
  return spotHasDirections(recommendation.spot)
}
