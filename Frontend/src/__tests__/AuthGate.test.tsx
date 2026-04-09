/**
 * Tests for the AuthGate component (inline in App.tsx).
 * Verifies the auth-restore effect: when a token exists but no user object
 * (e.g. page reload), it must call /auth/me and populate the store.
 */
import { render, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useAuthStore } from "../store/authStore"
import type { User } from "../types/user.types"

// Isolate the authApi module so no real HTTP calls happen
vi.mock("../features/auth/services/authApi", () => ({
  getMe: vi.fn(),
}))
import { getMe } from "../features/auth/services/authApi"
const mockGetMe = vi.mocked(getMe)

// Extract AuthGate by importing App and isolating just the component.
// Since AuthGate is not exported we test it through App's rendered output.
// Instead, we co-locate a small harness that mirrors the same effect logic.
import App from "../App"

// Stub the health check so App resolves to "ready" immediately
vi.mock("../features/health/services/healthApi", () => ({
  checkHealthWithBackoff: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../app/routes", () => ({
  default: () => <div data-testid="app-routes" />,
}))

vi.mock("../app/providers", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const fakeUser: User = {
  user_id: 42,
  google_id: "g-42",
  first_name: "Test",
  last_name: "User",
  email: "test@umn.edu",
  profile_pic: null,
  is_admin: false,
  prefered_name: null,
  preferred_parking_types: "",
  major: null,
  major_category: null,
  grade_level: null,
  graduation_year: null,
  housing_type: null,
  is_profile_complete: true,
  created_at: null,
}

describe("AuthGate — auth restore effect", () => {
  beforeEach(() => {
    mockGetMe.mockReset()
    localStorage.clear()
    // Reset store to its pristine initial state so each test is independent
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,
      isReady: false,
    })
  })

  it("calls getMe when there is a token but no user on store ready", async () => {
    mockGetMe.mockResolvedValue(fakeUser)
    localStorage.setItem("refresh_token", "ref-abc")

    useAuthStore.setState({
      isReady: true,
      isAuthenticated: true,
      user: null,
      token: "tok-abc",
    })

    render(<App />)

    await waitFor(() => {
      expect(mockGetMe).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(useAuthStore.getState().user?.user_id).toBe(42)
    })
  })

  it("does not call getMe when a user object already exists in the store", async () => {
    useAuthStore.setState({
      isReady: true,
      isAuthenticated: true,
      user: fakeUser,
      token: "tok-abc",
    })

    render(<App />)

    // Give effects a chance to fire
    await waitFor(() => {
      expect(mockGetMe).not.toHaveBeenCalled()
    })
  })

  it("calls clearAuth when getMe rejects", async () => {
    mockGetMe.mockRejectedValue(new Error("401 Unauthorized"))

    useAuthStore.setState({
      isReady: true,
      isAuthenticated: true,
      user: null,
      token: "expired-tok",
    })

    render(<App />)

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(useAuthStore.getState().token).toBeNull()
    })
  })

  it("does not call getMe when user is not authenticated", async () => {
    useAuthStore.setState({
      isReady: true,
      isAuthenticated: false,
      user: null,
      token: null,
    })

    render(<App />)

    await waitFor(() => {
      expect(mockGetMe).not.toHaveBeenCalled()
    })
  })
})
