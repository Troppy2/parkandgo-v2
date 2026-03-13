export type EventCategory = "Sports" | "Student Life" | "Academics" | "STEM" | "Arts"

export interface CampusEvent {
  event_id: number
  title: string
  location_name: string             // required in backend schema (not Optional)
  latitude: number | null
  longitude: number | null
  starts_at: string | null          // Optional[datetime] in backend
  ends_at: string | null
  category: EventCategory
  source_url: string | null
  external_id: string               // required in backend schema (not Optional)
  price: number | null
  created_at: string | null         // present in backend schema
}
