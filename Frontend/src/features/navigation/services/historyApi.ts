import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"

export interface ParkingHistoryCreateBody {
  spot_id: number
  start_time: string
  end_time?: string | null
  consent_flag?: boolean
}

export async function createParkingHistory(body: ParkingHistoryCreateBody) {
  const { data } = await apiClient.post(ENDPOINTS.HISTORY.BASE, body)
  return data
}
