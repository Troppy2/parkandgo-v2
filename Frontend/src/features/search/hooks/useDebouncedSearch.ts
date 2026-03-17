import { useQuery } from "@tanstack/react-query"
import { filterSpots } from "../services/searchApi"
import type { SpotFilters } from "../../../types/parking.types"
import { useUIStore } from "../../../store/uiStore"

export function useDebouncedSearch(filters: SpotFilters) {
  // Read verifiedOnly from global store so toggling it auto-refetches
  const verifiedOnly = useUIStore((s) => s.verifiedOnly)

  const hasActiveFilters =
    !!filters.parking_type ||
    !!filters.campus_location ||
    (filters.max_cost !== undefined && filters.max_cost < 20) ||
    verifiedOnly

  // Merge verified_only into the outgoing filter params
  const effectiveFilters: SpotFilters = {
    ...filters,
    ...(verifiedOnly ? { verified_only: true } : {}),
  }

  return useQuery({
    queryKey: ["parking-filter", filters.parking_type, filters.campus_location, filters.max_cost, verifiedOnly],
    queryFn: () => filterSpots(effectiveFilters),
    enabled: hasActiveFilters,
    staleTime: 60_000,
  })
}
