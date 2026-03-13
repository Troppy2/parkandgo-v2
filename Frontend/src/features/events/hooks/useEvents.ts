import { useQuery } from "@tanstack/react-query"
import { getEvents } from "../services/eventsApi"
import type { EventCategory } from "../../../types/campus_event.types"

export function useEvents(category?: EventCategory) {
  return useQuery({
    queryKey: ["events", category],
    queryFn: () => getEvents(category),
    staleTime: 5 * 60 * 1000,
  })
}