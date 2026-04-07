import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import RememberParkingSpotModal from "../RememberParkingSpotModal"
import * as privateSpotsApi from "../../../profile/services/privateSpotsApi"
import * as reminderScheduler from "../../services/parkingReminderScheduler"
import { useAuthStore } from "../../../../store/authStore"
import { useNavStore } from "../../../../store/navStore"
import type { ParkingSpot } from "../../../../types/parking.types"

vi.mock("../../../profile/services/privateSpotsApi", () => ({
  createPrivateSpot: vi.fn(),
}))

vi.mock("../../services/parkingReminderScheduler", () => ({
  scheduleParkingReminder: vi.fn(),
  initializeParkingReminderScheduler: vi.fn(),
}))

const arrivedSpot: ParkingSpot = {
  spot_id: 10,
  spot_name: "Oak Street Ramp",
  campus_location: "East Bank",
  parking_type: "Parking Garage",
  cost: 2.5,
  walk_time: "5 min",
  near_buildings: "Coffman",
  address: "401 SE Oak St",
  latitude: 44.9739,
  longitude: -93.2312,
  is_verified: true,
  submitted_by: null,
  created_at: null,
}

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RememberParkingSpotModal />
    </QueryClientProvider>
  )
}

describe("RememberParkingSpotModal", () => {
  const createPrivateSpotMock = vi.mocked(privateSpotsApi.createPrivateSpot)
  const scheduleReminderMock = vi.mocked(reminderScheduler.scheduleParkingReminder)

  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState())
    useNavStore.setState(useNavStore.getInitialState())

    useAuthStore.setState({ isAuthenticated: true, isReady: true })
    useNavStore.setState({
      arrivalRememberPromptOpen: true,
      arrivalRememberSpot: arrivedSpot,
      currentUserLocation: { coords: [-93.2299, 44.9722], heading: 0 },
    })

    createPrivateSpotMock.mockReset()
    scheduleReminderMock.mockReset()

    scheduleReminderMock.mockResolvedValue("scheduled")
  })

  it("saves the arrived parking spot and schedules the 2-hour reminder", async () => {
    createPrivateSpotMock.mockResolvedValue({
      private_spot_id: 77,
      user_id: 2,
      name: "Parked near Oak Street Ramp",
      latitude: 44.9722,
      longitude: -93.2299,
      notes: "Saved from arrival prompt",
      is_default: true,
      created_at: null,
      updated_at: null,
    })

    renderModal()

    fireEvent.click(screen.getByRole("button", { name: "Yes, remember it" }))

    await waitFor(() => {
      expect(createPrivateSpotMock).toHaveBeenCalledWith({
        name: "Parked near Oak Street Ramp",
        latitude: 44.9722,
        longitude: -93.2299,
        notes: "Saved from arrival prompt via GPS",
        is_default: true,
      })
    })

    await waitFor(() => {
      expect(scheduleReminderMock).toHaveBeenCalledWith("Parked near Oak Street Ramp")
    })

    await waitFor(() => {
      const state = useNavStore.getState()
      expect(state.arrivalRememberPromptOpen).toBe(false)
      expect(state.rememberedSpot?.spot_id).toBe(77)
    })
  })

  it("closes without saving when user clicks Not now", () => {
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: "Not now" }))

    const state = useNavStore.getState()
    expect(state.arrivalRememberPromptOpen).toBe(false)
    expect(createPrivateSpotMock).not.toHaveBeenCalled()
  })
})
