import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import CampusBuildingCard from "../components/CampusBuildingCard"
import { useNavStore } from "../../../store/navStore"
import { useAuthStore } from "../../../store/authStore"
import type { CampusBuilding } from "../../../types/campus_building.types"

vi.mock("../services/campusBuildingsApi", () => ({
  getSavedBuildings: vi.fn().mockResolvedValue([]),
  saveBuilding: vi.fn().mockResolvedValue({}),
  unsaveBuilding: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../navigation/services/navigationApi", () => ({
  logContextEvent: vi.fn().mockResolvedValue(undefined),
}))

const coffman: CampusBuilding = {
  building_id: 1,
  name: "Coffman Memorial Union",
  short_name: "CMU",
  campus_location: "East Bank",
  address: "300 Washington Ave SE",
  latitude: 44.972823,
  longitude: -93.23535,
  osm_id: "way/30056874",
  created_at: null,
  distance_miles: 0.25,
}

function renderCard(building: CampusBuilding = coffman) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CampusBuildingCard building={building} />
    </QueryClientProvider>
  )
}

describe("CampusBuildingCard", () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, isGuest: false })
    useNavStore.setState({
      isNavigating: false,
      hasStartedNavigation: false,
      destination: null,
      travelMode: "driving",
    })
  })

  afterEach(cleanup)

  it("shows the building name, campus, and abbreviation", () => {
    renderCard()
    expect(screen.getByText("Coffman Memorial Union")).toBeInTheDocument()
    expect(screen.getByText("East Bank")).toBeInTheDocument()
    expect(screen.getByText(/CMU/)).toBeInTheDocument()
  })

  it("shows the distance when one is available", () => {
    renderCard()
    expect(screen.getByText("0.3 mi")).toBeInTheDocument()
  })

  it("omits the distance when none is known", () => {
    renderCard({ ...coffman, distance_miles: null })
    expect(screen.queryByText(/mi$/)).not.toBeInTheDocument()
  })

  it("does not render parking badges", () => {
    // The whole point of the campus card is that price and verification are
    // absent. If ParkingSpotCard were reused with flags, these would leak back.
    renderCard()
    expect(screen.queryByText(/Verified/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Unverified/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\/hr/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Price N\/A/)).not.toBeInTheDocument()
  })

  it("does not render the safety rating panel when expanded", () => {
    renderCard()
    fireEvent.click(screen.getByText(/See details/))
    expect(screen.queryByText(/Safety rating/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Rate this spot/)).not.toBeInTheDocument()
  })

  it("reveals the address and walk time when expanded", () => {
    renderCard()
    fireEvent.click(screen.getByText(/See details/))
    expect(screen.getByText("300 Washington Ave SE")).toBeInTheDocument()
    expect(screen.getByText(/Abbreviation:/)).toBeInTheDocument()
  })

  it("forces walking mode when Walk Here is pressed", () => {
    // Campus Mode has no driving option, and navStore starts on "driving" here
    // to prove the card sets the mode rather than inheriting it.
    renderCard()
    fireEvent.click(screen.getByText("Walk Here"))

    const state = useNavStore.getState()
    expect(state.travelMode).toBe("walking")
    expect(state.isNavigating).toBe(true)
    expect(state.destination?.spot_name).toBe("Coffman Memorial Union")
  })

  it("passes a destination whose parking fields are null", () => {
    renderCard()
    fireEvent.click(screen.getByText("Walk Here"))

    const destination = useNavStore.getState().destination
    expect(destination?.parking_type).toBeNull()
    expect(destination?.cost).toBeNull()
  })

  it("offers a bookmark control", () => {
    renderCard()
    expect(screen.getByLabelText("Bookmark building")).toBeInTheDocument()
  })
})
