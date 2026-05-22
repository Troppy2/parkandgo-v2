import { useQuery } from "@tanstack/react-query"
import { filterSpots, getAllSpots } from "../services/searchApi"
import type { SpotFilters } from "../../../types/parking.types"
import { useUIStore } from "../../../store/uiStore"
import { spotHasDirections } from "../../../lib/parking/spotDirections"

interface UseDebouncedSearchOptions {
  includeAll?: boolean
}

export function useDebouncedSearch(filters: SpotFilters, options: UseDebouncedSearchOptions = {}) {
  // Read verifiedOnly from global store so toggling it auto-refetches
  const verifiedOnly = useUIStore((s) => s.verifiedOnly)
  const directionsOnly = useUIStore((s) => s.directionsOnly)

  const hasServerFilters =
    !!filters.parking_type ||
    !!filters.campus_location ||
    (filters.max_cost !== undefined && filters.max_cost < 20) ||
    verifiedOnly
  const hasActiveFilters = hasServerFilters || directionsOnly
  const shouldFetchAll = options.includeAll && !hasServerFilters

  // Merge verified_only into the outgoing filter params
  const effectiveFilters: SpotFilters = {
    ...filters,
    ...(verifiedOnly ? { verified_only: true } : {}),
  }

  return useQuery({
    queryKey: [
      "parking-filter",
      filters.parking_type,
      filters.campus_location,
      filters.max_cost,
      verifiedOnly,
      directionsOnly,
      options.includeAll,
    ],
    queryFn: async () => {
      const spots = shouldFetchAll ? await getAllSpots() : await filterSpots(effectiveFilters)
      return directionsOnly ? spots.filter(spotHasDirections) : spots
    },
    enabled: hasActiveFilters || shouldFetchAll,
    staleTime: 60_000,
  })
}
