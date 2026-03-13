import { useQuery } from "@tanstack/react-query"
import { filterSpots } from "../services/searchApi"
import type { SpotFilters } from "../../../types/parking.types"

export function useDebouncedSearch(filters: SpotFilters) {
  // Check if any filter is actually active
  // An inactive filter state has: no type, no campus, max_cost at its ceiling
  const hasActiveFilters =
    !!filters.parking_type ||
    !!filters.campus_location ||
    (filters.max_cost !== undefined && filters.max_cost < 20)

  return useQuery({
    queryKey: ["parking-filter", filters.parking_type, filters.campus_location, filters.max_cost],
    queryFn: () => filterSpots(filters),
    enabled: hasActiveFilters,
    staleTime: 60_000,
  })
}