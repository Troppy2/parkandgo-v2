import { create } from "zustand";
import type { ParkingSpot } from "../types/parking.types";
import type { TripStop } from "../types/trip.types";
import { createStopId, userLocationPlace } from "../types/trip.types";
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

  // Where the trip starts. Null means the live user location, which is what
  // every trip did before the planner existed and is still the default.
  origin: ParkingSpot | null;

  // Intermediate stops, in travel order. Empty for a direct trip.
  stops: TripStop[];

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

  // Every option the router offered for this trip, best first, with route
  // above being whichever one is selected. Empty when there is no route yet,
  // and legitimately one long when the router found no alternative: the foot
  // profile usually does, since most pedestrian detours are the same length.
  routeOptions: RouteResult[];
  selectedRouteIndex: number;
  currentStepIndex: number;
  rememberedSpot: ParkingSpot | null;
  arrivalRememberPromptOpen: boolean;
  arrivalRememberSpot: ParkingSpot | null;

  // Actions
  startNavigation: (spot: ParkingSpot) => void;
  beginNavigation: () => void;
  endNavigation: () => void;
  retryRoute: () => void;
  setNavOverlayVisible: (v: boolean) => void;
  updateStats: (distanceMiles: number, etaMinutes: number) => void;
  setTravelMode: (mode: "walking" | "driving" | "cycling") => void;
  setOrigin: (place: ParkingSpot | null) => void;
  setDestination: (place: ParkingSpot) => void;
  addStop: (place: ParkingSpot) => void;
  setStopPlace: (id: string, place: ParkingSpot) => void;
  removeStop: (id: string) => void;
  moveStop: (from: number, to: number) => void;
  swapEndpoints: () => void;
  setCurrentUserLocation: (location: LiveUserLocation | null) => void;
  setRoute: (route: RouteResult) => void;
  setRouteOptions: (routes: RouteResult[]) => void;
  selectRoute: (index: number) => void;
  setRouteError: (message: string) => void;
  clearRouteNotice: () => void;
  advanceStep: () => void;
  setCurrentStepIndex: (index: number) => void;
  setRememberedSpot: (spot: ParkingSpot | null) => void;
  promptRememberSpot: (spot: ParkingSpot) => void;
  dismissRememberSpotPrompt: () => void;
}

const routeLoadingState = {
  route: null,
  routeOptions: [],
  selectedRouteIndex: 0,
  routeStatus: "loading" as const,
  routeError: null,
  routeNotice: null,
  currentStepIndex: 0,
};

/**
 * The distance/ETA/arrival trio, derived from one route.
 *
 * Shared by updateStats and selectRoute so the tiles cannot disagree about how
 * an arrival time is produced depending on which one last wrote them.
 */
