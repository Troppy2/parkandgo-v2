import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"

// consent_flag is intentionally not part of this body. The server stamps it
// from the user's stored consent and ignores anything the client sends.
export interface ParkingHistoryCreateBody {
  spot_id: number
  start_time: string
  end_time?: string | null
}

export async function createParkingHistory(body: ParkingHistoryCreateBody) {
  const { data } = await apiClient.post(ENDPOINTS.HISTORY.BASE, body)
  return data
}
