import { useEffect } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { getRecommendations } from "../services/recommendationApi"
import { logContextEvent } from "../../navigation/services/navigationApi"

interface UseRecommendationsParams {
  lat?: number
  lon?: number
  limit?: number
  verifiedOnly?: boolean
  travelMode?: string
}

// A high-accuracy geolocation watch emits a new fix every few seconds, and the raw
// coordinates differ in the 7th decimal even when the device is standing still. Feeding
// those raw values into the query key made every fix a cache miss, which flipped isLoading
// back to true and swapped the card list for a skeleton. Quantizing to 4 decimals (about
// 11 m) keeps the key stable while standing still and still refetches on real movement.
// Same idea as useCampusBuildings, which rounds to 3 decimals for the same reason.
const KEY_PRECISION = 4

function quantize(value: number | undefined): string | null {
  return value !== undefined ? value.toFixed(KEY_PRECISION) : null
}

export function useRecommendations(params: UseRecommendationsParams) {
  const keyLat = quantize(params.lat)
  const keyLon = quantize(params.lon)

  const query = useQuery({
    queryKey: ["recommendations", keyLat, keyLon, params.limit, params.verifiedOnly, params.travelMode],
    // The request still uses the precise coordinates, so backend ranking is unaffected.
    queryFn: () => getRecommendations(params),
    // Fetch recommendations for all users (authenticated and guests) - allows viewing parking spots without login
    enabled: true,
    // On a genuine key change (real movement, a filter toggle, a travel mode switch) keep
    // showing the previous list while the new one loads instead of blanking to a skeleton.
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (!query.data) return
    void logContextEvent("recommendation_view", {
      result_count: query.data.length,
      verified_only: !!params.verifiedOnly,
      has_location: params.lat != null && params.lon != null,
    }).catch(() => undefined)
    // Keyed on the quantized position so the log does not fire on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyLat, keyLon, params.verifiedOnly, query.data])

  return query
}
