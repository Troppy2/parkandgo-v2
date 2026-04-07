import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"

export interface ParkingHistoryCreatePayload {
  spot_id: number
  start_time: string
  consent_flag: boolean
}

export async function createParkingHistory(payload: ParkingHistoryCreatePayload): Promise<{ history_id: number }> {
  const { data } = await apiClient.post(ENDPOINTS.HISTORY.BASE, payload)
  return data
}

export async function logContextEvent(action: string, contextData: Record<string, unknown>): Promise<void> {
  await apiClient.post(ENDPOINTS.LOGGING.CONTEXT, {
    action,
    context_data: contextData,
  })
}
