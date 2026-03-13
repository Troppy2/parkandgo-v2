import { useEffect } from "react"
import maplibregl from "maplibre-gl"
import { useNavStore } from "../../../store/navStore"

interface RouteLayerProps {
  map: maplibregl.Map | null
  userLocation: [number, number] | null  // [lng, lat]
}

export default function RouteLayer({ map, userLocation }: RouteLayerProps) {
  const { isNavigating, destination, route } = useNavStore()

  useEffect(() => {
    if (!map || !isNavigating || !destination || !userLocation) return
    if (!destination.longitude || !destination.latitude) return

    const drawRoute = () => {
      const coordinates: [number, number][] = route?.coordinates ?? [
        userLocation,
        [destination.longitude!, destination.latitude!],
      ]

      const routeData = {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates,
        },
        properties: {},
      }

      if (map.getSource("route")) {
        (map.getSource("route") as maplibregl.GeoJSONSource).setData(routeData)
      } else {
        map.addSource("route", { type: "geojson", data: routeData })
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#7A0019", "line-width": 4, "line-opacity": 0.85 },
        })
      }
    }

    if (map.isStyleLoaded()) {
      drawRoute()
    } else {
      map.once("load", drawRoute)
    }

    return () => {
      if (!map) return
      if (map.getLayer("route-line")) map.removeLayer("route-line")
      if (map.getSource("route")) map.removeSource("route")
    }
  }, [map, isNavigating, destination, userLocation, route])

  return null
}
