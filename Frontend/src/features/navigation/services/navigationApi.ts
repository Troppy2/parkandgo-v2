import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"

// consent_flag is intentionally absent. The server stamps it from the user's
// stored consent and ignores anything the client sends.
export interface ParkingHistoryCreatePayload {
  spot_id: number
  start_time: string
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
