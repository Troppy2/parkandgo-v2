import type { ParkingSpot } from "./parking.types"

export interface ScoreBreakdown {
  cost: number        // max 40
  distance: number    // max 25
  travel_time: number // max 15
  preferences: number // max 10
  major: number       // max 5
  verified: number    // max 5
  event: number       // max 15 (bonus, only nonzero when event_id provided)
}

export interface RecommendationResponse {
  spot: ParkingSpot
  score: number
  score_breakdown: ScoreBreakdown
}