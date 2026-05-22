import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Map as MaplibreMap } from "maplibre-gl"

// Toast type (already exists from Phase 11)
interface Toast {
  id: string
  message: string
  type: "success" | "error"
}

// Map style type - three options
export type MapStyle = "standard" | "satellite" | "3d"

interface UIState {
  // ── Toasts ──
  toasts: Toast[]
  showToast: (message: string, type: "success" | "error") => void
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

  // ── Map instance (from Phase 18) ──
  mapInstance: MaplibreMap | null
  setMapInstance: (map: MaplibreMap) => void

  // ── Network status ──
  isOffline: boolean
  setOffline: (offline: boolean) => void
  // ── Kojo AI assistant ──
  //To-Do


}

// persist middleware wraps create() and saves specified fields to localStorage
// This is how mapStyle and preferences survive a page refresh
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
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
      setMapStyle: (style) => set({ mapStyle: style }),

      // Preferences
      verifiedOnly: false,
      setVerifiedOnly: (v) => set({ verifiedOnly: v }),
      directionsOnly: false,
      setDirectionsOnly: (v) => set({ directionsOnly: v }),
      darkMode: false,
      setDarkMode: (v) => set({ darkMode: v }),
      dataConsent: false,
      setDataConsent: (v) => set({ dataConsent: v }),
      ttsEnabled: false,
      setTTSEnabled: (v) => set({ ttsEnabled: v }),
      selectedTTSVoice: null,
      setSelectedTTSVoice: (voiceName) => set({ selectedTTSVoice: voiceName }),
      campusRoutingEnabled: true,
      setCampusRoutingEnabled: (v) => set({ campusRoutingEnabled: v }),

      // Map instance - never persisted, recreated on mount
      mapInstance: null,
      setMapInstance: (map) => set({ mapInstance: map }),

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
      }),
    }
  )
)
