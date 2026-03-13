import type { ParkingSpot } from "./parking.types"

export interface SavedSpot {
  id: number
  user_id: number
  spot_id: number
  custom_name: string | null
  spot: ParkingSpot                // nested full spot object from backend
  created_at: string | null        // Optional[datetime] in backend schema
}

// This is the PATCH body for renaming a saved spot
export interface SavedSpotRename {
  custom_name: string
}
