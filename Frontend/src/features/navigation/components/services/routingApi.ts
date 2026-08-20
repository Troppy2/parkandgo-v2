import polyline from "@mapbox/polyline";

// OSRM public demo server - free, no API key needed
// Separate endpoints per travel mode
const OSRM_BASE = {
  driving: "https://router.project-osrm.org/route/v1/driving",
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  cycling: "https://routing.openstreetmap.de/routed-bike/route/v1/bike",
};

// One attempt gets 4 seconds, and a request gets three attempts. A route that
// has not arrived in roughly nine seconds is not arriving, and the user is told
// so rather than left watching a spinner.
const ROUTE_ATTEMPTS = 3;
export const ROUTE_ATTEMPT_TIMEOUT_MS = 4000;
const ROUTE_RETRY_BACKOFF_MS = 400;

// How long a cached route is worth serving without asking the network again.
// Roads do not move, and re-picking a spot you just looked at should be instant.
const ROUTE_CACHE_TTL_MS = 5 * 60_000;

// How many options to ask OSRM for on a direct trip.
//
// Three is what fits the panel without the cards becoming a list to read. Note
// that OSRM guarantees nothing here: the driving profile usually returns two or
// three, while the foot and bike profiles routinely return one, because on a
// pedestrian network most detours are the same length. A campus walk showing no
// alternatives is the router being honest, not a bug.
const MAX_ALTERNATIVES = 3;

interface CachedRoute {
  // Every option OSRM returned, best first. Cached together because they come
  // from one request: serving the primary from cache and then re-fetching to
  // show the alternatives would pay for the same answer twice.
  routes: RouteResult[];
  at: number;
}

const ROUTE_CACHE = new Map<string, CachedRoute>();

// Requests currently in flight, keyed the same way as the cache, so two callers
// asking for the same route share one request instead of racing each other.
const IN_FLIGHT = new Map<string, Promise<RouteResult[]>>();

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

  if (modifier === "right") return "bi-arrow-90deg-right";
  if (modifier === "left") return "bi-arrow-90deg-left";
  if (modifier === "straight") return "bi-arrow-up";
  if (modifier === "slight right") return "bi-arrow-up-right";
  if (modifier === "slight left") return "bi-arrow-up-left";
  if (modifier === "sharp right") return "bi-arrow-90deg-right";
  if (modifier === "sharp left") return "bi-arrow-90deg-left";
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

// Every point goes into the key, intermediate stops included. Dropping them
// would let two different trips through the same endpoints share one entry.
//
// The origin keeps its looser 4dp rounding (roughly 11 metres) because it comes
// from live GPS and jitters; every point after it is a place the user picked, so
// those are exact to 5dp and a different stop is always a different key.
function buildCacheKey(
  points: [number, number][],
  mode: keyof typeof OSRM_BASE
): string {
  const parts = points.map(([lng, lat], i) => {
    const precision = i === 0 ? 4 : 5;
    return `${lng.toFixed(precision)},${lat.toFixed(precision)}`;
  });
  return [mode, ...parts].join(":");
}

function normalizeRoute(route: OSRMRoute): Pick<RouteResult, "coordinates" | "steps" | "totalDistanceMeters" | "totalDurationSeconds"> {
  const decoded = polyline.decode(route.geometry, 5);
  const coordinates: [number, number][] = decoded.map(([lat, lng]: [number, number]) => [lng, lat]);

  // Every leg, not just the first.
  //
  // OSRM splits the response at each waypoint, so a trip with one stop comes
  // back as two legs. Reading legs[0] alone reported the distance, duration and
  // turn list of the first leg as though it were the whole trip, which is
  // invisible until a stop exists and then quietly wrong.
  const steps: RouteStep[] = route.legs.flatMap((leg) =>
    leg.steps.map((step) => {
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
    })
  );

  return {
    coordinates,
    steps,
    totalDistanceMeters: route.legs.reduce((sum, leg) => sum + leg.distance, 0),
    totalDurationSeconds: route.legs.reduce((sum, leg) => sum + leg.duration, 0),
  };
}

export function clearRouteCache() {
  ROUTE_CACHE.clear();
  // In-flight promises are part of the cache from a caller's point of view: a
  // test that clears one and not the other still gets served the old answer.
  IN_FLIGHT.clear();
}

// Main function - call this when navigation starts
/**
 * Find which step in the route the user is closest to
 * Returns the index of the current step
 */
export function getNextStep(
  userLng: number,
  userLat: number,
  steps: RouteStep[]
): number {
  let closestIdx = 0;
  let closestDistance = Infinity;

  for (let i = 0; i < steps.length; i++) {
    const stepLoc = steps[i].location;
    const dist = haversineDistanceMiles(userLat, userLng, stepLoc[1], stepLoc[0]);
    if (dist < closestDistance) {
      closestDistance = dist;
      closestIdx = i;
    }
  }

  return closestIdx;
}

