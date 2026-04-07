import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useActiveNavigation } from "../useActiveNavigation"
import { useNavStore } from "../../../../store/navStore"
import type { ParkingSpot } from "../../../../types/parking.types"

const destination: ParkingSpot = {
  spot_id: 42,
  spot_name: "Destination Ramp",
  campus_location: "East Bank",
  parking_type: "Parking Garage",
  cost: 3,
  walk_time: "4 min",
  near_buildings: "Bruininks",
  address: "123 Test",
  latitude: 44.975,
  longitude: -93.227,
  is_verified: true,
  submitted_by: null,
  created_at: null,
}

function HookHarness() {
  useActiveNavigation()
  return null
}

describe("useActiveNavigation", () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState())
  })

  it("auto-ends navigation and opens remember prompt when user arrives", async () => {
    useNavStore.setState({
      isNavigating: true,
      hasStartedNavigation: true,
      destination,
      currentUserLocation: { coords: [-93.227, 44.975], heading: 0 },
    })

    render(<HookHarness />)

    await waitFor(() => {
      const state = useNavStore.getState()
      expect(state.isNavigating).toBe(false)
      expect(state.arrivalRememberPromptOpen).toBe(true)
      expect(state.arrivalRememberSpot?.spot_id).toBe(42)
    })
  })

  it("does not end navigation when user is not near arrival", async () => {
    useNavStore.setState({
      isNavigating: true,
      hasStartedNavigation: true,
      destination,
      currentUserLocation: { coords: [-93.24, 44.96], heading: 0 },
    })

    render(<HookHarness />)

    await waitFor(() => {
      const state = useNavStore.getState()
      expect(state.isNavigating).toBe(true)
      expect(state.arrivalRememberPromptOpen).toBe(false)
    })
  })
})
