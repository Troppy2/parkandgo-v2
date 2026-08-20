import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRouteCache,
  fetchRoute,
  fetchRouteVia,
  fetchRoutesVia,
  RouteUnavailableError,
  snapToRoute,
  snapToRouteWithBearing,
} from "../routingApi";

vi.mock("@mapbox/polyline", () => ({
  default: {
    decode: vi.fn(() => [
      [44.974, -93.2277],
      [44.975, -93.22],
    ]),
  },
}));

const okResponse = {
  code: "Ok",
  routes: [
    {
      geometry: "mock-polyline",
      legs: [
        {
          distance: 500,
          duration: 120,
          steps: [
            {
              maneuver: {
                type: "depart",
                modifier: "straight",
                location: [-93.2277, 44.974],
              },
              distance: 500,
              duration: 120,
              name: "East River Road",
            },
            {
              maneuver: {
                type: "arrive",
                modifier: "straight",
                location: [-93.22, 44.975],
              },
              distance: 0,
              duration: 0,
              name: "",
            },
          ],
        },
      ],
    },
  ],
};

// A trip with one stop. OSRM splits the response at each waypoint, so this is
// what any route through a stop looks like: two legs, each with its own
// distance, duration, and step list.
const twoLegResponse = {
  code: "Ok",
  routes: [
    {
      geometry: "mock-polyline",
      legs: [
        {
          distance: 500,
          duration: 120,
          steps: [
            {
              maneuver: { type: "depart", modifier: "straight", location: [-93.2277, 44.974] },
              distance: 500,
              duration: 120,
              name: "East River Road",
            },
          ],
        },
        {
          distance: 300,
          duration: 90,
          steps: [
            {
              maneuver: { type: "turn", modifier: "left", location: [-93.225, 44.9745] },
              distance: 300,
              duration: 90,
              name: "Washington Avenue",
            },
            {
              maneuver: { type: "arrive", modifier: "straight", location: [-93.22, 44.975] },
              distance: 0,
              duration: 0,
              name: "",
            },
          ],
        },
      ],
    },
  ],
};

// The navigation puck points along the road rather than along the raw GPS
// heading, which swings wildly at a red light. That direction comes from the
// bearing of the segment the position snapped to.
describe("snapToRouteWithBearing", () => {
  it("reports an eastbound segment as 90 degrees", () => {
    const { bearing } = snapToRouteWithBearing(
      [-93.23, 44.9705],
      [
        [-93.24, 44.97],
        [-93.22, 44.97],
      ],
    );

    expect(bearing).toBeCloseTo(90, 1);
  });

  it("reports a northbound segment as 0 degrees", () => {
    const { bearing } = snapToRouteWithBearing(
      [-93.2405, 44.975],
      [
        [-93.24, 44.97],
        [-93.24, 44.98],
      ],
    );

    expect(bearing).toBeCloseTo(0, 1);
  });

  it("reports a westbound segment as 270 degrees, never as a negative angle", () => {
    const { bearing } = snapToRouteWithBearing(
      [-93.23, 44.9705],
      [
        [-93.22, 44.97],
        [-93.24, 44.97],
      ],
    );

    expect(bearing).toBeCloseTo(270, 1);
  });

  it("takes the bearing of the segment the user actually snapped to", () => {
    // An L: east along the bottom, then north up the right side. A user beside
    // the northbound leg must not be handed the eastbound bearing.
    const route: [number, number][] = [
      [-93.24, 44.97],
      [-93.22, 44.97],
      [-93.22, 44.98],
    ];

    expect(snapToRouteWithBearing([-93.2205, 44.978], route).bearing).toBeCloseTo(0, 1);
    expect(snapToRouteWithBearing([-93.23, 44.9705], route).bearing).toBeCloseTo(90, 1);
  });

  it("returns the same point snapToRoute does", () => {
    const route: [number, number][] = [
      [-93.24, 44.97],
      [-93.22, 44.97],
    ];
    const user: [number, number] = [-93.23, 44.98];

    expect(snapToRouteWithBearing(user, route).point).toEqual(snapToRoute(user, route));
  });
});

