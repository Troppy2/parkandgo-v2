import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Map as MaplibreMap } from "maplibre-gl"
import {
  fetchPreferences,
  setDataConsent as pushDataConsent,
  updatePreferences,
  type AppMode,
  type PreferencesPatch,
  type ServerPreferences,
} from "../services/preferences.service"
import { useAuthStore } from "./authStore"

// Toast type (already exists from Phase 11)
interface Toast {
  id: string
  message: string
  // "info" carries progress, not failure: a slow route is not a broken one, and
  // a red toast for it reads as an error that has not happened.
  type: "success" | "error" | "info"
}

// Map style type - three options
export type MapStyle = "standard" | "satellite" | "3d"

interface UIState {
  // ── Toasts ──
  toasts: Toast[]
  showToast: (message: string, type: "success" | "error" | "info") => void
  removeToast: (id: string) => void

  // ── Tab state ──
  activeTab: "spots" | "events"
  setActiveTab: (tab: "spots" | "events") => void

  // ── Settings modal ──
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  // ── Suggest a Spot modal ──
  suggestSpotOpen: boolean
  setSuggestSpotOpen: (open: boolean) => void

  // ── Map style - persisted so user's preference survives refresh ──
  mapStyle: MapStyle
  setMapStyle: (style: MapStyle) => void

  // ── Preferences (from Phase 17) ──
  verifiedOnly: boolean
  setVerifiedOnly: (v: boolean) => void
  directionsOnly: boolean
  setDirectionsOnly: (v: boolean) => void
  darkMode: boolean
  setDarkMode: (v: boolean) => void
  dataConsent: boolean
  setDataConsent: (v: boolean) => void
  ttsEnabled: boolean
  setTTSEnabled: (v: boolean) => void
  selectedTTSVoice: string | null
  setSelectedTTSVoice: (voiceName: string | null) => void
  campusRoutingEnabled: boolean
  setCampusRoutingEnabled: (v: boolean) => void

  // ── App mode (Campus Mode) ──
  // "parking" shows parking spots, "campus" shows UMN buildings with walking
  // only routing. Distinct from campusRoutingEnabled above, which only decides
  // whether driving is offered as a travel mode.
  appMode: AppMode
  setAppMode: (mode: AppMode) => void

  // ── Map instance (from Phase 18) ──
  mapInstance: MaplibreMap | null
  setMapInstance: (map: MaplibreMap) => void

  // ── Navigation panel height ──
  // Measured height of the route panel that overlays the bottom of the map, so
  // the camera can pad for it and keep the destination in the visible strip.
  // Zero whenever the panel is not on screen.
  navPanelHeight: number
  setNavPanelHeight: (height: number) => void

  // ── Network status ──
  isOffline: boolean
  setOffline: (offline: boolean) => void

  // ── Server preference sync ──
  // Pull the authoritative preferences for a signed-in user. Server wins, so
  // this overwrites whatever the local cache held.
  syncPreferencesFromServer: () => Promise<void>
  // ── Kojo AI assistant ──
  //To-Do


}

// Push a preference change to the server for signed-in users.
//
// Guests have no account, so their preferences stay local only. Failures are
// swallowed on purpose: a preference toggle must never block the UI, and the
// next successful sync reconciles from the server anyway.
function pushPreference(patch: PreferencesPatch): void {
  const { isAuthenticated } = useAuthStore.getState()
  if (!isAuthenticated) return
  void updatePreferences(patch).catch(() => undefined)
}

// Map a server preferences payload onto local state.
function fromServer(prefs: ServerPreferences) {
  return {
    dataConsent: prefs.data_consent,
    mapStyle: prefs.map_style,
    verifiedOnly: prefs.verified_only,
    directionsOnly: prefs.directions_only,
    darkMode: prefs.dark_mode,
    ttsEnabled: prefs.tts_enabled,
    selectedTTSVoice: prefs.selected_tts_voice,
    campusRoutingEnabled: prefs.campus_routing_enabled,
    // Older servers predate app_mode. Falling back keeps the client working
    // against a backend that has not run the campus_buildings migration yet.
    appMode: prefs.app_mode ?? "parking",
  }
}

