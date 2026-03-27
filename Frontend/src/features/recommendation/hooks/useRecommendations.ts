import { useQuery } from "@tanstack/react-query"
import { getRecommendations } from "../services/recommendationApi"

interface UseRecommendationsParams {
  lat?: number
  lon?: number
  limit?: number
  verifiedOnly?: boolean
}

export function useRecommendations(params: UseRecommendationsParams) {
  return useQuery({
    // verifiedOnly is part of the key so TanStack Query auto-refetches when it changes
    queryKey: ["recommendations", params.lat, params.lon, params.limit, params.verifiedOnly],
    queryFn: () => getRecommendations(params),
    // Fetch recommendations for all users (authenticated and guests) — allows viewing parking spots without login
    enabled: true,
  })
}
