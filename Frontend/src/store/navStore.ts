import { create } from "zustand";
import type { ParkingSpot } from "../types/parking.types";
import type { RouteResult } from "../features/navigation/components/services/routingApi";

interface NavState {
  // checks if the user is currently navigating
  isNavigating: boolean;

  // The destination spot — null when not navigating
  destination: ParkingSpot | null;

  // Live stats — updated as user moves
  distanceRemainingMiles: number | null;
  etaMinutes: number | null;
  arrivalTime: string | null;

  // Current travel mode
  travelMode: "walking" | "driving" | "cycling";

  // Actions
  startNavigation: (spot: ParkingSpot) => void;
  endNavigation: () => void;
  updateStats: (distanceMiles: number, etaMinutes: number) => void;
  setTravelMode: (mode: "walking" | "driving" | "cycling") => void;
  
  // routing
  route: RouteResult | null;
  currentStepIndex: number;
  setRoute: (route: RouteResult) => void;
  advanceStep: () => void;
}


export const useNavStore = create<NavState>((set) => ({
  // intial state
  isNavigating: false,
  destination: null,
  distanceRemainingMiles: null,
  etaMinutes: null,
  arrivalTime: null,
  travelMode: "walking",
  route: null,
  currentStepIndex: 0,

  startNavigation: (spot) =>
    set({
      isNavigating: true,
      destination: spot,
    }),

  endNavigation: () =>
    set({
      isNavigating: false,
      destination: null,
      distanceRemainingMiles: null,
      etaMinutes: null,
      arrivalTime: null,
      route: null,
      currentStepIndex: 0,
    }),

  // updateStats It receives distanceMiles and etaMinutes
  // Calculate arrivalTime by adding etaMinutes to the current time
  // Format it as "h:mm AM/PM"
  updateStats: (distanceMiles, etaMinutes) => {
    const arrival = new Date(Date.now() + etaMinutes * 60 * 1000);
    const formatted = arrival.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    set({
      distanceRemainingMiles: distanceMiles,
      etaMinutes,
      arrivalTime: formatted,
    });
  },

  setTravelMode: (mode) => set({ travelMode: mode }),

  setRoute: (route) => set({ route }),

  advanceStep: () => set((state) => ({
    currentStepIndex: Math.min(
      state.currentStepIndex + 1,
      (state.route?.steps.length ?? 1) - 1
    ),
  })),
}));
