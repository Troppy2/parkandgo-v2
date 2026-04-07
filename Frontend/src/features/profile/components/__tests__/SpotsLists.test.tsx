import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import PrivateSpotsList from "../PrivateSpotsList"
import SavedSpotsList from "../SavedSpotsList"
import * as privateSpotsApi from "../../services/privateSpotsApi"
import * as profileApi from "../../services/profileApi"
import { geocodeAddress } from "../../../parking/services/geocodingService"
import { useAuthStore } from "../../../../store/authStore"
import { useNavStore } from "../../../../store/navStore"
import type { PrivateSpot } from "../../../../types/private_spot.types"
import type { SavedSpot } from "../../../../types/saved_spot.types"

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

vi.mock("../../services/privateSpotsApi", () => ({
  getPrivateSpots: vi.fn(),
  createPrivateSpot: vi.fn(),
  updatePrivateSpot: vi.fn(),
  deletePrivateSpot: vi.fn(),
}))

vi.mock("../../services/profileApi", () => ({
  getSavedSpots: vi.fn(),
  unsaveSpot: vi.fn(),
  renameSpot: vi.fn(),
}))

vi.mock("../../../parking/services/geocodingService", () => ({
  geocodeAddress: vi.fn(),
}))

const privateSpotFixture: PrivateSpot = {
  private_spot_id: 14,
  user_id: 9,
  name: "Apartment Garage",
  latitude: 44.9822,
  longitude: -93.2355,
  notes: "Level 2, near elevator",
  is_default: true,
  created_at: null,
  updated_at: null,
}

