import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { RecommendationResponse } from "../../../types/recommendation.types"

interface RecommendationParams {
  lat?: number
  lon?: number
  limit?: number
}

// this function should GET to ENDPOINTS.RECOMMENDATIONS.BASE
// Pass lat as user_lat, lon as user_lon, limit as limit in params
// Return type: Promise<RecommendationResponse[]>
export async function getRecommendations(
  params: RecommendationParams
): Promise<RecommendationResponse[]> {
  // { params: { user_lat: params.lat, user_lon: params.lon, limit: params.limit } }
  const response = await apiClient.get(ENDPOINTS.RECOMMENDATIONS.BASE, {
    params: {
      user_lat: params.lat,
      user_lon: params.lon,
      limit: params.limit,
    },
  })
  return response.data
}