import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { CampusEvent, EventCategory } from "../../../types/campus_event.types"

// GET /events — optional category filter
// When category is undefined, fetches all events
export async function getEvents(category?: EventCategory): Promise<CampusEvent[]> {
  const { data } = await apiClient.get(ENDPOINTS.EVENTS.LIST, {
    params: category ? { category } : {},
  })
  return data
}

// GET to ENDPOINTS.EVENTS.DETAIL(eventId)
// Returns a single CampusEvent

export async function getEventById(eventId: number): Promise<CampusEvent> {
  const { data } = await apiClient.get(ENDPOINTS.EVENTS.DETAIL(eventId))
  return data
}
