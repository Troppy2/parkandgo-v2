import { useRecommendationStore } from "@/store/recommendationStore"
import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { RecommendationResponse } from "../../../types/recommendation.types"

interface RecommendationParams {
  lat?: number
  lon?: number
  limit?: number
  verifiedOnly?: boolean
  travelMode?: string
}

export async function getRecommendations(
  params: RecommendationParams
): Promise<RecommendationResponse[]> {
  const response = await apiClient.get(ENDPOINTS.RECOMMENDATIONS.BASE, {
    params: {
      user_lat: params.lat,
      user_lon: params.lon,
      limit: params.limit,
      travel_mode: params.travelMode ?? "walking",
      ...(params.verifiedOnly ? { verified_only: true } : {}),
    },
  })

  if (response.data && response.data.length > 0) {
    useRecommendationStore.getState().setCachedRecommendations(response.data)
  }
  return response.data
}