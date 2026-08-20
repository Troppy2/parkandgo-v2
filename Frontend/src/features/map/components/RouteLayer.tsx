import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useNavStore } from "../../../store/navStore";
import { snapToRoute } from "../../navigation/components/services/routingApi";

interface RouteLayerProps {
  map: maplibregl.Map | null;
  userLocation: [number, number] | null; // [lng, lat]
}

// The paint value type MapLibre wants for line-width.
//
// Without an annotation TypeScript infers a zoom-interpolation literal as
// (string | number | string[])[], which does not match the expression tuple the
// style spec declares, so every one of these constants failed to typecheck at
// its use site. Naming the type once fixes all of them and keeps the arrays
// readable, which the alternative (casting at each addLayer call) does not.
type LineWidthValue = NonNullable<
  Extract<maplibregl.LayerSpecification, { type: "line" }>["paint"]
>["line-width"];

// Route line width, thinning out as you zoom away so the line stays
// proportionate to the map instead of sitting on it as a constant slab.
const ROUTE_WIDTH: LineWidthValue = ["interpolate", ["linear"], ["zoom"], 6, 2, 11, 3, 15, 4.5, 18, 7];
const CONNECTOR_WIDTH: LineWidthValue = ["interpolate", ["linear"], ["zoom"], 6, 1.5, 11, 2.25, 15, 3.4, 18, 5.25];

// Unselected options: grey, and a touch narrower than the chosen line so the
// difference reads at a glance rather than needing the colour compared.
const ALT_WIDTH: LineWidthValue = ["interpolate", ["linear"], ["zoom"], 6, 1.5, 11, 2.5, 15, 3.5, 18, 5.5];
const ALT_COLOR = "#9ca3af";

function removeRouteLayer(map: maplibregl.Map) {
  if (map.getLayer("route-line")) map.removeLayer("route-line");
  if (map.getSource("route")) map.removeSource("route");
  removeConnectorLayer(map);
  removeAlternativesLayer(map);
}

function removeAlternativesLayer(map: maplibregl.Map) {
  if (map.getLayer("route-alternatives-line")) map.removeLayer("route-alternatives-line");
  if (map.getLayer("route-alternatives-hit")) map.removeLayer("route-alternatives-hit");
  if (map.getSource("route-alternatives")) map.removeSource("route-alternatives");
}