/**
 * Check if user is within arrival threshold (15 meters)
 * Returns true if user is close enough to destination to auto-end
 */
export function isUserNearArrival(
  userLng: number,
  userLat: number,
  destLng: number,
  destLat: number,
  thresholdMeters: number = 15
): boolean {
  const distanceMiles = haversineDistanceMiles(userLat, userLng, destLat, destLng);
  const distanceMeters = distanceMiles * 1609.34;
  return distanceMeters <= thresholdMeters;
}

/**
 * Slice a route to only include remaining steps from user's current position
 * Returns new RouteResult with remaining geometry and steps
 */
export function getRemainingRouteGeometry(
  route: RouteResult,
  userLng: number,
  userLat: number,
): RouteResult {
  const currentStepIdx = getNextStep(userLng, userLat, route.steps);

  // If already past all instructional steps, return route as-is
  if (currentStepIdx >= route.steps.length - 1) {
    return route;
  }

  // Find the coordinates closest to user location
  let closestCoordIdx = 0;
  let closestCoordDistance = Infinity;
  for (let i = 0; i < route.coordinates.length; i++) {
    const [lng, lat] = route.coordinates[i];
    const dist = haversineDistanceMiles(userLat, userLng, lat, lng);
    if (dist < closestCoordDistance) {
      closestCoordDistance = dist;
      closestCoordIdx = i;
    }
  }

  // Slice coordinates from closest point onward, prepend user location
  const remainingCoordinates = [
    [userLng, userLat] as [number, number],
    ...route.coordinates.slice(closestCoordIdx),
  ];

  // Include current step + all remaining steps
  const remainingSteps = route.steps.slice(currentStepIdx);

  // Recalculate distance and duration for remaining route
  let totalRemainingMeters = 0;
  let totalRemainingSeconds = 0;

  for (let i = currentStepIdx; i < route.steps.length; i++) {
    totalRemainingMeters += route.steps[i].distanceMeters;
    if (i < route.steps.length - 1) {
      // Estimate duration based on step distance
      const stepDurationSec = (route.steps[i].distanceMeters / route.totalDistanceMeters) * route.totalDurationSeconds;
      totalRemainingSeconds += stepDurationSec;
    }
  }

  return {
    coordinates: remainingCoordinates,
    steps: remainingSteps,
    totalDistanceMeters: totalRemainingMeters,
    totalDurationSeconds: Math.round(totalRemainingSeconds),
    source: route.source,
    notice: route.notice,
  };
}

export interface SnappedPosition {
  /** Nearest point on the polyline. */
  point: [number, number];
  /** Compass bearing of the segment that point landed on, degrees clockwise from north. */
  bearing: number;
}

/**
 * Snap [lng, lat] to the nearest point on a route polyline, and report the
 * bearing of the segment it landed on.
 *
 * Uses cosine(lat) correction so east-west distances scale correctly. The
 * bearing is what the navigation puck points at while driving: the raw GPS
 * heading swings wildly at walking pace and at a red light, while the road the
 * driver is on does not move at all.
 */
export function snapToRouteWithBearing(
  lngLat: [number, number],
  coordinates: [number, number][]
): SnappedPosition {
  if (coordinates.length === 0) return { point: lngLat, bearing: 0 };
  if (coordinates.length === 1) return { point: coordinates[0], bearing: 0 };

  const [pLng, pLat] = lngLat;
  const cosLat = Math.cos((pLat * Math.PI) / 180);

  let bestPoint: [number, number] = coordinates[0];
  let bestBearing = 0;
  let bestDistSq = Infinity;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [aLng, aLat] = coordinates[i];
    const [bLng, bLat] = coordinates[i + 1];

    const dx = (bLng - aLng) * cosLat;
    const dy = bLat - aLat;
    const px = (pLng - aLng) * cosLat;
    const py = pLat - aLat;

    const segLenSq = dx * dx + dy * dy;
    const t = segLenSq > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq)) : 0;

    const snapLng = aLng + t * (bLng - aLng);
    const snapLat = aLat + t * (bLat - aLat);

    const ex = (pLng - snapLng) * cosLat;
    const ey = pLat - snapLat;
    const distSq = ex * ex + ey * ey;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPoint = [snapLng, snapLat];
      // Degenerate segments (a repeated coordinate) carry no direction, so keep
      // whatever bearing the previous segment gave rather than snapping north.
      if (segLenSq > 0) {
        bestBearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
      }
    }
  }

  return { point: bestPoint, bearing: bestBearing };
}

/**
 * Snap [lng, lat] to the nearest point on a route polyline.
 * Thin wrapper over snapToRouteWithBearing so there is one snapping implementation.
 */
