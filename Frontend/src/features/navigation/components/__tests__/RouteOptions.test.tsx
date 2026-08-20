import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import RouteOptions from "../RouteOptions"
import { useNavStore } from "../../../../store/navStore"
import type { RouteResult } from "../services/routingApi"

function makeRoute(durationSeconds: number, distanceMeters: number): RouteResult {
  return {
    coordinates: [
      [-93.2277, 44.974],
      [-93.22, 44.975],
    ],
    steps: [],
    totalDistanceMeters: distanceMeters,
    totalDurationSeconds: durationSeconds,
    source: "network",
    notice: null,
  }
}

const fastest = makeRoute(600, 1600)
const scenic = makeRoute(900, 2100)

describe("RouteOptions", () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState())
  })

  afterEach(cleanup)

  it("renders nothing when there is no route", () => {
    const { container } = render(<RouteOptions />)
    expect(container).toBeEmptyDOMElement()
  })

  // A single card labelled "Best route" is a label pretending to be a control.
  // This is the normal case on foot, where OSRM usually returns one route.
  it("renders nothing when the router offered only one route", () => {
    useNavStore.getState().setRouteOptions([fastest])
    const { container } = render(<RouteOptions />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows a card per option with its time and distance", () => {
    useNavStore.getState().setRouteOptions([fastest, scenic])
    render(<RouteOptions />)

    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("15")).toBeInTheDocument()
    expect(screen.getByText(/1\.0 mi/)).toBeInTheDocument()
    expect(screen.getByText(/1\.3 mi · \+5 min/)).toBeInTheDocument()
  })

  it("marks the quickest option and preselects it", () => {
    useNavStore.getState().setRouteOptions([fastest, scenic])
    render(<RouteOptions />)

    expect(screen.getByText("Fastest")).toBeInTheDocument()
    const [first, second] = screen.getAllByRole("radio")
    expect(first).toHaveAttribute("aria-checked", "true")
    expect(second).toHaveAttribute("aria-checked", "false")
  })

  it("switches the drawn route when another option is picked", () => {
    useNavStore.getState().setRouteOptions([fastest, scenic])
    render(<RouteOptions />)

    fireEvent.click(screen.getAllByRole("radio")[1])

    const state = useNavStore.getState()
    expect(state.selectedRouteIndex).toBe(1)
    expect(state.route).toEqual(scenic)
  })

  it("moves the stat tiles onto the option that was picked", () => {
    // The tiles sit directly above these cards, so leaving them describing the
    // previous option would put two different answers on screen at once.
    useNavStore.getState().setRouteOptions([fastest, scenic])
    render(<RouteOptions />)

    fireEvent.click(screen.getAllByRole("radio")[1])

    expect(useNavStore.getState().etaMinutes).toBe(15)
    expect(useNavStore.getState().distanceRemainingMiles).toBeCloseTo(2100 / 1609.34, 3)
  })

  it("does not refetch to switch options", () => {
    // Every option arrived in one response, so choosing between them is local.
    useNavStore.getState().setRouteOptions([fastest, scenic])
    const before = useNavStore.getState().routeRequestId
    render(<RouteOptions />)

    fireEvent.click(screen.getAllByRole("radio")[1])

    expect(useNavStore.getState().routeRequestId).toBe(before)
    expect(useNavStore.getState().routeStatus).toBe("ready")
  })
})