function removeConnectorLayer(map: maplibregl.Map) {
  if (map.getLayer("route-connector-line")) map.removeLayer("route-connector-line");
  if (map.getSource("route-connector")) map.removeSource("route-connector");
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
  const {
    isNavigating,
    destination,
    route,
    routeStatus,
    travelMode,
    routeOptions,
    selectedRouteIndex,
    selectRoute,
  } = useNavStore();
  const applyRouteRef = useRef<(() => void) | null>(null);
  // A pending one-shot "draw once the style is ready" handler, so a superseded
  // route can be unsubscribed before it paints over a newer one.
  const pendingDrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!map) return;

    // A reload keeps the previous route on screen.
    //
    // Start no longer re-routes, but a travel mode change or a retry still flips
    // routeStatus to "loading". Tearing the line down for that would make the
    // route blink out and back. Only clear when there is genuinely nothing left
    // to draw.
    const isReloadingWithRoute = routeStatus === "loading" && !!route && route.coordinates.length > 1;

    // Only ever draw real routed geometry.
    //
    // This used to fall back to a straight line from the user to the pin
    // whenever no route was loaded, including after a failed request. A line
    // that ignores the roads is not directions, and showing one as though it
    // were is worse than showing nothing: the map now stays clean until real
    // geometry arrives, and TurnByTurn carries the loading and error state.
    const hasRoutedGeometry = !!route && route.coordinates.length > 1;

    if (
      !isNavigating ||
      !destination ||
      !userLocation ||
      !hasRoutedGeometry ||
      (routeStatus === "loading" && !isReloadingWithRoute) ||
      destination.longitude == null ||
      destination.latitude == null
    ) {
      applyRouteRef.current = null;
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
      travelMode === "driving"
        ? snapToRoute(userLocation, route.coordinates)
        : userLocation;

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

    // The last leg, drawn separately as dots.
    //
    // OSRM snaps the destination to the nearest routable way, so the fetched
    // geometry ends on the road rather than at the spot itself. Appending that
    // leg to the route line would draw it as if it were drivable road, so it
    // gets its own dotted layer instead: the pin stays on the real coordinate
    // and the dots read as "walk this last bit", the way maps apps show it.
    // The straight-line placeholder and the fallback route already end exactly
    // at the destination, so neither draws a connector.
    const exactDestination: [number, number] = [destination.longitude, destination.latitude];
    const lastDrawn = coordinates[coordinates.length - 1];
    const connectorCoordinates: [number, number][] | null =
      lastDrawn && (lastDrawn[0] !== exactDestination[0] || lastDrawn[1] !== exactDestination[1])
        ? [lastDrawn, exactDestination]
        : null;

    const routeData = {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates,
      },
      properties: {},
    };

    const connectorData = connectorCoordinates && {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: connectorCoordinates,
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
          paint: { "line-color": "#7A0019", "line-width": ROUTE_WIDTH, "line-opacity": 0.85 },
        });
      }

      // Unselected options, drawn beneath the chosen line.
      //
      // Inserted with route-line as the beforeId so map order puts them under
      // it: an alternative crossing the selected route must never appear to
      // interrupt it. Two layers per option set, a visible thin grey line and a
      // wide transparent one over it, because a 3px line is close to impossible
      // to hit with a thumb.
      const alternatives = (routeOptions ?? [])
        .map((option, index) => ({ option, index }))
        .filter(({ index }) => index !== selectedRouteIndex);

      if (alternatives.length === 0) {
        removeAlternativesLayer(map);
      } else {
        const altData = {
          type: "FeatureCollection" as const,
          features: alternatives.map(({ option, index }) => ({
            type: "Feature" as const,
            geometry: { type: "LineString" as const, coordinates: option.coordinates },
            properties: { optionIndex: index },
          })),
        };

        if (map.getSource("route-alternatives")) {
          (map.getSource("route-alternatives") as maplibregl.GeoJSONSource).setData(altData);
        } else {
          map.addSource("route-alternatives", { type: "geojson", data: altData });
          map.addLayer(
            {
              id: "route-alternatives-line",
              type: "line",
              source: "route-alternatives",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": ALT_COLOR,
                "line-width": ALT_WIDTH,
                "line-opacity": 0.75,
              },
            },
            "route-line",
          );
          map.addLayer(
            {
              id: "route-alternatives-hit",
              type: "line",
              source: "route-alternatives",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": ALT_COLOR, "line-width": 22, "line-opacity": 0 },
            },
            "route-line",
          );
        }
      }

      if (!connectorData) {
        // The route already reaches the destination, so any connector left over
        // from a previous position has to go.
        removeConnectorLayer(map);
        return;
      }

      if (map.getSource("route-connector")) {
        (map.getSource("route-connector") as maplibregl.GeoJSONSource).setData(connectorData);
      } else {
        map.addSource("route-connector", { type: "geojson", data: connectorData });
        map.addLayer({
          id: "route-connector-line",
          type: "line",
          source: "route-connector",
          // Round caps over a zero-length dash render as dots. The dash array is
          // in line-width units, so the dots scale with the zoom interpolation.
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#7A0019",
            "line-width": CONNECTOR_WIDTH,
            "line-opacity": 0.85,
            "line-dasharray": [0, 2],
          },
        });
      }
    };

    applyRouteRef.current = applyRoute;

    // Clear any draw still waiting on the style: it belongs to an older route
    // and would paint over this one.
    if (pendingDrawRef.current) {
      map.off("idle", pendingDrawRef.current);
      pendingDrawRef.current = null;
    }

    if (map.isStyleLoaded()) {
      applyRoute();
      return;
    }

    // The style is not ready yet. Waiting on "style.load" alone is not enough:
    // that event has usually already fired by the time a route arrives, and
    // nothing would fire it again, so the line sat undrawn until some unrelated
    // dependency changed. "idle" fires whenever the map finishes settling, so
    // the route paints at the first opportunity instead.
    const drawWhenReady = () => {
      pendingDrawRef.current = null;
      applyRouteRef.current?.();
    };
    pendingDrawRef.current = drawWhenReady;
    map.once("idle", drawWhenReady);

    return () => {
      if (pendingDrawRef.current === drawWhenReady) {
        map.off("idle", drawWhenReady);
        pendingDrawRef.current = null;
      }
    };
  }, [destination, isNavigating, map, route, routeStatus, travelMode, userLocation, routeOptions, selectedRouteIndex]);

  // Persistent listener covers both the initial style load and every setStyle() call.
  // Calling applyRouteRef.current is a no-op when navigation is inactive (ref is null).
  useEffect(() => {
    if (!map) return;
    const onStyleLoad = () => applyRouteRef.current?.();
    map.on("style.load", onStyleLoad);
    return () => { map.off("style.load", onStyleLoad); };
  }, [map]);

  // Tapping an alternative takes it.
  //
  // Bound once to the layer id rather than re-bound whenever the option set
  // changes: MapLibre resolves the id at dispatch time, so this keeps working
  // across the clear-and-rebuild in applyRoute, and there is never a window
  // where the line is drawn but not yet clickable. The index travels in the
  // feature's properties, so the handler needs no closure over the options.
  useEffect(() => {
    if (!map) return;

    const onClick = (event: maplibregl.MapLayerMouseEvent) => {
      const index = event.features?.[0]?.properties?.optionIndex;
      if (typeof index === "number") selectRoute(index);
    };
    const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { map.getCanvas().style.cursor = ""; };

    map.on("click", "route-alternatives-hit", onClick);
    map.on("mouseenter", "route-alternatives-hit", onEnter);
    map.on("mouseleave", "route-alternatives-hit", onLeave);

    return () => {
      map.off("click", "route-alternatives-hit", onClick);
      map.off("mouseenter", "route-alternatives-hit", onEnter);
      map.off("mouseleave", "route-alternatives-hit", onLeave);
    };
  }, [map, selectRoute]);

  useEffect(() => {
    return () => {
      if (map) removeRouteLayer(map);
    };
  }, [map]);

  return null;
}
