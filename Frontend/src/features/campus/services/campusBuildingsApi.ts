import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { CampusBuilding, SavedBuilding } from "../../../types/campus_building.types"
import type { CampusLocation } from "../../../types/parking.types"

/**
 * Campus building lookups for Campus Mode.
 *
 * Buildings are public reference data, so the list, search, and nearby calls
 * work for guests. Only the saved-building calls require an account.
 */

export async function getCampusBuildings(campus?: CampusLocation): Promise<CampusBuilding[]> {
  const { data } = await apiClient.get<CampusBuilding[]>(ENDPOINTS.CAMPUS_BUILDINGS.LIST, {
    params: campus ? { campus } : undefined,
  })
  return data
}

export async function searchCampusBuildings(
  query: string,
  limit = 20,
): Promise<CampusBuilding[]> {
  const trimmed = query.trim()
  // The backend returns an empty list for a blank query. Short-circuiting here
  // avoids a pointless round trip on every cleared search box.
  if (!trimmed) return []

  const { data } = await apiClient.get<CampusBuilding[]>(ENDPOINTS.CAMPUS_BUILDINGS.SEARCH, {
    params: { q: trimmed, limit },
  })
  return data
}

export async function getNearbyBuildings(
  latitude: number,
  longitude: number,
  limit = 20,
  radiusMiles = 1.5,
): Promise<CampusBuilding[]> {
  const { data } = await apiClient.get<CampusBuilding[]>(ENDPOINTS.CAMPUS_BUILDINGS.NEARBY, {
    params: { lat: latitude, lon: longitude, limit, radius_miles: radiusMiles },
  })
  return data
}

export async function getCampusBuilding(buildingId: number): Promise<CampusBuilding> {
  const { data } = await apiClient.get<CampusBuilding>(
    ENDPOINTS.CAMPUS_BUILDINGS.DETAIL(buildingId),
  )
  return data
}

// ── Saved buildings ──

export async function getSavedBuildings(): Promise<SavedBuilding[]> {
  const { data } = await apiClient.get<SavedBuilding[]>(ENDPOINTS.USERS.SAVED_BUILDINGS())
  return data
}

export async function saveBuilding(buildingId: number): Promise<SavedBuilding> {
  const { data } = await apiClient.post<SavedBuilding>(ENDPOINTS.USERS.SAVED_BUILDINGS(), {
    building_id: buildingId,
  })
  return data
}

export async function unsaveBuilding(buildingId: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.USERS.SAVED_BUILDINGS(buildingId))
}
