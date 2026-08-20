import { useEffect, useRef } from "react";
import { useNavStore } from "../../../store/navStore";
import { useUIStore } from "../../../store/uiStore";
import { fetchRoutesVia, getNextStep, ROUTE_ATTEMPT_TIMEOUT_MS } from "./services/routingApi";
import type { LiveUserLocation } from "../../../store/navStore";
import { logContextEvent } from "../services/navigationApi";

const NAVIGATION_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 12000,
  maximumAge: 30000,
} as const;

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const radiusMiles = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SPEED_MPH = { walking: 3, driving: 25, cycling: 10 };

export default function ETAIndicator() {
  const {
    isNavigating,
    hasStartedNavigation,
    destination,
    origin,
    stops,
    travelMode,
    currentUserLocation,
    routeRequestId,
    updateStats,
    setCurrentUserLocation,
    setRouteOptions,
    setRouteError,
    route,
    currentStepIndex,
    setCurrentStepIndex,
  } = useNavStore();
  const campusRoutingEnabled = useUIStore((s) => s.campusRoutingEnabled);
  const showToast = useUIStore((s) => s.showToast);
  const appMode = useUIStore((s) => s.appMode);
  // Campus Mode is walking only, same rule RouteDisplay applies to the pills.
  const walkingOnly = !campusRoutingEnabled || appMode === "campus";

  const launchedRequestRef = useRef<string | null>(null);

  // Ref so the route-fetch effect can read the current location without adding
  // currentUserLocation to its dependency array. Without this, every GPS ping
  // would re-trigger the fetch guard and potentially start duplicate requests.
  const currentUserLocationRef = useRef<LiveUserLocation | null>(currentUserLocation);
  useEffect(() => {
    currentUserLocationRef.current = currentUserLocation;
  }, [currentUserLocation]);

  // Straight-line distance/ETA to fill the tiles for the moment between picking
  // a destination and the routed answer arriving.
  //
  // Gated on not having a route yet: this effect depends on currentUserLocation,
  // which updates every few seconds, so once the real route lands it would
  // otherwise keep overwriting accurate OSRM numbers with the rough guess.
  useEffect(() => {
    if (!isNavigating || route || !destination || !currentUserLocation) return;
    if (destination.latitude == null || destination.longitude == null) return;

    const [lng, lat] = currentUserLocation.coords;
    const distMiles = haversineDistance(lat, lng, destination.latitude, destination.longitude);
    const speed = SPEED_MPH[travelMode];
    updateStats(distMiles, Math.max(1, Math.round((distMiles / speed) * 60)));
  }, [isNavigating, route, destination, currentUserLocation, travelMode, updateStats]);

  // Fetch the route as soon as a destination is picked, then again only on
  // retry or a travel mode change.
  //
  // Deliberately not gated on hasStartedNavigation: the preview screen should
  // show the real road route rather than a straight line, the way maps apps do
  // the moment you ask for directions. Start then reuses exactly that route
  // instead of fetching a second one, so a trip costs one request rather than
  // two and the drawn line never blinks out. See beginNavigation in navStore.
  //
  // currentUserLocation is intentionally excluded from deps - it's read via ref
  // so location updates don't re-trigger a fetch that is already in flight.
  useEffect(() => {
    if (!isNavigating || !destination) {
      launchedRequestRef.current = null;
      return;
    }
    if (destination.latitude == null || destination.longitude == null) return;

    const effectiveTravelMode = walkingOnly ? "walking" : travelMode;

    // Everything that changes the shape of the trip has to be in this key.
    //
    // It used to carry the destination id alone, which was right when the
    // destination was the only thing a trip had. Now that the origin and the
    // stops are editable, reordering two stops changes neither the id nor the
    // mode, so the guard below would return early and the map would keep
    // showing a route the panel no longer describes. Stop ids are included as
    // well as their coordinates so that swapping two stops, which leaves the
    // set of coordinates identical, still reads as a different trip.
    const tripSignature = [
      origin ? `${origin.longitude},${origin.latitude}` : "live",
      ...stops.map((stop) => `${stop.id}@${stop.place.longitude},${stop.place.latitude}`),
      `${destination.longitude},${destination.latitude}`,
    ].join("|");

    const requestKey = `${routeRequestId}:${effectiveTravelMode}:${tripSignature}`;
    if (launchedRequestRef.current === requestKey) return;

    let cancelled = false;
    launchedRequestRef.current = requestKey;

    // One notice per request, fired if the first attempt's worth of time passes
    // with nothing to show. Only before Start: once guidance is running the
    // TurnByTurn header already says "Calculating your route", and a toast on
    // top of it is just the same news twice.
    //
    // hasStartedNavigation is read from the store rather than closed over,
    // because adding it to this effect's deps would refetch on Start, which is
    // exactly what beginNavigation was changed to avoid.
    const slowNoticeTimer = window.setTimeout(() => {
      if (cancelled) return;
      if (useNavStore.getState().hasStartedNavigation) return;
      showToast("Still finding a route. Hang tight.", "info");
    }, ROUTE_ATTEMPT_TIMEOUT_MS);

    const runFetch = async (originCoords: [number, number]) => {
      // Compute an initial distance/ETA snapshot so the UI has something to
      // show while the real OSRM response is still in flight.
      //
      // Measured origin to destination, ignoring any stops. It is a placeholder
      // that lives for a few hundred milliseconds before the routed answer
      // replaces it, and a straight line through the stops would not be much
      // truer than a straight line past them.
      if (destination.latitude != null && destination.longitude != null) {
        const [lng, lat] = originCoords;
        const distMiles = haversineDistance(lat, lng, destination.latitude, destination.longitude);
        const speed = SPEED_MPH[effectiveTravelMode];
        updateStats(distMiles, Math.max(1, Math.round((distMiles / speed) * 60)));
      }

      // ParkingSpot allows null coordinates, and a place we cannot locate
      // cannot be routed through. Dropping it beats failing the whole trip.
      const stopPoints = stops
        .map((stop) => stop.place)
        .filter((place) => place.longitude != null && place.latitude != null)
        .map((place) => [place.longitude!, place.latitude!] as [number, number]);

      try {
        const results = await fetchRoutesVia(
          [
            originCoords,
            ...stopPoints,
            [destination.longitude!, destination.latitude!],
          ],
          effectiveTravelMode
        );

        if (cancelled) return;

        window.clearTimeout(slowNoticeTimer);
        // The whole option set goes to the store, which selects the first.
        // OSRM orders them best first, so someone who touches nothing still
        // gets the best route.
        setRouteOptions(results);

        const [best] = results;
        const miles = best.totalDistanceMeters / 1609.34;
        const etaMins = Math.max(1, Math.round(best.totalDurationSeconds / 60));
        updateStats(miles, etaMins);
        void logContextEvent("navigation_route_loaded", {
          spot_id: destination.spot_id,
          source: best.source ?? "unknown",
          campus_routing_enabled: campusRoutingEnabled,
          travel_mode: effectiveTravelMode,
          options_offered: results.length,
        }).catch(() => undefined)
      } catch {
        if (cancelled) return;

        // fetchRoute has already retried and has no cached route to offer, so
        // this is the end of the line. The panel shows the error and a Retry;
        // the toast is what reaches the user if they are looking at the map.
        window.clearTimeout(slowNoticeTimer);
        const message = "We couldn't calculate a route right now. Try again in a moment.";
        setRouteError(message);
        showToast(message, "error");
      }
    };

    // An explicit origin is a fixed point, so there is nothing to look up and
    // no reason to touch the GPS at all. Only a trip that still starts at "Your
    // location" falls through to the live position and its fallbacks below.
    if (origin && origin.longitude != null && origin.latitude != null) {
      void runFetch([origin.longitude, origin.latitude]);
      return () => {
        cancelled = true;
        window.clearTimeout(slowNoticeTimer);
      };
    }

    // Read from ref - always fresh, never stale, and not a reactive dependency.
    const loc = currentUserLocationRef.current;
    if (loc) {
      void runFetch(loc.coords);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nextLocation: LiveUserLocation = {
            coords: [pos.coords.longitude, pos.coords.latitude],
            heading: pos.coords.heading ?? 0,
          };
          setCurrentUserLocation(nextLocation);
          void runFetch(nextLocation.coords);
        },
        () => {
          if (!cancelled) {
            setRouteError("We couldn't get your location. Move somewhere with GPS access and retry.");
          }
        },
        NAVIGATION_GEOLOCATION_OPTIONS
      );
    } else {
      setRouteError("Geolocation is unavailable on this device.");
    }

    return () => {
      cancelled = true;
      window.clearTimeout(slowNoticeTimer);
    };
  }, [
    walkingOnly,
    // Still read directly inside the effect, for the navigation_route_loaded
    // log payload, so it stays a dependency in its own right.
    campusRoutingEnabled,
    destination,
    // hasStartedNavigation is deliberately absent: Start reuses the route the
    // preview already fetched, so it must not trigger another request.
    isNavigating,
    // The editable parts of the trip. Both are compared by reference, and every
    // navStore action that touches them writes a new array or object, so an
    // edit re-runs this effect and the request key decides whether it refetches.
    origin,
    stops,
    routeRequestId,
    setCurrentUserLocation,
    setRouteOptions,
    setRouteError,
    showToast,
    travelMode,
    updateStats,
  ]);

  // Sync live stats whenever the shared location changes during active navigation.
  // MapView's single persistent watchPosition feeds currentUserLocation via navStore,
  // so no second watcher is registered here. All deps are explicit - no stale closure.
  useEffect(() => {
    if (!isNavigating || !hasStartedNavigation || !destination || !currentUserLocation) return;
    if (destination.latitude == null || destination.longitude == null) return;

    const [longitude, latitude] = currentUserLocation.coords;
    const distMiles = haversineDistance(latitude, longitude, destination.latitude, destination.longitude);
    const speed = SPEED_MPH[travelMode];
    const etaMins = Math.max(1, Math.round((distMiles / speed) * 60));
    updateStats(distMiles, etaMins);

    if (route?.steps.length) {
      const nextStepIndex = getNextStep(longitude, latitude, route.steps);
      if (nextStepIndex !== currentStepIndex) {
        setCurrentStepIndex(nextStepIndex);
      }
    }
  }, [
    currentStepIndex,
    currentUserLocation,
    destination,
    hasStartedNavigation,
    isNavigating,
    route,
    setCurrentStepIndex,
    travelMode,
    updateStats,
  ]);

  return null;
}
