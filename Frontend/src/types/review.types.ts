import type { ParkingSpot } from "./parking.types"

export interface SpotReviewSummary {
  average_rating: number
  review_count: number
}

export interface SpotReviewResponse {
  review_id: number
  spot_id: number
  user_id: number
  rating: number
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface SpotReviewCreate {
  spot_id: number
  rating: number
  notes?: string | null
}

export interface SpotReviewWithSpot extends SpotReviewResponse {
  spot?: ParkingSpot
}
