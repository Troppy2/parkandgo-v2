import { useQuery } from "@tanstack/react-query"
import { searchSpots } from "../services/searchApi"
import { useDebounce } from "../../../hooks/useDebounce"

export function useSearch(rawQuery: string) {
  // Debounce the raw input — 300ms delay
  const query = useDebounce(rawQuery, 300)

  return useQuery({
    queryKey: ["parking-search", query],
    queryFn: () => searchSpots(query),
    // only enable when query has at least 2 characters
    enabled: !!query && query.length >= 2,
    // search results stay fresh for 1 minute
    staleTime: 60_000,
  })
}