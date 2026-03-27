import client from "@/lib/api/client"
import { ENDPOINTS } from "@/lib/api/endpoints"
import type { ParkingSpot } from "@/types/parking.types"

export interface AdminStats {
  total_spots: number
  verified_spots: number
  unverified_spots: number
  total_users: number
  total_events: number
}

export interface ConfigEntry {
  key: string
  value: string
  description: string | null
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await client.get(ENDPOINTS.ADMIN.STATS)
  return data
}

export async function getUnverifiedSpots(): Promise<ParkingSpot[]> {
  const { data } = await client.get(ENDPOINTS.ADMIN.UNVERIFIED)
  return data
}

export async function verifySpot(spotId: number): Promise<ParkingSpot> {
  const { data } = await client.patch(ENDPOINTS.ADMIN.VERIFY_SPOT(spotId))
  return data
}

export async function deleteSpot(spotId: number): Promise<void> {
  await client.delete(ENDPOINTS.ADMIN.DELETE_SPOT(spotId))
}

export async function triggerEventSync(): Promise<{ synced: number }> {
  // Sync fetches multiple external iCal feeds — give it 30s instead of the default 10s
  const { data } = await client.post(ENDPOINTS.ADMIN.SYNC_EVENTS, {}, { timeout: 30000 })
  return data
}

export async function getAllConfig(): Promise<ConfigEntry[]> {
  const { data } = await client.get(ENDPOINTS.ADMIN.CONFIG)
  return data
}

export async function updateConfig(key: string, value: string): Promise<ConfigEntry> {
  const { data } = await client.patch(ENDPOINTS.ADMIN.CONFIG_KEY(key), { value })
  return data
}
