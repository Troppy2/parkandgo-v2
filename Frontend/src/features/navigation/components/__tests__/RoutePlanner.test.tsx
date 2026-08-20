import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import RoutePlanner from "../RoutePlanner"
import { useNavStore } from "../../../../store/navStore"
import type { ParkingSpot } from "../../../../types/parking.types"

// The picker is exercised in its own right through useTripPlaceSearch; here it
// is stubbed so the planner's own behaviour, ordering and swapping, is what the
// assertions are about.
vi.mock("../PlacePicker", () => ({
  default: ({
    placeholder,
    onPick,
    onPickCurrentLocation,
  }: {
    placeholder: string
    onPick: (place: ParkingSpot) => void
    onPickCurrentLocation?: () => void
  }) => (
    <div>
      <button onClick={() => onPick(pickedPlace)}>{`pick:${placeholder}`}</button>
      {onPickCurrentLocation && (
        <button onClick={onPickCurrentLocation}>{`live:${placeholder}`}</button>
      )}
    </div>
  ),
}))

function makeSpot(overrides: Partial<ParkingSpot> = {}): ParkingSpot {
  return {
    spot_id: 1,
    spot_name: "Oak Street Ramp",
    campus_location: "East Bank",
    parking_type: "Parking Garage",
    cost: 2.5,
    walk_time: null,
    near_buildings: null,
    address: null,
    latitude: 44.974,
    longitude: -93.228,
    is_verified: true,
    submitted_by: null,
    created_at: null,
    ...overrides,
  }
}

const destination = makeSpot({ spot_id: 9, spot_name: "Coffman Memorial Union" })
const stopA = makeSpot({ spot_id: 2, spot_name: "Church Street Garage" })
const stopB = makeSpot({ spot_id: 3, spot_name: "Weisman Lot" })
const pickedPlace = makeSpot({ spot_id: 7, spot_name: "Picked Place" })

function renderPlanner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RoutePlanner />
    </QueryClientProvider>
  )
}

describe("RoutePlanner", () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState())
    useNavStore.getState().startNavigation(destination)
  })

  afterEach(cleanup)

  it("renders nothing without a destination", () => {
    useNavStore.setState(useNavStore.getInitialState())
    const { container } = renderPlanner()
    expect(container).toBeEmptyDOMElement()
  })

  it("shows Your location as the origin until one is chosen", () => {
    renderPlanner()
    expect(screen.getByText("Your location")).toBeInTheDocument()
    expect(screen.getByText("Coffman Memorial Union")).toBeInTheDocument()
  })

  it("adds a stop", () => {
    renderPlanner()
    fireEvent.click(screen.getByText("Add stop"))
    fireEvent.click(screen.getByText("pick:Search for a stop"))

    expect(useNavStore.getState().stops.map((s) => s.place.spot_id)).toEqual([7])
  })

  it("removes a stop from its options menu", () => {
    useNavStore.getState().addStop(stopA)
    renderPlanner()

    fireEvent.click(screen.getByLabelText("Options for Church Street Garage"))
    fireEvent.click(screen.getByText("Remove"))

    expect(useNavStore.getState().stops).toEqual([])
  })

  it("moves a stop down and back up", () => {
    useNavStore.getState().addStop(stopA)
    useNavStore.getState().addStop(stopB)
    renderPlanner()

    fireEvent.click(screen.getByLabelText("Options for Church Street Garage"))
    fireEvent.click(screen.getByText("Move down"))
    expect(useNavStore.getState().stops.map((s) => s.place.spot_id)).toEqual([3, 2])

    // The menu stays open on the stop that moved, so a second nudge does not
    // cost another tap to reopen it.
    fireEvent.click(screen.getByText("Move up"))
    expect(useNavStore.getState().stops.map((s) => s.place.spot_id)).toEqual([2, 3])
  })

  it("disables the move actions at the ends of the list", () => {
    useNavStore.getState().addStop(stopA)
    useNavStore.getState().addStop(stopB)
    renderPlanner()

    fireEvent.click(screen.getByLabelText("Options for Church Street Garage"))
    expect(screen.getByText("Move up").closest("button")).toBeDisabled()
    expect(screen.getByText("Move down").closest("button")).not.toBeDisabled()
  })

  // The spine used to be one fixed column of three glyphs beside a list that
  // grows, so at three stops the destination pin sat 132px above the row it
  // labelled. Each row owns its glyph now, which makes alignment structural
  // rather than a coincidence of row count.
  it("numbers every stop in order", () => {
    useNavStore.getState().addStop(stopA)
    useNavStore.getState().addStop(stopB)
    renderPlanner()

    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("keeps its controls at the 44px target the rest of the app holds to", () => {
    useNavStore.getState().addStop(stopA)
    renderPlanner()

    expect(
      screen.getByLabelText("Options for Church Street Garage").className
    ).toMatch(/w-11 h-11/)
    expect(screen.getByLabelText("Swap start and destination").className).toMatch(
      /w-11 h-11/
    )
  })

  it("collapses the stop list to keep the panel off the map", () => {
    useNavStore.getState().addStop(stopA)
    renderPlanner()

    expect(screen.getByText("Church Street Garage")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /1 stop/ }))

    expect(screen.queryByText("Church Street Garage")).not.toBeInTheDocument()
    // Collapsing hides the stops, not the trip: the endpoints stay put.
    expect(screen.getByText("Your location")).toBeInTheDocument()
    expect(screen.getByText("Coffman Memorial Union")).toBeInTheDocument()
  })

  it("disables the swap until there is a location to swap in", () => {
    renderPlanner()
    // Origin is "Your location" and no fix has arrived, so the destination slot
    // has no concrete point to receive.
    expect(screen.getByLabelText("Swap start and destination")).toBeDisabled()
  })

  it("swaps the endpoints once a location is known", () => {
    useNavStore.getState().setCurrentUserLocation({ coords: [-93.24, 44.97], heading: 0 })
    renderPlanner()

    fireEvent.click(screen.getByLabelText("Swap start and destination"))

    const state = useNavStore.getState()
    expect(state.origin?.spot_id).toBe(9)
    expect(state.destination?.spot_name).toBe("Your location")
  })

  it("sets an explicit origin, and can hand it back to live location", () => {
    renderPlanner()

    fireEvent.click(screen.getByText("Your location"))
    fireEvent.click(screen.getByText("pick:Choose a starting point"))
    expect(useNavStore.getState().origin?.spot_id).toBe(7)

    cleanup()
    renderPlanner()
    fireEvent.click(screen.getByText("Picked Place"))
    fireEvent.click(screen.getByText("live:Choose a starting point"))
    expect(useNavStore.getState().origin).toBeNull()
  })

  it("retargets the destination without dropping the stops", () => {
    useNavStore.getState().addStop(stopA)
    renderPlanner()

    fireEvent.click(screen.getByText("Coffman Memorial Union"))
    fireEvent.click(screen.getByText("pick:Choose a destination"))

    const state = useNavStore.getState()
    expect(state.destination?.spot_id).toBe(7)
    expect(state.stops).toHaveLength(1)
  })
})
