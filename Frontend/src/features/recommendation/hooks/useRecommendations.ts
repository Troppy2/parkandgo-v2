import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { getRecommendations } from "../services/recommendationApi"
import { logContextEvent } from "../../navigation/services/navigationApi"

interface UseRecommendationsParams {
  lat?: number
  lon?: number
  limit?: number
  verifiedOnly?: boolean
}

export function useRecommendations(params: UseRecommendationsParams) {
  const query = useQuery({
    // verifiedOnly is part of the key so TanStack Query auto-refetches when it changes
    queryKey: ["recommendations", params.lat, params.lon, params.limit, params.verifiedOnly],
    queryFn: () => getRecommendations(params),
    // Fetch recommendations for all users (authenticated and guests) - allows viewing parking spots without login
    enabled: true,
  })

  useEffect(() => {
    if (!query.data) return
    void logContextEvent("recommendation_view", {
      result_count: query.data.length,
      verified_only: !!params.verifiedOnly,
      has_location: params.lat != null && params.lon != null,
    }).catch(() => undefined)
  }, [params.lat, params.lon, params.verifiedOnly, query.data])

  return query
}
