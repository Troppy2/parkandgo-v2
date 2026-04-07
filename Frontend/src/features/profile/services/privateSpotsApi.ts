import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { PrivateSpot, PrivateSpotCreate, PrivateSpotUpdate } from "../../../types/private_spot.types"

export async function getPrivateSpots(): Promise<PrivateSpot[]> {
  const { data } = await apiClient.get(ENDPOINTS.PRIVATE_SPOTS.BASE)
  return data
}

export async function createPrivateSpot(body: PrivateSpotCreate): Promise<PrivateSpot> {
  const { data } = await apiClient.post(ENDPOINTS.PRIVATE_SPOTS.BASE, body)
  return data
}

export async function updatePrivateSpot(spotId: number, body: PrivateSpotUpdate): Promise<PrivateSpot> {
  const { data } = await apiClient.patch(ENDPOINTS.PRIVATE_SPOTS.BY_ID(spotId), body)
  return data
}

export async function deletePrivateSpot(spotId: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.PRIVATE_SPOTS.BY_ID(spotId))
}
