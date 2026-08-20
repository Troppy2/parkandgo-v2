import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import SearchBar from "../SearchBar"
import { useNavStore } from "../../../../store/navStore"
import { useUIStore } from "../../../../store/uiStore"
import { searchSpots } from "../../services/searchApi"
import { searchCampusBuildings } from "../../../campus/services/campusBuildingsApi"
import type { CampusBuilding } from "../../../../types/campus_building.types"
import type { ParkingSpot } from "../../../../types/parking.types"

vi.mock("../../services/searchApi", () => ({
  searchSpots: vi.fn().mockResolvedValue([]),
}))

vi.mock("../../../campus/services/campusBuildingsApi", () => ({
  searchCampusBuildings: vi.fn().mockResolvedValue([]),
}))

vi.mock("../../../navigation/services/navigationApi", () => ({
  logContextEvent: vi.fn().mockResolvedValue(undefined),
}))

const mockedSearchSpots = vi.mocked(searchSpots)
const mockedSearchBuildings = vi.mocked(searchCampusBuildings)

function makeBuilding(overrides: Partial<CampusBuilding> = {}): CampusBuilding {
  return {
    building_id: 1,
    name: "Coffman Memorial Union",
    short_name: "CMU",
    campus_location: "East Bank",
    address: "300 Washington Ave SE",
    latitude: 44.972823,
    longitude: -93.23535,
    osm_id: "way/30056874",
    created_at: null,
    distance_miles: null,
    ...overrides,
  }
}

function makeSpot(overrides: Partial<ParkingSpot> = {}): ParkingSpot {
  return {
    spot_id: 10,
    spot_name: "Church Street Garage",
    campus_location: "East Bank",
    parking_type: "Garage",
    latitude: 44.9745,
    longitude: -93.2355,
    cost: 5,
    ...overrides,
  } as ParkingSpot
}

function renderBar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SearchBar />
    </QueryClientProvider>
  )
}

// Focus the input and type enough characters to clear the two character gate,
// then wait for both debounced queries to resolve.
async function search(term = "coffman") {
  const input = screen.getByPlaceholderText(/Search buildings and parking/)
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: term } })
  return input
}

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUIStore.setState({ appMode: "parking", directionsOnly: false })
    // travelMode starts on "driving" so the building cases prove the component
    // sets walking rather than inheriting it.
    useNavStore.setState({
      isNavigating: false,
      hasStartedNavigation: false,
      destination: null,
      travelMode: "driving",
    })
    mockedSearchSpots.mockResolvedValue([])
    mockedSearchBuildings.mockResolvedValue([])
  })

  afterEach(cleanup)

  it("puts Buildings above Parking in campus mode", async () => {
    useUIStore.setState({ appMode: "campus" })
    mockedSearchBuildings.mockResolvedValue([makeBuilding()])
    mockedSearchSpots.mockResolvedValue([makeSpot()])

    renderBar()
    await search()

    await waitFor(() => expect(screen.getByText("Buildings")).toBeInTheDocument())
    const headings = screen.getAllByText(/^(Buildings|Parking)$/).map((el) => el.textContent)
    expect(headings).toEqual(["Buildings", "Parking"])
  })

  it("puts Parking above Buildings in parking mode", async () => {
    mockedSearchBuildings.mockResolvedValue([makeBuilding()])
    mockedSearchSpots.mockResolvedValue([makeSpot()])

    renderBar()
    await search()

    await waitFor(() => expect(screen.getByText("Buildings")).toBeInTheDocument())
    const headings = screen.getAllByText(/^(Buildings|Parking)$/).map((el) => el.textContent)
    expect(headings).toEqual(["Parking", "Buildings"])
  })

  it("starts walking directions when a building is picked", async () => {
    mockedSearchBuildings.mockResolvedValue([makeBuilding()])

    renderBar()
    await search()

    const row = await screen.findByText("Coffman Memorial Union")
    fireEvent.mouseDown(row)

    const state = useNavStore.getState()
    expect(state.travelMode).toBe("walking")
    expect(state.isNavigating).toBe(true)
    expect(state.destination?.spot_name).toBe("Coffman Memorial Union")
  })

  it("forces walking for a building even in parking mode", async () => {
    // A building is somewhere you walk into regardless of app mode, and in
    // parking mode nothing downstream would override a driving route.
    useUIStore.setState({ appMode: "parking" })
    mockedSearchBuildings.mockResolvedValue([makeBuilding()])

    renderBar()
    await search()

    fireEvent.mouseDown(await screen.findByText("Coffman Memorial Union"))
    expect(useNavStore.getState().travelMode).toBe("walking")
  })

  it("passes a building destination whose parking fields are null", async () => {
    // Proves the destination came from buildingToParkingSpot rather than being
    // assembled inline.
    mockedSearchBuildings.mockResolvedValue([makeBuilding()])

    renderBar()
    await search()

    fireEvent.mouseDown(await screen.findByText("Coffman Memorial Union"))

    const destination = useNavStore.getState().destination
    expect(destination?.parking_type).toBeNull()
    expect(destination?.cost).toBeNull()
  })

  it("still starts navigation when a parking spot is picked", async () => {
    mockedSearchSpots.mockResolvedValue([makeSpot()])

    renderBar()
    await search()

    const row = await screen.findByText("Church Street Garage")
    fireEvent.mouseDown(row)

    const state = useNavStore.getState()
    expect(state.isNavigating).toBe(true)
    expect(state.destination?.spot_name).toBe("Church Street Garage")
  })

  it("omits the header for a section with no results", async () => {
    mockedSearchBuildings.mockResolvedValue([makeBuilding()])

    renderBar()
    await search()

    await waitFor(() => expect(screen.getByText("Buildings")).toBeInTheDocument())
    expect(screen.queryByText("Parking")).not.toBeInTheDocument()
  })

  it("caps each section at five rows", async () => {
    mockedSearchBuildings.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) =>
        makeBuilding({ building_id: i + 1, name: `Building ${i + 1}` })
      )
    )

    renderBar()
    await search()

    await waitFor(() => expect(screen.getByText("Building 1")).toBeInTheDocument())
    expect(screen.queryByText("Building 6")).not.toBeInTheDocument()
  })

  it("shows the abbreviation and campus for a building", async () => {
    mockedSearchBuildings.mockResolvedValue([makeBuilding()])

    renderBar()
    await search()

    expect(await screen.findByText("CMU · East Bank")).toBeInTheDocument()
  })

  it("drops the separator when a building has no abbreviation", async () => {
    mockedSearchBuildings.mockResolvedValue([makeBuilding({ short_name: null })])

    renderBar()
    await search()

    expect(await screen.findByText("East Bank")).toBeInTheDocument()
    expect(screen.queryByText(/^ · /)).not.toBeInTheDocument()
  })

  it("does not query buildings for a single character", async () => {
    renderBar()
    const input = screen.getByPlaceholderText(/Search buildings and parking/)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "c" } })

    await waitFor(() => expect(mockedSearchBuildings).not.toHaveBeenCalled(), {
      timeout: 600,
    })
  })

  it("reports an empty dropdown when neither source matches", async () => {
    renderBar()
    await search()

    expect(await screen.findByText(/No results for "coffman"/)).toBeInTheDocument()
  })
})
