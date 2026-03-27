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

export default function RouteLayer({ map, userLocation }: RouteLayerProps) {
  const { isNavigating, destination, route } = useNavStore();

  useEffect(() => {
    if (!map) return;

    if (
      !isNavigating ||
      !destination ||
      !userLocation ||
      destination.longitude == null ||
      destination.latitude == null
    ) {
      removeRouteLayer(map);
      return;
    }

    const coordinates: [number, number][] = route?.coordinates ?? [
      userLocation,
      [destination.longitude, destination.latitude],
    ];

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
  }, [destination, isNavigating, map, route, userLocation]);

  useEffect(() => {
    return () => {
      if (map) removeRouteLayer(map);
    };
  }, [map]);

  return null;
}
