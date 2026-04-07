import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { SpotReviewCreate, SpotReviewResponse, SpotReviewSummary } from "../../../types/review.types"

export async function getSpotReviewSummary(spotId: number): Promise<SpotReviewSummary> {
  const { data } = await apiClient.get(ENDPOINTS.REVIEWS.SUMMARY(spotId))
  return data
}

export async function getSpotReviews(spotId: number): Promise<SpotReviewResponse[]> {
  const { data } = await apiClient.get(ENDPOINTS.REVIEWS.BY_SPOT(spotId))
  return data
}

export async function submitSpotReview(payload: SpotReviewCreate): Promise<SpotReviewResponse> {
  const { data } = await apiClient.post(ENDPOINTS.REVIEWS.BASE, payload)
  return data
}
