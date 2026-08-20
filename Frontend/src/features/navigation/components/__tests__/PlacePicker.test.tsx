import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import PlacePicker from "../PlacePicker"
import { searchSpots } from "../../../search/services/searchApi"
import { searchCampusBuildings } from "../../../campus/services/campusBuildingsApi"
import { searchAddresses } from "../../../parking/services/geocodingService"
import type { ParkingSpot } from "../../../../types/parking.types"

vi.mock("../../../search/services/searchApi", () => ({
  searchSpots: vi.fn().mockResolvedValue([]),
}))
vi.mock("../../../campus/services/campusBuildingsApi", () => ({
  searchCampusBuildings: vi.fn().mockResolvedValue([]),
}))
vi.mock("../../../parking/services/geocodingService", async () => {
  const actual = await vi.importActual<typeof import("../../../parking/services/geocodingService")>(
    "../../../parking/services/geocodingService"
  )
  return { ...actual, searchAddresses: vi.fn().mockResolvedValue([]) }
})

const mockedSpots = vi.mocked(searchSpots)
const mockedBuildings = vi.mocked(searchCampusBuildings)
const mockedAddresses = vi.mocked(searchAddresses)

function renderPicker(onPick = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PlacePicker placeholder="Search for a stop" onPick={onPick} onCancel={vi.fn()} />
    </QueryClientProvider>
  )
  return onPick
}

function type(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Search for a stop"), { target: { value } })
}

describe("PlacePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSpots.mockResolvedValue([])
    mockedBuildings.mockResolvedValue([])
    mockedAddresses.mockResolvedValue([])
  })

  afterEach(cleanup)

  it("offers a geocoded address alongside the app's own places", async () => {
    mockedBuildings.mockResolvedValue([
      {
        building_id: 1,
        name: "Coffman Memorial Union",
        short_name: "CMU",
        campus_location: "East Bank",
        address: null,
        latitude: 44.9728,
        longitude: -93.2353,
        osm_id: null,
        created_at: null,
        distance_miles: null,
      },
    ])
    mockedAddresses.mockResolvedValue([
      { lat: 44.98, lon: -93.25, displayName: "612, Washington Avenue, Minneapolis, Minnesota" },
    ])

    renderPicker()
    type("washington")

    await waitFor(() => expect(screen.getByText("Addresses")).toBeInTheDocument())
    expect(screen.getByText("Buildings")).toBeInTheDocument()
    expect(screen.getByText("612 Washington Avenue")).toBeInTheDocument()
  })

  it("hands back a routable place for a picked address", async () => {
    mockedAddresses.mockResolvedValue([
      { lat: 44.98, lon: -93.25, displayName: "612, Washington Avenue, Minneapolis, Minnesota" },
    ])

    const onPick = renderPicker()
    type("washington")

    const row = await screen.findByText("612 Washington Avenue")
    fireEvent.mouseDown(row)

    const place = onPick.mock.calls[0][0] as ParkingSpot
    expect(place.latitude).toBe(44.98)
    expect(place.longitude).toBe(-93.25)
    // The parking fields have to be null, the same as a building, or the trip
    // details panel would show a price for a street corner.
    expect(place.parking_type).toBeNull()
    expect(place.cost).toBeNull()
  })

  // Nominatim allows roughly one request a second, so two characters must not
  // reach it. Our own endpoints are not held to that and answer from two.
  it("does not call the geocoder for a two character query", async () => {
    renderPicker()
    type("wa")

    await waitFor(() => expect(mockedSpots).toHaveBeenCalled())
    expect(mockedAddresses).not.toHaveBeenCalled()
  })

  it("still shows buildings and spots when the geocoder fails", async () => {
    mockedAddresses.mockRejectedValue(new Error("nominatim down"))
    mockedSpots.mockResolvedValue([
      {
        spot_id: 4,
        spot_name: "Church Street Garage",
        campus_location: "East Bank",
        parking_type: "Parking Garage",
        cost: 3,
        walk_time: null,
        near_buildings: null,
        address: null,
        latitude: 44.9745,
        longitude: -93.2355,
        is_verified: true,
        submitted_by: null,
        created_at: null,
      },
    ])

    renderPicker()
    type("church")

    expect(await screen.findByText("Church Street Garage")).toBeInTheDocument()
    expect(screen.queryByText("Addresses")).not.toBeInTheDocument()
  })
})
