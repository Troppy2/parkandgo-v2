import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { ParkingSpot, SpotFilters } from "../../../types/parking.types"

// Text search — hits GET /parking/search?q=...
export async function searchSpots(query: string): Promise<ParkingSpot[]> {
  const { data } = await apiClient.get(ENDPOINTS.PARKING.SEARCH, {
    params: { q: query },
  })
  return data
}

// Filter search — hits GET /parking/filter
// SpotFilters already has the right shape from Phase 9
// but some fields may be undefined — only send defined ones
export async function filterSpots(filters: SpotFilters): Promise<ParkingSpot[]> {
  const { data } = await apiClient.get(ENDPOINTS.PARKING.FILTER, {
    params: filters,
  })
  return data
}