// persist middleware wraps create() and saves specified fields to localStorage.
// localStorage is only a cache now: for signed-in users the server is the
// authority and syncPreferencesFromServer overwrites it on load.
export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Toasts
      toasts: [],
      showToast: (message, type) => set((state) => ({
        toasts: [...state.toasts, {
          id: Math.random().toString(36).slice(2),
          message,
          type,
        }]
      })),
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      })),

      // Tab
      activeTab: "spots",
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Settings
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),

      // Suggest a Spot
      suggestSpotOpen: false,
      setSuggestSpotOpen: (open) => set({ suggestSpotOpen: open }),

      // Map style
      mapStyle: "standard",
      setMapStyle: (style) => {
        set({ mapStyle: style })
        pushPreference({ map_style: style })
      },

      // Preferences - each setter updates locally for an instant response and
      // writes through to the server so other devices pick the change up.
      verifiedOnly: false,
      setVerifiedOnly: (v) => {
        set({ verifiedOnly: v })
        pushPreference({ verified_only: v })
      },
      directionsOnly: false,
      setDirectionsOnly: (v) => {
        set({ directionsOnly: v })
        pushPreference({ directions_only: v })
      },
      darkMode: false,
      setDarkMode: (v) => {
        set({ darkMode: v })
        pushPreference({ dark_mode: v })
      },

      // Consent is not an ordinary preference. It goes through its own audited
      // endpoint, and the server's answer wins: if the write fails we roll the
      // local value back rather than showing a consent state the server does
      // not actually have.
      dataConsent: false,
      setDataConsent: (v) => {
        const previous = get().dataConsent
        set({ dataConsent: v })
        if (!useAuthStore.getState().isAuthenticated) return
        void pushDataConsent(v)
          .then((result) => set({ dataConsent: result.data_consent }))
          .catch(() => set({ dataConsent: previous }))
      },

      ttsEnabled: false,
      setTTSEnabled: (v) => {
        set({ ttsEnabled: v })
        pushPreference({ tts_enabled: v })
      },
      selectedTTSVoice: null,
      setSelectedTTSVoice: (voiceName) => {
        set({ selectedTTSVoice: voiceName })
        pushPreference({ selected_tts_voice: voiceName })
      },
      campusRoutingEnabled: true,
      setCampusRoutingEnabled: (v) => {
        set({ campusRoutingEnabled: v })
        pushPreference({ campus_routing_enabled: v })
      },

      appMode: "parking",
      setAppMode: (mode) => {
        set({ appMode: mode })
        pushPreference({ app_mode: mode })
      },

      // Server sync
      syncPreferencesFromServer: async () => {
        if (!useAuthStore.getState().isAuthenticated) return
        try {
          set(fromServer(await fetchPreferences()))
        } catch {
          // Offline or the request failed. Keep the cached values; the next
          // load tries again.
        }
      },

      // Map instance - never persisted, recreated on mount
      mapInstance: null,
      setMapInstance: (map) => set({ mapInstance: map }),

      // Panel height - never persisted, measured from the DOM on each mount
      navPanelHeight: 0,
      setNavPanelHeight: (height) => set({ navPanelHeight: height }),

      // Network status - never persisted, derived from browser events on mount
      isOffline: false,
      setOffline: (offline) => set({ isOffline: offline }),
    }),
    {
      name: "parkandgo-ui",   // localStorage key
      // Only persist these fields - not toasts, mapInstance, or activeTab
      // activeTab is intentionally not persisted so the app always starts on "spots"
      partialize: (state) => ({
        mapStyle: state.mapStyle,
        verifiedOnly: state.verifiedOnly,
        directionsOnly: state.directionsOnly,
        darkMode: state.darkMode,
        dataConsent: state.dataConsent,
        ttsEnabled: state.ttsEnabled,
        selectedTTSVoice: state.selectedTTSVoice,
        campusRoutingEnabled: state.campusRoutingEnabled,
        appMode: state.appMode,
      }),
    }
  )
)

// Keep tabs in step.
//
// persist writes every field in partialize as one blob. Without this listener a
// tab that has been open since before a change still holds the old values in
// memory, and the next preference toggle in that tab rewrites the whole blob
// from its stale state, silently reverting the other tab's change. That is the
// mechanism behind data consent appearing to switch itself off. Rehydrating on
// the storage event means a tab always writes from current values.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "parkandgo-ui") {
      void useUIStore.persist.rehydrate()
    }
  })
}
