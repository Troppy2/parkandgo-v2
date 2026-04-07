/**
 * Tests for the "Auto-fill coordinates" geocoding button in the admin SpotForm.
 *
 * SpotForm is used for both create and edit flows in SpotManagement.
 * The button should behave identically to the one in SuggestSpotModal:
 *   - visible in the form
 *   - disabled when address is empty
 *   - fills lat/lon on success
 *   - shows error toast on failure (via onError callback)
 *   - calls the geocoding service with the current address value
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SpotForm from "../SpotForm"

// ── Mock geocoding service ───────────────────────────────
vi.mock("../../../parking/services/geocodingService", () => ({
  geocodeAddress: vi.fn(),
}))

import { geocodeAddress } from "../../../parking/services/geocodingService"
const mockGeocode = vi.mocked(geocodeAddress)

// ── Helpers ──────────────────────────────────────────────

const noop = () => {}

function renderCreateForm() {
  return render(
    <SpotForm onSubmit={noop} onCancel={noop} isPending={false} />
  )
}

function renderEditForm() {
  return render(
    <SpotForm
      initialValues={{
        spot_id: 1,
        spot_name: "Oak Street Ramp",
        address: "500 Oak St SE, Minneapolis",
        campus_location: "East Bank",
        parking_type: "Parking Garage",
        cost: 1.50,
        walk_time: "5 min walk",
        near_buildings: "Keller Hall",
        latitude: 44.974,
        longitude: -93.2277,
        is_verified: true,
        submitted_by: null,
        created_at: null,
      }}
      onSubmit={noop}
      onCancel={noop}
      isPending={false}
    />
  )
}

// ── Tests ─────────────────────────────────────────────────

describe("SpotForm — geocoding button", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the auto-fill button in create mode", () => {
    renderCreateForm()
    expect(screen.getByRole("button", { name: /auto.?fill/i })).toBeInTheDocument()
  })

  it("renders the auto-fill button in edit mode", () => {
    renderEditForm()
    expect(screen.getByRole("button", { name: /auto.?fill/i })).toBeInTheDocument()
  })

  it("is disabled when address field is empty (create mode)", () => {
    renderCreateForm()
    expect(screen.getByRole("button", { name: /auto.?fill/i })).toBeDisabled()
  })

  it("is enabled when address field has content", () => {
    renderCreateForm()
    fireEvent.change(screen.getByPlaceholderText(/500 Oak St/i), {
      target: { value: "200 Union St SE" },
    })
    expect(screen.getByRole("button", { name: /auto.?fill/i })).not.toBeDisabled()
  })

  it("populates lat and lon fields on successful geocode", async () => {
    mockGeocode.mockResolvedValueOnce({ lat: 44.974, lon: -93.2277, displayName: "Oak St" })

    renderCreateForm()
    fireEvent.change(screen.getByPlaceholderText(/500 Oak St/i), {
      target: { value: "500 Oak St SE, Minneapolis" },
    })

    fireEvent.click(screen.getByRole("button", { name: /auto.?fill/i }))

    await waitFor(() => {
      const latInput = screen.getByRole("spinbutton", { name: /latitude/i }) as HTMLInputElement
      const lonInput = screen.getByRole("spinbutton", { name: /longitude/i }) as HTMLInputElement
      expect(latInput.value).toBe("44.974")
      expect(lonInput.value).toBe("-93.2277")
    })
  })

  it("passes the typed address to the geocoding service", async () => {
    mockGeocode.mockResolvedValueOnce({ lat: 44.974, lon: -93.2277, displayName: "Oak St" })

    renderCreateForm()
    fireEvent.change(screen.getByPlaceholderText(/500 Oak St/i), {
      target: { value: "200 Union St SE, Minneapolis" },
    })
    fireEvent.click(screen.getByRole("button", { name: /auto.?fill/i }))

    await waitFor(() => {
      expect(mockGeocode).toHaveBeenCalledWith("200 Union St SE, Minneapolis")
    })
  })

  it("calls onGeoError with the error message when geocoding fails", async () => {
    mockGeocode.mockRejectedValueOnce(new Error("No location found for that address"))

    const onGeoError = vi.fn()
    render(
      <SpotForm onSubmit={noop} onCancel={noop} isPending={false} onGeoError={onGeoError} />
    )

    fireEvent.change(screen.getByPlaceholderText(/500 Oak St/i), {
      target: { value: "Nonexistent Street XYZ" },
    })
    fireEvent.click(screen.getByRole("button", { name: /auto.?fill/i }))

    await waitFor(() => {
      expect(onGeoError).toHaveBeenCalledWith(expect.stringMatching(/no location|could not find/i))
    })
  })

  it("does not call geocoding service when address is empty", () => {
    renderCreateForm()
    fireEvent.click(screen.getByRole("button", { name: /auto.?fill/i }))
    expect(mockGeocode).not.toHaveBeenCalled()
  })
})
