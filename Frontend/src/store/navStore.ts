import { create } from "zustand";
import type { ParkingSpot } from "../types/parking.types";
import type { RouteResult } from "../features/navigation/components/services/routingApi";

export interface LiveUserLocation {
  coords: [number, number];
  heading: number;
}

export type RouteStatus = "idle" | "loading" | "ready" | "error";

interface NavState {
  // checks if the user is currently navigating
  isNavigating: boolean;

  // True after the user explicitly taps Start.
  hasStartedNavigation: boolean;

  // Controls whether the navigation overlay (TurnByTurn + RouteDisplay) is shown.
  // Set to false via "Back/Cancel" to hide the overlay without ending navigation.
  navOverlayVisible: boolean;

  // The destination spot - null when not navigating
  destination: ParkingSpot | null;

  // Shared live user location from the map geolocation watch.
  currentUserLocation: LiveUserLocation | null;

  // Live stats - updated as user moves
  distanceRemainingMiles: number | null;
  etaMinutes: number | null;
  arrivalTime: string | null;

  // Current travel mode
  travelMode: "walking" | "driving" | "cycling";

  // Route fetch lifecycle
  routeStatus: RouteStatus;
  routeError: string | null;
  routeNotice: string | null;
  routeRequestId: number;

  // routing
  route: RouteResult | null;
  currentStepIndex: number;

  // Actions
  startNavigation: (spot: ParkingSpot) => void;
  beginNavigation: () => void;
  endNavigation: () => void;
  retryRoute: () => void;
  setNavOverlayVisible: (v: boolean) => void;
  updateStats: (distanceMiles: number, etaMinutes: number) => void;
  setTravelMode: (mode: "walking" | "driving" | "cycling") => void;
  setCurrentUserLocation: (location: LiveUserLocation | null) => void;
  setRoute: (route: RouteResult) => void;
  setRouteError: (message: string) => void;
  clearRouteNotice: () => void;
  advanceStep: () => void;
}

const routeLoadingState = {
  route: null,
  routeStatus: "loading" as const,
  routeError: null,
  routeNotice: null,
  currentStepIndex: 0,
};

export const useNavStore = create<NavState>((set) => ({
  // initial state
  isNavigating: false,
  hasStartedNavigation: false,
  navOverlayVisible: false,
  destination: null,
  currentUserLocation: null,
  distanceRemainingMiles: null,
  etaMinutes: null,
  arrivalTime: null,
  travelMode: "walking",
  routeStatus: "idle",
  routeError: null,
  routeNotice: null,
  routeRequestId: 0,
  route: null,
  currentStepIndex: 0,

  startNavigation: (spot) =>
    set({
      isNavigating: true,
      hasStartedNavigation: false,
      navOverlayVisible: true,
      destination: spot,
      distanceRemainingMiles: null,
      etaMinutes: null,
      arrivalTime: null,
      routeStatus: "idle",
      routeError: null,
      routeNotice: null,
      routeRequestId: 0,
      route: null,
      currentStepIndex: 0,
    }),

  beginNavigation: () =>
    set((state) => ({
      hasStartedNavigation: true,
      navOverlayVisible: true,
      routeRequestId: state.routeRequestId + 1,
      ...routeLoadingState,
    })),

  endNavigation: () =>
    set({
      isNavigating: false,
      hasStartedNavigation: false,
      navOverlayVisible: false,
      destination: null,
      distanceRemainingMiles: null,
      etaMinutes: null,
      arrivalTime: null,
      routeStatus: "idle",
      routeError: null,
      routeNotice: null,
      routeRequestId: 0,
      route: null,
      currentStepIndex: 0,
    }),

  retryRoute: () =>
    set((state) => ({
      routeRequestId: state.routeRequestId + 1,
      ...routeLoadingState,
    })),

  setNavOverlayVisible: (v) => set({ navOverlayVisible: v }),

  // updateStats receives distanceMiles and etaMinutes
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

  setTravelMode: (mode) =>
    set((state) => {
      if (!state.isNavigating || !state.hasStartedNavigation) {
        return { travelMode: mode };
      }

      return {
        travelMode: mode,
        routeRequestId: state.routeRequestId + 1,
        ...routeLoadingState,
      };
    }),

  setCurrentUserLocation: (location) =>
    set((state) => {
      const previous = state.currentUserLocation;

      if (previous === location) {
        return state;
      }

      if (
        previous &&
        location &&
        previous.heading === location.heading &&
        previous.coords[0] === location.coords[0] &&
        previous.coords[1] === location.coords[1]
      ) {
        return state;
      }

      if (!previous && !location) {
        return state;
      }

      return { currentUserLocation: location };
    }),

  setRoute: (route) =>
    set({
      route,
      routeStatus: "ready",
      routeError: null,
      routeNotice: route.notice ?? null,
      currentStepIndex: 0,
    }),

  setRouteError: (message) =>
    set({
      route: null,
      routeStatus: "error",
      routeError: message,
      routeNotice: null,
      currentStepIndex: 0,
    }),

  clearRouteNotice: () => set({ routeNotice: null }),

  advanceStep: () =>
    set((state) => ({
      currentStepIndex: Math.min(
        state.currentStepIndex + 1,
        (state.route?.steps.length ?? 1) - 1
      ),
    })),
}));
