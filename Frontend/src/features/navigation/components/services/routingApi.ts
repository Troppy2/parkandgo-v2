import polyline from "@mapbox/polyline"

// OSRM public demo server — free, no API key needed
// Separate endpoints per travel mode
const OSRM_BASE = {
  driving: "https://router.project-osrm.org/route/v1/driving",
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  cycling: "https://routing.openstreetmap.de/routed-bike/route/v1/bike",
}

// The clean shape your components will work with
export interface RouteStep {
  instruction: string          // "Turn right on Oak St SE"
  distance: string             // "200 ft" or "0.3 mi"
  distanceMeters: number       // raw number for ETA math
  maneuverType: string         // "turn", "depart", "arrive", etc.
  maneuverModifier: string     // "left", "right", "straight", etc.
  icon: string                 // Bootstrap icon class name
  location: [number, number]   // [lng, lat] where this step starts
}

export interface RouteResult {
  coordinates: [number, number][]   // decoded polyline for MapLibre
  steps: RouteStep[]
  totalDistanceMeters: number
  totalDurationSeconds: number
}

// Convert maneuver type + modifier → Bootstrap icon
// This is what V1 was missing — the icon mapping
function getManeuverIcon(type: string, modifier: string): string {
  if (type === "depart") return "bi-arrow-up-circle-fill"
  if (type === "arrive") return "bi-p-circle-fill"

  if (modifier === "right") return "bi-arrow-turn-right"
  if (modifier === "left") return "bi-arrow-turn-left"
  if (modifier === "straight") return "bi-arrow-up"
  if (modifier === "slight right") return "bi-arrow-up-right"
  if (modifier === "slight left") return "bi-arrow-up-left"
  if (modifier === "sharp right") return "bi-arrow-turn-right"
  if (modifier === "sharp left") return "bi-arrow-turn-left"
  if (modifier === "uturn") return "bi-arrow-return-left"
  return "bi-arrow-up"
}

// Convert OSRM maneuver → human readable instruction string
function buildInstruction(type: string, modifier: string, streetName: string): string {
  const street = streetName || "the road"

  if (type === "depart") return `Head toward ${street}`
  if (type === "arrive") return "You have arrived"
  if (type === "roundabout") return `Enter the roundabout, exit onto ${street}`

  if (modifier === "right") return `Turn right on ${street}`
  if (modifier === "left") return `Turn left on ${street}`
  if (modifier === "straight") return `Continue straight on ${street}`
  if (modifier === "slight right") return `Bear right on ${street}`
  if (modifier === "slight left") return `Bear left on ${street}`
  if (modifier === "sharp right") return `Sharp right on ${street}`
  return `Continue on ${street}`
}

// Format raw meters into human-readable distance
function formatDistance(meters: number): string {
  if (meters < 160) {
    // Under ~0.1 mi, show feet
    return `${Math.round(meters * 3.281)} ft`
  }
  const miles = meters / 1609.34
  return `${miles.toFixed(1)} mi`
}

// Main function — call this when navigation starts
export async function fetchRoute(
  userLng: number,
  userLat: number,
  destLng: number,
  destLat: number,
  mode: "driving" | "walking" | "cycling" = "walking"
): Promise<RouteResult | null> {
  try {
    const base = OSRM_BASE[mode]
    // OSRM coordinate format: lng,lat (note: longitude first)
    const coords = `${userLng},${userLat};${destLng},${destLat}`
    const url = `${base}/${coords}?overview=full&geometries=polyline&steps=true`

    const res = await fetch(url)
    if (!res.ok) throw new Error("OSRM request failed")

    const data = await res.json()
    if (data.code !== "Ok" || !data.routes?.[0]) return null

    const route = data.routes[0]

    // Decode the polyline — comes back as [lat, lng] pairs
    // MapLibre needs [lng, lat], so we swap them
    const decoded = polyline.decode(route.geometry, 5)
    const coordinates: [number, number][] = decoded.map(
      ([lat, lng]) => [lng, lat]
    )

    // Convert each OSRM step into a clean RouteStep
    const steps: RouteStep[] = route.legs[0].steps.map((step: any) => {
      const type = step.maneuver.type
      const modifier = step.maneuver.modifier ?? "straight"
      const streetName = step.name

      return {
        instruction: buildInstruction(type, modifier, streetName),
        distance: formatDistance(step.distance),
        distanceMeters: step.distance,
        maneuverType: type,
        maneuverModifier: modifier,
        icon: getManeuverIcon(type, modifier),
        location: step.maneuver.location as [number, number],
      }
    })

    return {
      coordinates,
      steps,
      totalDistanceMeters: route.legs[0].distance,
      totalDurationSeconds: route.legs[0].duration,
    }
  } catch (err) {
    console.error("Routing error:", err)
    return null
  }
}