function statsFor(distanceMiles: number, etaMinutes: number) {
  const arrival = new Date(Date.now() + etaMinutes * 60 * 1000);
  return {
    distanceRemainingMiles: distanceMiles,
    etaMinutes,
    arrivalTime: arrival.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function statsForRoute(route: RouteResult) {
  return statsFor(
    route.totalDistanceMeters / 1609.34,
    Math.max(1, Math.round(route.totalDurationSeconds / 60))
  );
}

/**
 * Apply a trip edit, throwing the drawn route away only when guidance is live.
 *
 * Before Start there is nothing to protect: ETAIndicator's request key already
 * carries the origin and the stop list, so an edit refetches on its own and the
 * previous line stays on screen until the new one is ready. After Start the line
 * on the map is being followed, so a changed trip has to invalidate it outright.
 *
 * This is the same branch setTravelMode has always used, lifted out now that
 * seven actions need it.
 */
function withRouteInvalidation<T extends object>(state: NavState, patch: T) {
  if (!state.isNavigating || !state.hasStartedNavigation) {
    return patch;
  }

  return {
    ...patch,
    routeRequestId: state.routeRequestId + 1,
    ...routeLoadingState,
  };
}

export const useNavStore = create<NavState>((set) => ({
  // initial state
  isNavigating: false,
  hasStartedNavigation: false,
  navOverlayVisible: false,
  destination: null,
  origin: null,
  stops: [],
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
  routeOptions: [],
  selectedRouteIndex: 0,
  currentStepIndex: 0,
  rememberedSpot: null,
  arrivalRememberPromptOpen: false,
  arrivalRememberSpot: null,

  startNavigation: (spot) =>
    set({
      isNavigating: true,
      hasStartedNavigation: false,
      navOverlayVisible: true,
      destination: spot,
      // A new trip starts clean. Carrying the previous trip's origin and stops
      // over would silently route the next destination through them.
      origin: null,
      stops: [],
      distanceRemainingMiles: null,
      etaMinutes: null,
      arrivalTime: null,
      routeStatus: "idle",
      routeError: null,
      routeNotice: null,
      routeRequestId: 0,
      route: null,
      routeOptions: [],
      selectedRouteIndex: 0,
      currentStepIndex: 0,
      arrivalRememberPromptOpen: false,
      arrivalRememberSpot: null,
    }),

  // Start reuses the route the preview already fetched and drew.
  //
  // This deliberately does not bump routeRequestId. Doing so threw away a good
  // route, put routeStatus back to "loading", and made RouteLayer tear the line
  // down and redraw it, so the user watched the route blink out at the exact
  // moment they asked to be guided along it, and the app paid for a second OSRM
  // request per trip. The tradeoff is that the route still starts from where the
  // user was when they tapped Get Directions. That is the same origin the
  // preview screen was showing them, and the map snaps the puck to the route
  // while driving, so it stays correct for anyone who starts from the preview.
  // A user who sat on the preview long enough to move can re-route with retry.
  beginNavigation: () =>
    set({
      hasStartedNavigation: true,
      navOverlayVisible: true,
    }),

  endNavigation: () =>
    set({
      isNavigating: false,
      hasStartedNavigation: false,
      navOverlayVisible: false,
      destination: null,
      origin: null,
      stops: [],
      distanceRemainingMiles: null,
      etaMinutes: null,
      arrivalTime: null,
      routeStatus: "idle",
      routeError: null,
      routeNotice: null,
      routeRequestId: 0,
      route: null,
      routeOptions: [],
      selectedRouteIndex: 0,
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
  updateStats: (distanceMiles, etaMinutes) => set(statsFor(distanceMiles, etaMinutes)),

  setTravelMode: (mode) =>
    set((state) => withRouteInvalidation(state, { travelMode: mode })),

  setOrigin: (place) =>
    set((state) => withRouteInvalidation(state, { origin: place })),

  // Change where an existing trip ends, keeping the rest of it.
  //
  // Distinct from startNavigation, which begins a new trip and therefore clears
  // the origin and stops. Retargeting from the planner has to leave them alone.
  setDestination: (place) =>
    set((state) => withRouteInvalidation(state, { destination: place })),

  addStop: (place) =>
    set((state) =>
      withRouteInvalidation(state, {
        stops: [...state.stops, { id: createStopId(), place }],
      })
    ),

  setStopPlace: (id, place) =>
    set((state) =>
      withRouteInvalidation(state, {
        stops: state.stops.map((stop) => (stop.id === id ? { ...stop, place } : stop)),
      })
    ),

  removeStop: (id) =>
    set((state) =>
      withRouteInvalidation(state, {
        stops: state.stops.filter((stop) => stop.id !== id),
      })
    ),

  moveStop: (from, to) =>
    set((state) => {
      // An out of range move is a no-op rather than an error: the callers are
      // arrow buttons at the ends of a list, and returning state unchanged is
      // what "the button did nothing" should mean.
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= state.stops.length ||
        to >= state.stops.length
      ) {
        return state;
      }

      const stops = [...state.stops];
      const [moved] = stops.splice(from, 1);
      stops.splice(to, 0, moved);

      return withRouteInvalidation(state, { stops });
    }),

  // Reverse the trip: the last point becomes the first and the stops turn
  // around with it.
  //
  // "Your location" is the awkward case. As an origin it is a null standing for
  // wherever the user is right now, but as a destination it has to be a fixed
  // point, otherwise the target would move as the user walked. So a null origin
  // is resolved to the position at the moment of the swap, and the swap is
  // refused outright when there is no fix to resolve it from.
  swapEndpoints: () =>
    set((state) => {
      if (!state.destination) return state;

      const resolvedOrigin =
        state.origin ??
        (state.currentUserLocation
          ? userLocationPlace(state.currentUserLocation.coords)
          : null);

      if (!resolvedOrigin) return state;

      return withRouteInvalidation(state, {
        origin: state.destination,
        destination: resolvedOrigin,
        stops: [...state.stops].reverse(),
      });
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
      routeOptions: [route],
      selectedRouteIndex: 0,
      routeStatus: "ready",
      routeError: null,
      routeNotice: route.notice ?? null,
      currentStepIndex: 0,
    }),

  // The whole option set at once. The first is selected, because OSRM orders
  // its answers best first and the best one is what someone in a hurry wants
  // without touching anything.
  setRouteOptions: (routes) =>
    set(
      routes.length === 0
        ? {
            route: null,
            routeOptions: [],
            selectedRouteIndex: 0,
            routeStatus: "error",
            routeError: "Could not load a route",
            routeNotice: null,
            currentStepIndex: 0,
          }
        : {
            route: routes[0],
            routeOptions: routes,
            selectedRouteIndex: 0,
            routeStatus: "ready",
            routeError: null,
            routeNotice: routes[0].notice ?? null,
            currentStepIndex: 0,
          }
    ),

  // Switching options swaps the drawn line and the stats, and nothing else.
  // No refetch: every option arrived in the same response and is already here.
  selectRoute: (index) =>
    set((state) => {
      const route = state.routeOptions[index];
      if (!route) return state;

      return {
        route,
        selectedRouteIndex: index,
        routeStatus: "ready" as const,
        routeError: null,
        routeNotice: route.notice ?? null,
        // The tiles describe the drawn route, so they move with the choice.
        // Without this, picking a slower option left the old option's time and
        // distance on screen above it.
        ...statsForRoute(route),
        // Guidance follows the line that is drawn, so the step pointer has to
        // return to the top of the new one rather than keep an index into the
        // old one's turn list.
        currentStepIndex: 0,
      };
    }),

  setRouteError: (message) =>
    set({
      route: null,
      routeOptions: [],
      selectedRouteIndex: 0,
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

  setCurrentStepIndex: (index) =>
    set((state) => ({
      currentStepIndex: Math.max(
        0,
        Math.min(index, (state.route?.steps.length ?? 1) - 1)
      ),
    })),

  setRememberedSpot: (spot) => set({ rememberedSpot: spot }),

  promptRememberSpot: (spot) =>
    set({
      arrivalRememberPromptOpen: true,
      arrivalRememberSpot: spot,
    }),

  dismissRememberSpotPrompt: () =>
    set({
      arrivalRememberPromptOpen: false,
      arrivalRememberSpot: null,
    }),
}));
