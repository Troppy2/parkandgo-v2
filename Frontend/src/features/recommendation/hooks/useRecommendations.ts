import { useQuery } from "@tanstack/react-query"
import { getRecommendations } from "../services/recommendationApi"
import { useAuthStore } from "../../../store/authStore"

interface UseRecommendationsParams {
  lat?: number
  lon?: number
  limit?: number
}

export function useRecommendations(params: UseRecommendationsParams) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: ["recommendations", params.lat, params.lon],
    queryFn: () => getRecommendations(params),
    // Only fetch when the user has a real token — guests and unauthenticated
    // users would get a 401 since the backend requires get_current_user
    enabled: isAuthenticated,
  })
}
