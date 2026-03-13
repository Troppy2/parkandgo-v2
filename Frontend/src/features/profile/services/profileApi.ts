import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { UserProfileUpdate } from "../../../types/user.types"
import type { SavedSpot } from "../../../types/saved_spot.types"

// Update the current user's profile fields
export async function updateProfile(updates: UserProfileUpdate) {
  const { data } = await apiClient.patch(ENDPOINTS.USERS.ME, updates)
  return data
}

// Get all saved spots for the current user
export async function getSavedSpots(): Promise<SavedSpot[]> {
  const { data } = await apiClient.get(ENDPOINTS.USERS.SAVED())
  return data
}

// Save a spot — POST with spot_id in the body
export async function saveSpot(spotId: number): Promise<SavedSpot> {
  const { data } = await apiClient.post(ENDPOINTS.USERS.SAVED(), {
    spot_id: spotId,
  })
  return data
}

// Unsave a spot — DELETE /users/me/saved/:spotId — returns 204 No Content
export async function unsaveSpot(spotId: number): Promise<void> {
  await apiClient.delete(ENDPOINTS.USERS.SAVED(spotId))
}

// Rename a saved spot — PATCH /users/me/saved/:spotId/rename with { custom_name }
export async function renameSpot(spotId: number, customName: string): Promise<SavedSpot> {
  const { data } = await apiClient.patch(ENDPOINTS.USERS.RENAME(spotId), {
    custom_name: customName,
  })
  return data
}
