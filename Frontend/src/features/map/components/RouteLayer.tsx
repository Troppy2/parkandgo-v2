import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import { useNavStore } from "../../../store/navStore";
import { snapToRoute } from "../../navigation/components/services/routingApi";

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
 * Uses squared distance (no sqrt) - only relative order matters.
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

/**
 * Find the nearest projected point on a polyline and the segment index it belongs to.
 */
function findClosestProjectedPoint(
  coords: [number, number][],
  userLoc: [number, number]
): { point: [number, number]; segmentIndex: number } {
  if (coords.length < 2) {
    return { point: coords[0] ?? userLoc, segmentIndex: 0 };
  }

  let bestPoint: [number, number] = coords[0];
  let bestSegmentIndex = 0;
  let bestDistSq = Infinity;

  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i];
    const [bx, by] = coords[i + 1];

    const dx = bx - ax;
    const dy = by - ay;
    const segLenSq = dx * dx + dy * dy;

    const t = segLenSq > 0
      ? Math.max(0, Math.min(1, ((userLoc[0] - ax) * dx + (userLoc[1] - ay) * dy) / segLenSq))
      : 0;

    const px = ax + t * dx;
    const py = ay + t * dy;
    const ex = userLoc[0] - px;
    const ey = userLoc[1] - py;
    const distSq = ex * ex + ey * ey;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPoint = [px, py];
      bestSegmentIndex = i;
    }
  }

  return { point: bestPoint, segmentIndex: bestSegmentIndex };
}

export default function RouteLayer({ map, userLocation }: RouteLayerProps) {
  const { isNavigating, destination, route, routeStatus, travelMode } = useNavStore();

  useEffect(() => {
    if (!map) return;

    if (
      !isNavigating ||
      !destination ||
      !userLocation ||
      routeStatus === "loading" ||
      destination.longitude == null ||
      destination.latitude == null
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
    const routeAnchoredUserLocation: [number, number] =
      travelMode === "driving" && route?.coordinates && route.coordinates.length > 1
        ? snapToRoute(userLocation, route.coordinates)
        : userLocation;

    if (route?.coordinates && route.coordinates.length > 1) {
      if (travelMode === "driving") {
        const { point, segmentIndex } = findClosestProjectedPoint(
          route.coordinates,
          routeAnchoredUserLocation,
        );
        const remaining = route.coordinates.slice(segmentIndex + 1);
        coordinates = remaining.length > 0
          ? [point, ...remaining]
          : [point, [destination.longitude, destination.latitude]];
      } else {
        const closestIdx = findClosestIndex(route.coordinates, userLocation);
        const remaining = route.coordinates.slice(closestIdx + 1);
        coordinates = remaining.length > 0
          ? [userLocation, ...remaining]
          : [userLocation, [destination.longitude, destination.latitude]];
      }
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
  }, [destination, isNavigating, map, route, routeStatus, travelMode, userLocation]);

  useEffect(() => {
    return () => {
      if (map) removeRouteLayer(map);
    };
  }, [map]);

  return null;
}
