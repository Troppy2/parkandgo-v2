import { useEffect, useRef } from "react";
import { useNavStore } from "../../../store/navStore";
import { createDirectRoutePreview, fetchRoute } from "./services/routingApi";

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

  const launchedRequestRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const syncStatsFromLocation = (coords: [number, number]) => {
    if (!destination || destination.latitude == null || destination.longitude == null) return;

    const [longitude, latitude] = coords;
    const distMiles = haversineDistance(
      latitude,
      longitude,
      destination.latitude,
      destination.longitude
    );
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
  };

  // Fetch the route when navigation starts, retries, or travel mode changes.
  useEffect(() => {
    if (!isNavigating || !hasStartedNavigation || !destination) {
      launchedRequestRef.current = null;
      return;
    }
    if (destination.latitude == null || destination.longitude == null) return;

    const requestKey = `${routeRequestId}:${travelMode}:${destination.spot_id}`;
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
          travelMode
        )
      );
      syncStatsFromLocation(origin);

      try {
        const result = await fetchRoute(
          origin[0],
          origin[1],
          destination.longitude!,
          destination.latitude!,
          travelMode
        );

        if (cancelled) return;

        setRoute(result);
        const miles = result.totalDistanceMeters / 1609.34;
        const etaMins = Math.max(1, Math.round(result.totalDurationSeconds / 60));
        updateStats(miles, etaMins);
      } catch {
        if (!cancelled) {
          setRouteError("We couldn't calculate a route right now. Try again in a moment.");
        }
      }
    };

    if (currentUserLocation) {
      runFetch(currentUserLocation.coords);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nextLocation = {
            coords: [pos.coords.longitude, pos.coords.latitude] as [number, number],
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
    currentUserLocation,
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

  useEffect(() => {
    if (!isNavigating || !hasStartedNavigation || !destination) {
      if (
        watchIdRef.current !== null &&
        navigator.geolocation &&
        typeof navigator.geolocation.clearWatch === "function"
      ) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (
      !navigator.geolocation ||
      typeof navigator.geolocation.watchPosition !== "function" ||
      watchIdRef.current !== null
    ) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const nextLocation = {
          coords: [pos.coords.longitude, pos.coords.latitude] as [number, number],
          heading: pos.coords.heading ?? 0,
        };

        setCurrentUserLocation(nextLocation);
        syncStatsFromLocation(nextLocation.coords);
      },
      () => {
        setRouteError("We couldn't update your live location. Retry navigation in a moment.");
      },
      NAVIGATION_GEOLOCATION_OPTIONS
    );

    return () => {
      if (
        watchIdRef.current !== null &&
        navigator.geolocation &&
        typeof navigator.geolocation.clearWatch === "function"
      ) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [
    advanceStep,
    currentStepIndex,
    currentUserLocation,
    destination,
    hasStartedNavigation,
    isNavigating,
    route,
    setCurrentUserLocation,
    setRouteError,
    travelMode,
    updateStats,
  ]);

  return null;
}