describe("snapToRoute", () => {
  it("returns user position when coordinates array is empty", () => {
    expect(snapToRoute([-93.23, 44.97], [])).toEqual([-93.23, 44.97]);
  });

  it("returns the single coordinate when route has one point", () => {
    expect(snapToRoute([-93.23, 44.97], [[-93.22, 44.97]])).toEqual([-93.22, 44.97]);
  });

  it("snaps point perpendicular to segment midpoint", () => {
    // Horizontal segment from A to B, user is directly above midpoint
    const A: [number, number] = [-93.24, 44.97];
    const B: [number, number] = [-93.22, 44.97];
    const user: [number, number] = [-93.23, 44.98]; // north of midpoint

    const [snapLng, snapLat] = snapToRoute(user, [A, B]);
    expect(snapLng).toBeCloseTo(-93.23, 4);
    expect(snapLat).toBeCloseTo(44.97, 4);
  });

  it("clamps to nearest endpoint when user is past end of segment", () => {
    const A: [number, number] = [-93.24, 44.97];
    const B: [number, number] = [-93.22, 44.97];
    const user: [number, number] = [-93.20, 44.97]; // east of B

    const snapped = snapToRoute(user, [A, B]);
    expect(snapped[0]).toBeCloseTo(B[0], 4);
    expect(snapped[1]).toBeCloseTo(B[1], 4);
  });

  it("picks the closest segment when route has multiple segments", () => {
    const coords: [number, number][] = [
      [-93.26, 44.97],
      [-93.24, 44.97],
      [-93.22, 44.97],
    ];
    // User is close to the second segment
    const user: [number, number] = [-93.23, 44.975];

    const [, snapLat] = snapToRoute(user, coords);
    // Snapped lat should be on the route (44.97), not the user lat (44.975)
    expect(snapLat).toBeCloseTo(44.97, 4);
  });
});

