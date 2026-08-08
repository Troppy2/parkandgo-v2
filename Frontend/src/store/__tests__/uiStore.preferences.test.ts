import { describe, it, expect, beforeEach, vi } from "vitest"
import { useUIStore } from "../uiStore"
import { useAuthStore } from "../authStore"
import * as preferencesService from "../../services/preferences.service"
import type { ServerPreferences } from "../../services/preferences.service"

const serverPrefs = (overrides: Partial<ServerPreferences> = {}): ServerPreferences => ({
  user_id: 1,
  data_consent: false,
  map_style: "standard",
  verified_only: false,
  directions_only: false,
  dark_mode: false,
  tts_enabled: false,
  selected_tts_voice: null,
  campus_routing_enabled: true,
  ...overrides,
})

function signIn() {
  useAuthStore.setState({ isAuthenticated: true, isGuest: false })
}

function continueAsGuest() {
  useAuthStore.setState({ isAuthenticated: false, isGuest: true })
}

describe("uiStore preference sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    useUIStore.setState({
      dataConsent: false,
      darkMode: false,
      mapStyle: "standard",
      verifiedOnly: false,
      ttsEnabled: false,
      campusRoutingEnabled: true,
      selectedTTSVoice: null,
    })
    continueAsGuest()
  })

  describe("server wins on load", () => {
    it("overwrites the local cache with server values", async () => {
      signIn()
      // Local cache disagrees with the server, for example after the value was
      // changed on another device.
      useUIStore.setState({ dataConsent: false, darkMode: false })
      vi.spyOn(preferencesService, "fetchPreferences").mockResolvedValue(
        serverPrefs({ data_consent: true, dark_mode: true, map_style: "satellite" })
      )

      await useUIStore.getState().syncPreferencesFromServer()

      const state = useUIStore.getState()
      expect(state.dataConsent).toBe(true)
      expect(state.darkMode).toBe(true)
      expect(state.mapStyle).toBe("satellite")
    })

    it("keeps cached values when the request fails", async () => {
      signIn()
      useUIStore.setState({ darkMode: true })
      vi.spyOn(preferencesService, "fetchPreferences").mockRejectedValue(new Error("offline"))

      await useUIStore.getState().syncPreferencesFromServer()

      expect(useUIStore.getState().darkMode).toBe(true)
    })

    it("does not call the server for guests", async () => {
      const fetchSpy = vi.spyOn(preferencesService, "fetchPreferences")

      await useUIStore.getState().syncPreferencesFromServer()

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe("preference write-through", () => {
    it("pushes ordinary preference changes to the server", () => {
      signIn()
      const updateSpy = vi
        .spyOn(preferencesService, "updatePreferences")
        .mockResolvedValue(serverPrefs({ dark_mode: true }))

      useUIStore.getState().setDarkMode(true)

      expect(useUIStore.getState().darkMode).toBe(true)
      expect(updateSpy).toHaveBeenCalledWith({ dark_mode: true })
    })

    it("keeps guest preferences local only", () => {
      const updateSpy = vi.spyOn(preferencesService, "updatePreferences")

      useUIStore.getState().setMapStyle("3d")

      expect(useUIStore.getState().mapStyle).toBe("3d")
      expect(updateSpy).not.toHaveBeenCalled()
    })

    it("does not block the UI when the server write fails", () => {
      signIn()
      vi.spyOn(preferencesService, "updatePreferences").mockRejectedValue(new Error("offline"))

      useUIStore.getState().setVerifiedOnly(true)

      // Local value still applies, the next sync reconciles.
      expect(useUIStore.getState().verifiedOnly).toBe(true)
    })
  })

  describe("data consent", () => {
    it("goes through the dedicated consent endpoint, not the preferences patch", async () => {
      signIn()
      const consentSpy = vi
        .spyOn(preferencesService, "setDataConsent")
        .mockResolvedValue({ user_id: 1, data_consent: true, changed: true })
      const updateSpy = vi.spyOn(preferencesService, "updatePreferences")

      useUIStore.getState().setDataConsent(true)
      await vi.waitFor(() => expect(consentSpy).toHaveBeenCalledWith(true))

      expect(updateSpy).not.toHaveBeenCalled()
      expect(useUIStore.getState().dataConsent).toBe(true)
    })

    it("rolls back when the server rejects the change", async () => {
      signIn()
      vi.spyOn(preferencesService, "setDataConsent").mockRejectedValue(new Error("nope"))

      useUIStore.getState().setDataConsent(true)

      // Never show a consent state the server does not actually hold.
      await vi.waitFor(() => expect(useUIStore.getState().dataConsent).toBe(false))
    })

    it("adopts the server's answer over the requested value", async () => {
      signIn()
      vi.spyOn(preferencesService, "setDataConsent").mockResolvedValue({
        user_id: 1,
        data_consent: false,
        changed: false,
      })

      useUIStore.getState().setDataConsent(true)

      await vi.waitFor(() => expect(useUIStore.getState().dataConsent).toBe(false))
    })
  })

  describe("cross-tab consistency", () => {
    it("rehydrates when another tab writes the persisted blob", async () => {
      // Another tab turns consent on and writes the whole partialized blob.
      localStorage.setItem(
        "parkandgo-ui",
        JSON.stringify({ state: { dataConsent: true, darkMode: true }, version: 0 })
      )

      window.dispatchEvent(new StorageEvent("storage", { key: "parkandgo-ui" }))

      // Without the listener this tab would keep its stale false and later
      // overwrite the other tab's change.
      await vi.waitFor(() => expect(useUIStore.getState().dataConsent).toBe(true))
    })

    it("ignores unrelated storage keys", async () => {
      useUIStore.setState({ dataConsent: true })

      window.dispatchEvent(new StorageEvent("storage", { key: "access_token" }))

      await Promise.resolve()
      expect(useUIStore.getState().dataConsent).toBe(true)
    })
  })
})
