import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import RouteDisplay from "../RouteDisplay"
import { useNavStore } from "../../../../store/navStore"
import type { ParkingSpot } from "../../../../types/parking.types"

const fakeSpot: ParkingSpot = {
  spot_id: 1,
  spot_name: "East River Road",
  campus_location: "East Bank",
  parking_type: "Street Parking",
  cost: 1.5,
  walk_time: "10 min walk",
  near_buildings: "Science Library",
  address: "123 East River Road",
  latitude: 44.975,
  longitude: -93.22,
  is_verified: true,
  submitted_by: null,
  created_at: null,
}

function createPosition(longitude: number, latitude: number, heading = 0): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading,
      speed: null,
      toJSON() {
        return {
          latitude: this.latitude,
          longitude: this.longitude,
          accuracy: this.accuracy,
          altitude: this.altitude,
          altitudeAccuracy: this.altitudeAccuracy,
          heading: this.heading,
          speed: this.speed,
        }
      },
    } as GeolocationCoordinates,
    timestamp: Date.now(),
    toJSON() {
      return {
        coords: this.coords.toJSON(),
        timestamp: this.timestamp,
      }
    },
  }
}

describe("RouteDisplay", () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState())
  })

  it("starts immediately when a watched location already exists", () => {
    useNavStore.setState({
      isNavigating: true,
      destination: fakeSpot,
      currentUserLocation: { coords: [-93.2277, 44.974], heading: 0 },
    })

    render(<RouteDisplay />)

    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    const state = useNavStore.getState()
    expect(state.hasStartedNavigation).toBe(true)
    expect(state.routeStatus).toBe("loading")
  })

  it("requests geolocation from the Start click before beginning navigation", async () => {
    const getCurrentPositionMock = vi.fn((success: PositionCallback) => {
      success(createPosition(-93.2261, 44.9734))
    })

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: getCurrentPositionMock },
    })

    useNavStore.setState({
      isNavigating: true,
      destination: fakeSpot,
    })

    render(<RouteDisplay />)

    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    expect(getCurrentPositionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 30000,
      }
    )

    await waitFor(() => {
      const state = useNavStore.getState()
      expect(state.hasStartedNavigation).toBe(true)
      expect(state.currentUserLocation?.coords).toEqual([-93.2261, 44.9734])
    })
  })

  it("shows an immediate route error when Start cannot get location", async () => {
    const getCurrentPositionMock = vi.fn((_: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: "Permission denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError)
    })

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: getCurrentPositionMock },
    })

    useNavStore.setState({
      isNavigating: true,
      destination: fakeSpot,
    })

    render(<RouteDisplay />)

    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    await waitFor(() => {
      const state = useNavStore.getState()
      expect(state.hasStartedNavigation).toBe(true)
      expect(state.routeStatus).toBe("error")
      expect(state.routeError).toContain("couldn't get your location")
    })
  })
})
