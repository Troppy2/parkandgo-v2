import { useEffect, useRef } from "react";
import { useNavStore } from "../../../store/navStore";
import { useUIStore } from "../../../store/uiStore";
import { createDirectRoutePreview, fetchRoute } from "./services/routingApi";
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
    travelMode,
    currentUserLocation,
    routeRequestId,
    updateStats,
    setCurrentUserLocation,
    setRoute,
    setRouteError,
    route,
    currentStepIndex,
    advanceStep,
  } = useNavStore();
  const campusRoutingEnabled = useUIStore((s) => s.campusRoutingEnabled);

  const launchedRequestRef = useRef<string | null>(null);

  // Ref so the route-fetch effect can read the current location without adding
  // currentUserLocation to its dependency array. Without this, every GPS ping
  // would re-trigger the fetch guard and potentially start duplicate requests.
  const currentUserLocationRef = useRef<LiveUserLocation | null>(currentUserLocation);
  useEffect(() => {
    currentUserLocationRef.current = currentUserLocation;
  }, [currentUserLocation]);

  // Fetch the route when navigation starts, retries, or travel mode changes.
  // currentUserLocation is intentionally excluded from deps — it's read via ref
  // so location updates don't re-trigger a fetch that is already in flight.
  useEffect(() => {
    if (!isNavigating || !hasStartedNavigation || !destination) {
      launchedRequestRef.current = null;
      return;
    }
    if (destination.latitude == null || destination.longitude == null) return;

    const effectiveTravelMode = campusRoutingEnabled ? travelMode : "walking";
    const requestKey = `${routeRequestId}:${effectiveTravelMode}:${destination.spot_id}`;
    if (launchedRequestRef.current === requestKey) return;

    let cancelled = false;
    launchedRequestRef.current = requestKey;

    const runFetch = async (origin: [number, number]) => {
      setRoute(
        createDirectRoutePreview(
          origin[0],
          origin[1],
          destination.longitude!,
          destination.latitude!,
          effectiveTravelMode
        )
      );

      // Compute an initial distance/ETA snapshot so the UI has something to
      // show while the real OSRM response is still in flight.
      if (destination.latitude != null && destination.longitude != null) {
        const [lng, lat] = origin;
        const distMiles = haversineDistance(lat, lng, destination.latitude, destination.longitude);
        const speed = SPEED_MPH[effectiveTravelMode];
        updateStats(distMiles, Math.max(1, Math.round((distMiles / speed) * 60)));
      }

      try {
        const result = await fetchRoute(
          origin[0],
          origin[1],
          destination.longitude!,
          destination.latitude!,
          effectiveTravelMode
        );

        if (cancelled) return;

        setRoute(result);
        const miles = result.totalDistanceMeters / 1609.34;
        const etaMins = Math.max(1, Math.round(result.totalDurationSeconds / 60));
        updateStats(miles, etaMins);
        void logContextEvent("navigation_route_loaded", {
          spot_id: destination.spot_id,
          source: result.source ?? "unknown",
          campus_routing_enabled: campusRoutingEnabled,
          travel_mode: effectiveTravelMode,
        }).catch(() => undefined)
      } catch {
        if (!cancelled) {
          setRouteError("We couldn't calculate a route right now. Try again in a moment.");
        }
      }
    };

    // Read from ref — always fresh, never stale, and not a reactive dependency.
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
    };
  }, [
    campusRoutingEnabled,
    destination,
    hasStartedNavigation,
    isNavigating,
    routeRequestId,
    setCurrentUserLocation,
    setRoute,
    setRouteError,
    travelMode,
    updateStats,
  ]);

  // Sync live stats whenever the shared location changes during active navigation.
  // MapView's single persistent watchPosition feeds currentUserLocation via navStore,
  // so no second watcher is registered here. All deps are explicit — no stale closure.
  useEffect(() => {
    if (!isNavigating || !hasStartedNavigation || !destination || !currentUserLocation) return;
    if (destination.latitude == null || destination.longitude == null) return;

    const [longitude, latitude] = currentUserLocation.coords;
    const distMiles = haversineDistance(latitude, longitude, destination.latitude, destination.longitude);
    const speed = SPEED_MPH[travelMode];
    const etaMins = Math.max(1, Math.round((distMiles / speed) * 60));
    updateStats(distMiles, etaMins);

    const nextStep = route?.steps[currentStepIndex + 1];
    if (nextStep) {
      const [stepLng, stepLat] = nextStep.location;
      const distToStep = haversineDistance(latitude, longitude, stepLat, stepLng);
      if (distToStep < 0.015) {
        advanceStep();
      }
    }
  }, [
    advanceStep,
    currentStepIndex,
    currentUserLocation,
    destination,
    hasStartedNavigation,
    isNavigating,
    route,
    travelMode,
    updateStats,
  ]);

  return null;
}
