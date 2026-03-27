import polyline from "@mapbox/polyline";

// OSRM public demo server - free, no API key needed
// Separate endpoints per travel mode
const OSRM_BASE = {
  driving: "https://router.project-osrm.org/route/v1/driving",
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  cycling: "https://routing.openstreetmap.de/routed-bike/route/v1/bike",
};

const ROUTE_FETCH_TIMEOUT_MS = 4500;

const SPEED_MPH = {
  driving: 25,
  walking: 3,
  cycling: 10,
} as const;

const ROUTE_CACHE = new Map<string, RouteResult>();

interface OSRMStep {
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
  distance: number;
  duration: number;
  name: string;
}

interface OSRMRoute {
  geometry: string;
  legs: Array<{
    distance: number;
    duration: number;
    steps: OSRMStep[];
  }>;
}

interface OSRMResponse {
  code: string;
  routes?: OSRMRoute[];
}

export type RouteSource = "network" | "cache" | "fallback";

// The clean shape your components will work with
export interface RouteStep {
  instruction: string;
  distance: string;
  distanceMeters: number;
  maneuverType: string;
  maneuverModifier: string;
  icon: string;
  location: [number, number];
}

export interface RouteResult {
  coordinates: [number, number][];
  steps: RouteStep[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  source?: RouteSource;
  notice?: string | null;
}

// Convert maneuver type + modifier -> Bootstrap icon
function getManeuverIcon(type: string, modifier: string): string {
  if (type === "depart") return "bi-arrow-up-circle-fill";
  if (type === "arrive") return "bi-p-circle-fill";

  if (modifier === "right") return "bi-arrow-turn-right";
  if (modifier === "left") return "bi-arrow-turn-left";
  if (modifier === "straight") return "bi-arrow-up";
  if (modifier === "slight right") return "bi-arrow-up-right";
  if (modifier === "slight left") return "bi-arrow-up-left";
  if (modifier === "sharp right") return "bi-arrow-turn-right";
  if (modifier === "sharp left") return "bi-arrow-turn-left";
  if (modifier === "uturn") return "bi-arrow-return-left";
  return "bi-arrow-up";
}

function buildInstruction(type: string, modifier: string, streetName: string): string {
  const street = streetName || "the road";

  if (type === "depart") return `Head toward ${street}`;
  if (type === "arrive") return "You have arrived";
  if (type === "roundabout") return `Enter the roundabout, exit onto ${street}`;

  if (modifier === "right") return `Turn right on ${street}`;
  if (modifier === "left") return `Turn left on ${street}`;
  if (modifier === "straight") return `Continue straight on ${street}`;
  if (modifier === "slight right") return `Bear right on ${street}`;
  if (modifier === "slight left") return `Bear left on ${street}`;
  if (modifier === "sharp right") return `Sharp right on ${street}`;
  return `Continue on ${street}`;
}

function formatDistance(meters: number): string {
  if (meters < 160) {
    return `${Math.round(meters * 3.281)} ft`;
  }
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusMiles = 3959;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildFallbackRoute(
  userLng: number,
  userLat: number,
  destLng: number,
  destLat: number,
  mode: keyof typeof SPEED_MPH,
  notice: string
): RouteResult {
  const distanceMiles = haversineDistanceMiles(userLat, userLng, destLat, destLng);
  const totalDistanceMeters = distanceMiles * 1609.34;
  const totalDurationSeconds =
    Math.max(1, Math.round((distanceMiles / SPEED_MPH[mode]) * 3600));

  return {
    coordinates: [
      [userLng, userLat],
      [destLng, destLat],
    ],
    steps: [
      {
        instruction: "Head toward your destination",
        distance: formatDistance(totalDistanceMeters),
        distanceMeters: totalDistanceMeters,
        maneuverType: "depart",
        maneuverModifier: "straight",
        icon: "bi-arrow-up-circle-fill",
        location: [userLng, userLat],
      },
      {
        instruction: "You have arrived",
        distance: "0 ft",
        distanceMeters: 0,
        maneuverType: "arrive",
        maneuverModifier: "straight",
        icon: "bi-p-circle-fill",
        location: [destLng, destLat],
      },
    ],
    totalDistanceMeters,
    totalDurationSeconds,
    source: "fallback",
    notice,
  };
}

export function createDirectRoutePreview(
  userLng: number,
  userLat: number,
  destLng: number,
  destLat: number,
  mode: keyof typeof SPEED_MPH,
  notice = "Loading live turn-by-turn directions..."
): RouteResult {
  return buildFallbackRoute(userLng, userLat, destLng, destLat, mode, notice);
}

function buildCacheKey(
  userLng: number,
  userLat: number,
  destLng: number,
  destLat: number,
  mode: keyof typeof OSRM_BASE
): string {
  return [
    mode,
    userLng.toFixed(4),
    userLat.toFixed(4),
    destLng.toFixed(5),
    destLat.toFixed(5),
  ].join(":");
}

function normalizeRoute(route: OSRMRoute): Pick<RouteResult, "coordinates" | "steps" | "totalDistanceMeters" | "totalDurationSeconds"> {
  const decoded = polyline.decode(route.geometry, 5);
  const coordinates: [number, number][] = decoded.map(([lat, lng]: [number, number]) => [lng, lat]);

  const steps: RouteStep[] = route.legs[0].steps.map((step) => {
    const type = step.maneuver.type;
    const modifier = step.maneuver.modifier ?? "straight";
    const streetName = step.name;

    return {
      instruction: buildInstruction(type, modifier, streetName),
      distance: formatDistance(step.distance),
      distanceMeters: step.distance,
      maneuverType: type,
      maneuverModifier: modifier,
      icon: getManeuverIcon(type, modifier),
      location: step.maneuver.location,
    };
  });

  return {
    coordinates,
    steps,
    totalDistanceMeters: route.legs[0].distance,
    totalDurationSeconds: route.legs[0].duration,
  };
}

export function clearRouteCache() {
  ROUTE_CACHE.clear();
}

// Main function - call this when navigation starts
export async function fetchRoute(
  userLng: number,
  userLat: number,
  destLng: number,
  destLat: number,
  mode: keyof typeof OSRM_BASE = "walking"
): Promise<RouteResult> {
  const cacheKey = buildCacheKey(userLng, userLat, destLng, destLat, mode);
  const base = OSRM_BASE[mode];
  const coords = `${userLng},${userLat};${destLng},${destLat}`;
  const url = `${base}/${coords}?overview=full&geometries=polyline&steps=true`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ROUTE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("OSRM request failed");

    const data = (await res.json()) as OSRMResponse;
    if (data.code !== "Ok" || !data.routes?.[0]) {
      throw new Error("OSRM returned no usable route");
    }

    const normalized = normalizeRoute(data.routes[0]);
    const route: RouteResult = {
      ...normalized,
      source: "network",
      notice: null,
    };

    ROUTE_CACHE.set(cacheKey, route);
    return route;
  } catch (err) {
    const cached = ROUTE_CACHE.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        source: "cache",
        notice: "Using your last successful route while live routing catches up.",
      };
    }

    return buildFallbackRoute(
      userLng,
      userLat,
      destLng,
      destLat,
      mode,
      "Showing a simple direct route. Retry for turn-by-turn directions."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
