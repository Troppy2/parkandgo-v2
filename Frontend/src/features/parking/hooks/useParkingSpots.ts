import { useQuery } from "@tanstack/react-query"
import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { ParkingSpot } from "../../../types/parking.types"

// Twin Cities metro bounding box — filters out any spot submitted with bad coordinates
const METRO_BOUNDS = { minLat: 44.78, maxLat: 45.15, minLon: -93.65, maxLon: -92.95 }

function isValidCoord(spot: ParkingSpot): boolean {
  if (spot.latitude == null || spot.longitude == null) return false
  return (
    spot.latitude >= METRO_BOUNDS.minLat &&
    spot.latitude <= METRO_BOUNDS.maxLat &&
    spot.longitude >= METRO_BOUNDS.minLon &&
    spot.longitude <= METRO_BOUNDS.maxLon
  )
}

export function useParkingSpots() {
  return useQuery<ParkingSpot[]>({
    queryKey: ["parking-spots-map"],
    queryFn: async () => {
      // verified_only keeps unverified user submissions (which may have bad coordinates) off the map
      const res = await apiClient.get(ENDPOINTS.PARKING.FILTER, {
        params: { verified_only: true },
      })
      return (res.data as ParkingSpot[]).filter(isValidCoord)
    },
    staleTime: 5 * 60 * 1000,
  })
}