const savedSpotFixture: SavedSpot = {
  id: 22,
  user_id: 9,
  spot_id: 3,
  custom_name: "Class days",
  created_at: null,
  spot: {
    spot_id: 3,
    spot_name: "Church Street Garage",
    campus_location: "East Bank",
    parking_type: "Parking Garage",
    cost: 2,
    walk_time: "3 min",
    near_buildings: "Anderson Hall",
    address: "80 Church St SE",
    latitude: 44.9763,
    longitude: -93.2343,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
}

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe("Profile parking spot lists", () => {
  const getPrivateSpotsMock = vi.mocked(privateSpotsApi.getPrivateSpots)
  const createPrivateSpotMock = vi.mocked(privateSpotsApi.createPrivateSpot)
  const updatePrivateSpotMock = vi.mocked(privateSpotsApi.updatePrivateSpot)
  const deletePrivateSpotMock = vi.mocked(privateSpotsApi.deletePrivateSpot)

  const getSavedSpotsMock = vi.mocked(profileApi.getSavedSpots)
  const unsaveSpotMock = vi.mocked(profileApi.unsaveSpot)
  const renameSpotMock = vi.mocked(profileApi.renameSpot)
  const geocodeAddressMock = vi.mocked(geocodeAddress)

  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState())
    useNavStore.setState(useNavStore.getInitialState())
    useAuthStore.setState({ isAuthenticated: true, isReady: true })

    getPrivateSpotsMock.mockReset()
    createPrivateSpotMock.mockReset()
    updatePrivateSpotMock.mockReset()
    deletePrivateSpotMock.mockReset()

    getSavedSpotsMock.mockReset()
    unsaveSpotMock.mockReset()
    renameSpotMock.mockReset()
    geocodeAddressMock.mockReset()

    updatePrivateSpotMock.mockResolvedValue(privateSpotFixture)
    deletePrivateSpotMock.mockResolvedValue(undefined)
    unsaveSpotMock.mockResolvedValue(undefined)
    renameSpotMock.mockResolvedValue(savedSpotFixture)
    geocodeAddressMock.mockResolvedValue({
      lat: 44.974,
      lon: -93.2277,
      displayName: "UMN Campus",
    })
  })

  it("renders private spots and starts navigation from My Spots", async () => {
    getPrivateSpotsMock.mockResolvedValue([privateSpotFixture])
    createPrivateSpotMock.mockResolvedValue(privateSpotFixture)

    renderWithQuery(<PrivateSpotsList />)

    expect(await screen.findByText("Apartment Garage")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Navigate" }))

    const nav = useNavStore.getState()
    expect(nav.isNavigating).toBe(true)
    expect(nav.destination?.spot_id).toBe(14)
    expect(nav.destination?.latitude).toBe(44.9822)
    expect(nav.destination?.longitude).toBe(-93.2355)
  })

  it("shows a clear loading state in My Spots while data is being fetched", async () => {
    const deferred = createDeferred<PrivateSpot[]>()
    getPrivateSpotsMock.mockReturnValueOnce(deferred.promise)

    renderWithQuery(<PrivateSpotsList />)

    expect(await screen.findByText("My Spots")).toBeInTheDocument()
    expect(screen.getByText(/Loading your spots/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Special Parking Spot" })).toBeInTheDocument()

    deferred.resolve([])
    expect(await screen.findByText(/No special spots yet/i)).toBeInTheDocument()
  })

  it("keeps Add Special Parking Spot available while loading so users can still start add flow", async () => {
    const deferred = createDeferred<PrivateSpot[]>()
    getPrivateSpotsMock.mockReturnValueOnce(deferred.promise)

    renderWithQuery(<PrivateSpotsList />)

    fireEvent.click(await screen.findByRole("button", { name: "Add Special Parking Spot" }))
    expect(screen.getByRole("dialog", { name: "Add Special Parking Spot" })).toBeInTheDocument()

    deferred.resolve([])
  })

  it("notifies parent when special-spot modal opens and closes", async () => {
    getPrivateSpotsMock.mockResolvedValue([])
    const onFormOpenChange = vi.fn()

    renderWithQuery(<PrivateSpotsList onFormOpenChange={onFormOpenChange} />)

    fireEvent.click(await screen.findByRole("button", { name: "Add Special Parking Spot" }))
    expect(screen.getByRole("dialog", { name: "Add Special Parking Spot" })).toBeInTheDocument()

    await waitFor(() => {
      expect(onFormOpenChange).toHaveBeenCalledWith(true)
    })

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    await waitFor(() => {
      expect(onFormOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("shows a graceful retry state instead of a hard-dead-end when My Spots fetch fails", async () => {
    const apiError = new Error("Backend temporarily unavailable")
    getPrivateSpotsMock
      .mockRejectedValueOnce(apiError)
      .mockRejectedValueOnce(apiError)
      .mockResolvedValueOnce([])

    renderWithQuery(<PrivateSpotsList />)

    expect(await screen.findByRole("button", { name: "Retry" }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText("My Spots are temporarily unavailable.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Special Parking Spot" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(getPrivateSpotsMock).toHaveBeenCalledTimes(3)
    })

    expect(await screen.findByText(/No special spots yet/i)).toBeInTheDocument()
  })

  it("renders Add Special Parking Spot CTA and keeps the form out of inline layout", async () => {
    getPrivateSpotsMock.mockResolvedValue([])

    renderWithQuery(<PrivateSpotsList />)

    await screen.findByText("My Spots")
    expect(screen.getByRole("button", { name: "Add Special Parking Spot" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Spot name")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Add Special Parking Spot" })).not.toBeInTheDocument()
  })

  it("opens modal and creates a private spot with address geocode autofill", async () => {
    getPrivateSpotsMock.mockResolvedValue([])
    createPrivateSpotMock.mockResolvedValue({
      ...privateSpotFixture,
      private_spot_id: 18,
      name: "Home driveway",
      latitude: 44.981,
      longitude: -93.241,
      is_default: false,
      notes: null,
    })

    renderWithQuery(<PrivateSpotsList />)

    fireEvent.click(await screen.findByRole("button", { name: "Add Special Parking Spot" }))

    expect(screen.getByRole("dialog", { name: "Add Special Parking Spot" })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Spot name"), {
      target: { value: "Home driveway" },
    })
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "500 Oak St SE, Minneapolis" },
    })

    geocodeAddressMock.mockResolvedValueOnce({
      lat: 44.981,
      lon: -93.241,
      displayName: "500 Oak St SE",
    })

    const latitudeInput = screen.getByLabelText("Latitude") as HTMLInputElement

    fireEvent.click(screen.getByRole("button", { name: "Autofill from address" }))

    await waitFor(() => {
      expect(latitudeInput.value).toBe("44.981")
    })

    fireEvent.click(screen.getByRole("button", { name: "Add spot" }))

    await waitFor(() => {
      expect(createPrivateSpotMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Home driveway",
          latitude: 44.981,
          longitude: -93.241,
          is_default: false,
        })
      )
    })
  })

  it("creates a private spot from manual latitude/longitude entry", async () => {
    getPrivateSpotsMock.mockResolvedValue([])
    createPrivateSpotMock.mockResolvedValue({
      ...privateSpotFixture,
      private_spot_id: 20,
      name: "Manual spot",
      latitude: 44.95,
      longitude: -93.2,
      is_default: false,
      notes: null,
    })

    renderWithQuery(<PrivateSpotsList />)

    fireEvent.click(await screen.findByRole("button", { name: "Add Special Parking Spot" }))

    fireEvent.change(screen.getByLabelText("Spot name"), {
      target: { value: "Manual spot" },
    })
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "Custom address" },
    })
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "44.95" },
    })
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "-93.2" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Add spot" }))

    await waitFor(() => {
      expect(createPrivateSpotMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Manual spot",
          latitude: 44.95,
          longitude: -93.2,
          is_default: false,
        })
      )
    })
  })

  it("renders saved public spots and starts navigation from the saved list", async () => {
    getSavedSpotsMock.mockResolvedValue([savedSpotFixture])

    renderWithQuery(<SavedSpotsList />)

    expect(await screen.findByText("Class days")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Class days/i }))

    const nav = useNavStore.getState()
    expect(nav.isNavigating).toBe(true)
    expect(nav.destination?.spot_id).toBe(3)
    expect(nav.destination?.spot_name).toBe("Church Street Garage")
  })

  it("pins default private spots at the top of My Spots", async () => {
    getPrivateSpotsMock.mockResolvedValue([
      {
        ...privateSpotFixture,
        private_spot_id: 20,
        name: "Later spot",
        is_default: false,
      },
      {
        ...privateSpotFixture,
        private_spot_id: 21,
        name: "Pinned default",
        is_default: true,
      },
    ])

    renderWithQuery(<PrivateSpotsList />)

    expect(await screen.findByText("Pinned default")).toBeInTheDocument()

    const renderedNames = screen
      .getAllByText(/Pinned default|Later spot/)
      .map((node) => node.textContent)

    expect(renderedNames[0]).toBe("Pinned default")
  })
})
