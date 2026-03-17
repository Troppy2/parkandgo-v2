export type ParkingType = "Parking Garage" | "Surface Lot" | "Street Parking"
export type CampusLocation = "East Bank" | "West Bank" | "St. Paul"

export interface ParkingSpot {
  spot_id: number
  spot_name: string
  campus_location: CampusLocation | null   // Optional in backend schema
  parking_type: ParkingType | null         // Optional in backend schema
  cost: number | null                      // Optional in backend schema
  walk_time: string | null
  near_buildings: string | null
  address: string | null                   // Optional in backend schema
  latitude: number | null
  longitude: number | null
  is_verified: boolean | null              // Optional in backend schema
  submitted_by: number | null
  created_at: string | null
}

// This is the POST /parking/ body that an authenticated user submits
// Required: spot_name, campus_location, parking_type, cost, address, latitude, longitude
// Optional: walk_time, near_buildings
export interface ParkingSpotCreate {
  spot_name: string
  campus_location: CampusLocation
  parking_type: ParkingType
  cost: number
  address: string
  latitude: number                         // required by backend ParkingSpotCreate
  longitude: number                        // required by backend ParkingSpotCreate
  walk_time?: string | null
  near_buildings?: string | null
}

export interface SpotFilters {
  parking_type?: ParkingType
  campus_location?: CampusLocation
  max_cost?: number
  verified_only?: boolean
}
