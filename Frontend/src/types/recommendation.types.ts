import type { ParkingSpot } from "./parking.types"

export interface ScoreBreakdown {
  cost: number        // max 40
  distance: number    // max 25
  preferences: number // max 15
  major: number       // max 10
  verified: number    // max 10
  event: number       // max 15 (bonus, only nonzero when event_id provided)
}

export interface RecommendationResponse {
  spot: ParkingSpot
  score: number
  score_breakdown: ScoreBreakdown
}