describe("routingApi", () => {
  beforeEach(() => {
    clearRouteCache();
    vi.restoreAllMocks();
    // Real timers by default: the retry backoff is a real wait, and only the
    // cache-expiry test needs to move the clock.
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns and caches a successful live route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => okResponse,
    })));

    const result = await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");

    expect(result.source).toBe("network");
    expect(result.notice).toBeNull();
    expect(result.steps).toHaveLength(2);
  });

  it("serves a fresh cached route without touching the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => okResponse }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");
    const again = await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");

    // The cache existed before but was read only after a failure, so re-picking
    // a spot from ten seconds ago still paid full network latency.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.source).toBe("cache");
    expect(again.notice).toBeNull();
  });

  it("shares one request between concurrent callers", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => okResponse }));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking"),
      fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.coordinates).toEqual(b.coordinates);
  });

  it("retries a failed attempt instead of giving up on the first one", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network hiccup"))
      .mockResolvedValue({ ok: true, json: async () => okResponse });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("network");
  });

  it("falls back to a stale cached route once every attempt has failed", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => okResponse }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");

    // Push the cached entry past its freshness window so the next call has to
    // go to the network, and fail it there.
    vi.setSystemTime(Date.now() + 10 * 60_000);
    fetchMock.mockRejectedValue(new Error("network down"));

    const cached = await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");

    // Stale geometry was still routed along real roads, which is the one case
    // where an old answer beats no answer.
    expect(cached.source).toBe("cache");
    expect(cached.notice).toMatch(/last successful route/i);

    vi.useRealTimers();
  });

  it("rejects rather than inventing a straight line when routing is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("timeout");
    }));

    await expect(
      fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking"),
    ).rejects.toBeInstanceOf(RouteUnavailableError);
  });

  // The whole trip, not just its first leg. Reading legs[0] alone was correct
  // only while a trip could not have stops, and would understate every routed
  // distance and ETA the moment one did, without failing anywhere visible.
  it("sums distance and duration across every leg of a trip with stops", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => twoLegResponse,
    })));

    const result = await fetchRouteVia(
      [
        [-93.2277, 44.974],
        [-93.225, 44.9745],
        [-93.22, 44.975],
      ],
      "walking",
    );

    expect(result.totalDistanceMeters).toBe(800);
    expect(result.totalDurationSeconds).toBe(210);
  });

  it("concatenates the turn list across legs in travel order", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => twoLegResponse,
    })));

    const result = await fetchRouteVia(
      [
        [-93.2277, 44.974],
        [-93.225, 44.9745],
        [-93.22, 44.975],
      ],
      "walking",
    );

    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((step) => step.maneuverType)).toEqual([
      "depart",
      "turn",
      "arrive",
    ]);
  });

  it("puts every stop in the request URL", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => twoLegResponse }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRouteVia(
      [
        [-93.2277, 44.974],
        [-93.225, 44.9745],
        [-93.22, 44.975],
      ],
      "walking",
    );

    // vi.fn() with no declared params types its calls as [], so the URL has
    // to be reclaimed explicitly.
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("-93.2277,44.974;-93.225,44.9745;-93.22,44.975");
  });

  // Two trips between the same endpoints are different trips if they stop in
  // different places. Keying on the endpoints alone would serve one the other's
  // route from cache.
  it("does not share a cache entry between trips with different stops", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => twoLegResponse }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRouteVia(
      [
        [-93.2277, 44.974],
        [-93.225, 44.9745],
        [-93.22, 44.975],
      ],
      "walking",
    );
    await fetchRouteVia(
      [
        [-93.2277, 44.974],
        [-93.226, 44.9748],
        [-93.22, 44.975],
      ],
      "walking",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a trip with fewer than two points", async () => {
    await expect(fetchRouteVia([[-93.2277, 44.974]], "walking")).rejects.toBeInstanceOf(
      RouteUnavailableError,
    );
  });
  // ── Alternatives ──

  const twoOptionResponse = {
    code: "Ok",
    routes: [
      okResponse.routes[0],
      {
        geometry: "mock-polyline",
        legs: [
          {
            distance: 700,
            duration: 200,
            steps: okResponse.routes[0].legs[0].steps,
          },
        ],
      },
    ],
  };

  it("returns every option the router offered, best first", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => twoOptionResponse })));

    const routes = await fetchRoutesVia(
      [
        [-93.2277, 44.974],
        [-93.22, 44.975],
      ],
      "driving",
    );

    expect(routes).toHaveLength(2);
    expect(routes[0].totalDurationSeconds).toBe(120);
    expect(routes[1].totalDurationSeconds).toBe(200);
  });

  it("asks for alternatives on a direct trip", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => twoOptionResponse }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRoutesVia(
      [
        [-93.2277, 44.974],
        [-93.22, 44.975],
      ],
      "driving",
    );

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("alternatives=");
  });

  // OSRM does not offer alternatives once there are waypoints in between, so
  // sending the parameter would lengthen the URL for an answer that never varies.
  it("does not ask for alternatives on a trip with stops", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => twoLegResponse }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRoutesVia(
      [
        [-93.2277, 44.974],
        [-93.225, 44.9745],
        [-93.22, 44.975],
      ],
      "walking",
    );

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).not.toContain("alternatives=");
  });

  it("caches the whole option set, not just the chosen route", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => twoOptionResponse }));
    vi.stubGlobal("fetch", fetchMock);

    const points: [number, number][] = [
      [-93.2277, 44.974],
      [-93.22, 44.975],
    ];
    await fetchRoutesVia(points, "driving");
    const again = await fetchRoutesVia(points, "driving");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again).toHaveLength(2);
    expect(again[0].source).toBe("cache");
  });

  it("fetchRouteVia still hands back the single best route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => twoOptionResponse })));

    const best = await fetchRouteVia(
      [
        [-93.2277, 44.974],
        [-93.22, 44.975],
      ],
      "driving",
    );

    expect(best.totalDurationSeconds).toBe(120);
  });
});
