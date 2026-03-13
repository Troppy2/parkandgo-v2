/* Global Zustand store — re-export auth store and define map store */

import { create } from "zustand"

// Re-export the canonical auth store so callers can import from either path
export { useAuthStore } from "./authStore"

type MapStore = {
  userLat: number | null
  userLon: number | null
  zoom: number
  setUserLocation: (lat: number, lon: number) => void
  setZoom: (zoom: number) => void
}

export const useMapStore = create<MapStore>((set) => ({
  userLat: null,
  userLon: null,
  zoom: 14,
  setUserLocation: (lat, lon) => set({ userLat: lat, userLon: lon }),
  setZoom: (zoom) => set({ zoom }),
}))
