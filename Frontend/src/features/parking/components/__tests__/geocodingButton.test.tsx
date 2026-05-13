/**
 * Tests for the "Auto-fill coordinates" geocoding button in SuggestSpotModal.
 *
 * Strategy: mock geocodingService so tests are deterministic and offline.
 * The button should:
 *   - be visible when the modal is open and user is authenticated
 *   - populate the lat/lon fields on a successful geocode
 *   - show an error toast when geocoding fails
 *   - show a loading state while the request is in flight
 *   - be disabled when the address field is empty
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SuggestSpotModal from "../SuggestSpotModal"
import { useAuthStore } from "../../../../store/authStore"
import { useUIStore } from "../../../../store/uiStore"

// ── Mock the geocoding service ───────────────────────────
vi.mock("../../services/geocodingService", () => ({
  geocodeAddress: vi.fn(),
}))

import { geocodeAddress } from "../../services/geocodingService"
const mockGeocode = vi.mocked(geocodeAddress)

// ── Helpers ──────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function openModalAsAuthenticatedUser() {
  useAuthStore.getState().setAuth(
    // minimal User shape - only fields the modal reads
    { user_id: 1, email: "test@umn.edu", first_name: "Alex", last_name: "J", is_admin: false } as never,
    "fake-token",
    "fake-refresh"
  )
  useUIStore.setState({ ...useUIStore.getState(), suggestSpotOpen: true })
}

// ── Tests ─────────────────────────────────────────────────

describe("SuggestSpotModal - geocoding button", () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState())
    useAuthStore.getState().clearAuth()
    vi.clearAllMocks()
  })

  it("renders the auto-fill button when modal is open", () => {
    openModalAsAuthenticatedUser()
    render(<SuggestSpotModal />, { wrapper })
    expect(screen.getByRole("button", { name: /from address|address/i })).toBeInTheDocument()
  })

  it("populates lat and lon fields on successful geocode", async () => {
    mockGeocode.mockResolvedValueOnce({ lat: 44.974, lon: -93.2277, displayName: "Oak St, Minneapolis" })

    openModalAsAuthenticatedUser()
    render(<SuggestSpotModal />, { wrapper })

    // Type an address
    fireEvent.change(screen.getByPlaceholderText(/500 Oak St/i), {
      target: { value: "500 Oak St SE, Minneapolis" },
    })

    fireEvent.click(screen.getByRole("button", { name: /from address|address/i }))

    await waitFor(() => {
      const latInput = screen.getByPlaceholderText(/44\.9740/i) as HTMLInputElement
      const lonInput = screen.getByPlaceholderText(/-93\.2277/i) as HTMLInputElement
      expect(latInput.value).toBe("44.974")
      expect(lonInput.value).toBe("-93.2277")
    })
  })

  it("passes the typed address to the geocoding service", async () => {
    mockGeocode.mockResolvedValueOnce({ lat: 44.974, lon: -93.2277, displayName: "Oak St" })

    openModalAsAuthenticatedUser()
    render(<SuggestSpotModal />, { wrapper })

    fireEvent.change(screen.getByPlaceholderText(/500 Oak St/i), {
      target: { value: "200 Union St SE, Minneapolis" },
    })
    fireEvent.click(screen.getByRole("button", { name: /from address|address/i }))

    await waitFor(() => {
      expect(mockGeocode).toHaveBeenCalledWith("200 Union St SE, Minneapolis")
    })
  })

  it("shows an error toast when geocoding fails", async () => {
    mockGeocode.mockRejectedValueOnce(new Error("No location found for that address"))

    const showToast = vi.fn()
    openModalAsAuthenticatedUser()
    useUIStore.setState({ ...useUIStore.getState(), showToast })

    render(<SuggestSpotModal />, { wrapper })

    fireEvent.change(screen.getByPlaceholderText(/500 Oak St/i), {
      target: { value: "Nonexistent Street XYZ" },
    })
    fireEvent.click(screen.getByRole("button", { name: /from address|address/i }))

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/could not find|no location|geocod/i),
        "error"
      )
    })
  })

  it("is disabled when address field is empty", () => {
    openModalAsAuthenticatedUser()
    render(<SuggestSpotModal />, { wrapper })

    const btn = screen.getByRole("button", { name: /from address|address/i })
    expect(btn).toBeDisabled()
  })

  it("does not call geocoding service when address is empty", async () => {
    openModalAsAuthenticatedUser()
    render(<SuggestSpotModal />, { wrapper })

    fireEvent.click(screen.getByRole("button", { name: /from address|address/i }))

    expect(mockGeocode).not.toHaveBeenCalled()
  })
})