export function snapToRoute(
  lngLat: [number, number],
  coordinates: [number, number][]
): [number, number] {
  return snapToRouteWithBearing(lngLat, coordinates).point;
}

/**
 * Thrown when every attempt to route has failed and there is no cached route to
 * fall back on. Callers surface this to the user rather than drawing a straight
 * line: a line that ignores the roads is not directions, and offering one as if
 * it were is worse than saying routing is unavailable.
 */
export class RouteUnavailableError extends Error {
  constructor(message = "Could not load a route") {
    super(message);
    this.name = "RouteUnavailableError";
  }
}

async function requestRoutes(
  url: string
): Promise<Array<Pick<RouteResult, "coordinates" | "steps" | "totalDistanceMeters" | "totalDurationSeconds">>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ROUTE_ATTEMPT_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("OSRM request failed");

    const data = (await res.json()) as OSRMResponse;
    if (data.code !== "Ok" || !data.routes?.[0]) {
      throw new Error("OSRM returned no usable route");
    }

    // OSRM orders its routes best first, and that order is preserved all the
    // way to the cards in the panel.
    return data.routes.map(normalizeRoute);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Route through an ordered list of points: origin first, destination last, any
 * number of stops between them.
 *
 * OSRM already takes semicolon separated coordinates, so a trip with stops is
 * one request rather than one per leg. That matters for more than round trips:
 * routing each leg separately would let the router pick a different approach to
 * a stop than the one it leaves by, and the seams would show as backtracking.
 */
export async function fetchRoutesVia(
  points: [number, number][],
  mode: keyof typeof OSRM_BASE = "walking"
): Promise<RouteResult[]> {
  if (points.length < 2) {
    throw new RouteUnavailableError("A route needs a start and an end");
  }

  const cacheKey = buildCacheKey(points, mode);

  // Serve a fresh cache entry without touching the network. This is the whole
  // point of holding a cache: previously it was read only after a failure, so
  // re-picking a spot from ten seconds ago still paid full network latency.
  const cached = ROUTE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < ROUTE_CACHE_TTL_MS) {
    return cached.routes.map((route) => ({ ...route, source: "cache", notice: null }));
  }

  // Two callers asking for the same route share one request. Without this a
  // re-render mid-flight starts a second identical fetch and both pay for it.
  const existing = IN_FLIGHT.get(cacheKey);
  if (existing) return existing;

  const base = OSRM_BASE[mode];
  const coords = points.map(([lng, lat]) => `${lng},${lat}`).join(";");

  // Alternatives are asked for only on a direct trip. OSRM does not offer them
  // once there are waypoints in between, so sending the parameter on a trip
  // with stops would cost a longer URL for an answer that never varies.
  const wantsAlternatives = points.length === 2;
  const url =
    `${base}/${coords}?overview=full&geometries=polyline&steps=true` +
    (wantsAlternatives ? `&alternatives=${MAX_ALTERNATIVES}` : "");

  const attempt = (async () => {
    let lastError: unknown;

    for (let i = 0; i < ROUTE_ATTEMPTS; i++) {
      try {
        const normalized = await requestRoutes(url);
        const routes: RouteResult[] = normalized.map((route) => ({
          ...route,
          source: "network",
          notice: null,
        }));
        ROUTE_CACHE.set(cacheKey, { routes, at: Date.now() });
        return routes;
      } catch (err) {
        lastError = err;
        if (i < ROUTE_ATTEMPTS - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, ROUTE_RETRY_BACKOFF_MS));
        }
      }
    }

    // Stale but real geometry still beats failing: it was routed along actual
    // roads, and the only thing wrong with it is its age.
    if (cached) {
      return cached.routes.map((route) => ({
        ...route,
        source: "cache" as const,
        notice: "Using your last successful route while live routing catches up.",
      }));
    }

    throw new RouteUnavailableError(
      lastError instanceof Error ? lastError.message : "Could not load a route",
    );
  })();

  IN_FLIGHT.set(cacheKey, attempt);
  try {
    return await attempt;
  } finally {
    IN_FLIGHT.delete(cacheKey);
  }
}

/** The best route only, for callers with nothing to do with alternatives. */
export async function fetchRouteVia(
  points: [number, number][],
  mode: keyof typeof OSRM_BASE = "walking"
): Promise<RouteResult> {
  const [best] = await fetchRoutesVia(points, mode);
  return best;
}

// Main function - call this when navigation starts.
//
// The two point case, which is still every trip without stops. Kept as its own
// export so the many existing callers and their tests read the same as before.
export async function fetchRoute(
  userLng: number,
  userLat: number,
  destLng: number,
  destLat: number,
  mode: keyof typeof OSRM_BASE = "walking"
): Promise<RouteResult> {
  return fetchRouteVia(
    [
      [userLng, userLat],
      [destLng, destLat],
    ],
    mode
  );
}
