import { useQuery } from "@tanstack/react-query"
import { searchSpots } from "../services/searchApi"
import { useDebounce } from "../../../hooks/useDebounce"
import { useUIStore } from "../../../store/uiStore"
import { spotHasDirections } from "../../../lib/parking/spotDirections"

export function useSearch(rawQuery: string) {
  // Debounce the raw input — 300ms delay
  const query = useDebounce(rawQuery, 300)
  const directionsOnly = useUIStore((s) => s.directionsOnly)

  return useQuery({
    queryKey: ["parking-search", query, directionsOnly],
    queryFn: async () => {
      const spots = await searchSpots(query)
      return directionsOnly ? spots.filter(spotHasDirections) : spots
    },
    // only enable when query has at least 2 characters
    enabled: !!query && query.length >= 2,
    // search results stay fresh for 1 minute
    staleTime: 60_000,
  })
}
