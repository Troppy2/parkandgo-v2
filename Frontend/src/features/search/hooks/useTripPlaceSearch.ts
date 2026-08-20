import { useQuery } from "@tanstack/react-query"

import { useSearch } from "./useSearch"
import { useDebounce } from "../../../hooks/useDebounce"
import { useCampusBuildingSearch } from "../../campus/hooks/useCampusBuildings"
import { buildingToParkingSpot } from "../../campus/utils/buildingMappers"
import { addressToParkingSpot } from "../../navigation/utils/addressMappers"
import {
  searchAddresses,
  ADDRESS_SEARCH_DEBOUNCE_MS,
  ADDRESS_SEARCH_MIN_LENGTH,
} from "../../parking/services/geocodingService"
import type { ParkingSpot } from "../../../types/parking.types"

/**
 * The three things a user can search for as a place: campus buildings, parking
 * spots, and any street address.
 *
 * Both the search bar and the trip planner's place picker need exactly this, so
 * the pairing lives here rather than being written twice. Each source keeps its
 * own hook, cache key, and stale time; this only runs them together and caps
 * them the same way.
 *
 * Buildings and addresses come back already adapted to ParkingSpot, because
 * that is the shape every consumer wants to put into navStore. Callers that
 * need the building's own fields, an abbreviation or a campus for a subtitle,
 * should keep using useCampusBuildingSearch directly.
 *
 * Addresses are the odd source out: they come from Nominatim rather than our
 * own backend, so they wait for a third character, debounce more than twice as
 * long, and fail quietly. A geocoder being slow or down must never keep the
 * buildings and spots from appearing.
 */

// Small enough that two sections together still fit a phone screen. Matches the
// TOP_N the campus list uses.
export const PLACE_SECTION_LIMIT = 5

export interface TripPlaceResults {
  buildings: ParkingSpot[]
  spots: ParkingSpot[]
  addresses: ParkingSpot[]
  isLoading: boolean
  isEmpty: boolean
}

export function useTripPlaceSearch(query: string): TripPlaceResults {
  const { data: spotData, isLoading: spotsLoading } = useSearch(query)
  const { data: buildingData, isLoading: buildingsLoading } = useCampusBuildingSearch(query)

  const addressQuery = useDebounce(query.trim(), ADDRESS_SEARCH_DEBOUNCE_MS)
  const { data: addressData, isLoading: addressesLoading } = useQuery({
    queryKey: ["address-search", addressQuery],
    queryFn: () => searchAddresses(addressQuery),
    enabled: addressQuery.length >= ADDRESS_SEARCH_MIN_LENGTH,
    // Addresses do not move, and this is someone else's rate-limited service.
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  const spots = (spotData ?? []).slice(0, PLACE_SECTION_LIMIT)
  const buildings = (buildingData ?? [])
    .slice(0, PLACE_SECTION_LIMIT)
    .map(buildingToParkingSpot)
  const addresses = (addressData ?? [])
    .slice(0, PLACE_SECTION_LIMIT)
    .map(addressToParkingSpot)

  return {
    buildings,
    spots,
    addresses,
    // Addresses are deliberately absent from the loading flag. They resolve
    // hundreds of milliseconds after the other two, and letting them hold the
    // spinner would hide buildings and spots that are already in hand.
    isLoading: spotsLoading || buildingsLoading,
    isEmpty:
      spots.length === 0 &&
      buildings.length === 0 &&
      addresses.length === 0 &&
      !addressesLoading,
  }
}
