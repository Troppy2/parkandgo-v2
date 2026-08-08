import { useQuery } from "@tanstack/react-query"
import {
  getCampusBuildings,
  getNearbyBuildings,
  searchCampusBuildings,
} from "../services/campusBuildingsApi"
import type { CampusLocation } from "../../../types/parking.types"

// Buildings only change when someone reruns the extraction script and ships a
// new migration, so this cache can be held far longer than event or spot data.
const BUILDING_STALE_TIME = 60 * 60 * 1000

export function useCampusBuildings(campus?: CampusLocation) {
  return useQuery({
    queryKey: ["campus-buildings", campus ?? "all"],
    queryFn: () => getCampusBuildings(campus),
    staleTime: BUILDING_STALE_TIME,
  })
}

export function useCampusBuildingSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ["campus-buildings", "search", trimmed],
    queryFn: () => searchCampusBuildings(trimmed),
    // No request until there is something to search for.
    enabled: trimmed.length > 0,
    staleTime: BUILDING_STALE_TIME,
  })
}

/**
 * Buildings nearest the user, closest first.
 *
 * Coordinates are rounded into the query key so ordinary GPS jitter does not
 * spawn a new cache entry and refetch on every position update. Three decimal
 * places is roughly 100 metres, well below the distances that would reorder
 * the list.
 */
export function useNearbyBuildings(
  location: [number, number] | null,
  radiusMiles = 1.5,
) {
  const longitude = location?.[0]
  const latitude = location?.[1]
  const keyLat = latitude !== undefined ? latitude.toFixed(3) : null
  const keyLon = longitude !== undefined ? longitude.toFixed(3) : null

  return useQuery({
    queryKey: ["campus-buildings", "nearby", keyLat, keyLon, radiusMiles],
    queryFn: () => getNearbyBuildings(latitude!, longitude!, 50, radiusMiles),
    enabled: latitude !== undefined && longitude !== undefined,
    staleTime: BUILDING_STALE_TIME,
  })
}
