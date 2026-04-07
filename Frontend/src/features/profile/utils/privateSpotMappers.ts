import type { ParkingSpot } from "../../../types/parking.types"
import type { PrivateSpot } from "../../../types/private_spot.types"

export function privateSpotToParkingSpot(privateSpot: PrivateSpot): ParkingSpot {
  return {
    spot_id: privateSpot.private_spot_id,
    spot_name: privateSpot.name,
    campus_location: null,
    parking_type: null,
    cost: null,
    walk_time: null,
    near_buildings: privateSpot.notes,
    address: null,
    latitude: privateSpot.latitude,
    longitude: privateSpot.longitude,
    is_verified: true,
    submitted_by: privateSpot.user_id,
    created_at: privateSpot.created_at,
  }
}
