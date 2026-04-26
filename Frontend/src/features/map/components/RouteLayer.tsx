import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import { useNavStore } from "../../../store/navStore";

interface RouteLayerProps {
  map: maplibregl.Map | null;
  userLocation: [number, number] | null; // [lng, lat]
}

function removeRouteLayer(map: maplibregl.Map) {
  if (map.getLayer("route-line")) map.removeLayer("route-line");
  if (map.getSource("route")) map.removeSource("route");
}

/**
 * Returns the index of the coordinate in `coords` that is closest to `userLoc`.
 * Uses squared distance (no sqrt) — only relative order matters.
 */
function findClosestIndex(coords: [number, number][], userLoc: [number, number]): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i][0] - userLoc[0];
    const dy = coords[i][1] - userLoc[1];
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }
  return minIdx;
}

export default function RouteLayer({ map, userLocation }: RouteLayerProps) {
  const { isNavigating, destination, route, routeStatus } = useNavStore();

  useEffect(() => {
    if (!map) return;

    if (
      !isNavigating ||
      !destination ||
      !userLocation ||
      destination.longitude == null ||
      destination.latitude == null ||
      routeStatus === "loading"
    ) {
      removeRouteLayer(map);
      return;
    }

    // Build the coordinates to draw.
    // When a pre-fetched route exists, trim already-traversed waypoints so the
    // line always starts at the user's CURRENT position and shows only the
    // remaining path to the destination.  Without this, the full static route
    // fetched at navigation-start would be drawn regardless of user movement.
    let coordinates: [number, number][];
    if (route?.coordinates && route.coordinates.length > 1) {
      const closestIdx = findClosestIndex(route.coordinates, userLocation);
      const remaining = route.coordinates.slice(closestIdx + 1);
      coordinates = remaining.length > 0
        ? [userLocation, ...remaining]
        : [userLocation, [destination.longitude, destination.latitude]];
    } else {
      coordinates = [userLocation, [destination.longitude, destination.latitude]];
    }

    const routeData = {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates,
      },
      properties: {},
    };

    const applyRoute = () => {
      if (map.getSource("route")) {
        (map.getSource("route") as maplibregl.GeoJSONSource).setData(routeData);
      } else {
        map.addSource("route", { type: "geojson", data: routeData });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#7A0019", "line-width": 4, "line-opacity": 0.85 },
        });
      }
    };

    if (map.isStyleLoaded()) {
      applyRoute();
    } else {
      map.once("load", applyRoute);
    }
  }, [destination, isNavigating, map, route, routeStatus, userLocation]);

  useEffect(() => {
    return () => {
      if (map) removeRouteLayer(map);
    };
  }, [map]);

  return null;
}
