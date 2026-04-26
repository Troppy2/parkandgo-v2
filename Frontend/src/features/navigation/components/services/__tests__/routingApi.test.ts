import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRouteCache, fetchRoute, snapToRoute } from "../routingApi";

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

describe("routingApi", () => {
  beforeEach(() => {
    clearRouteCache();
    vi.restoreAllMocks();
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

  it("falls back to the cached route if a later fetch fails", async () => {
    const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => okResponse,
      }));

    vi.stubGlobal("fetch", fetchMock);

    await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const cached = await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");

    expect(cached.source).toBe("cache");
    expect(cached.notice).toMatch(/last successful route/i);
  });

  it("returns a direct fallback route when no live or cached route is available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("timeout");
    }));

    const result = await fetchRoute(-93.2277, 44.974, -93.22, 44.975, "walking");

    expect(result.source).toBe("fallback");
    expect(result.coordinates).toEqual([
      [-93.2277, 44.974],
      [-93.22, 44.975],
    ]);
    expect(result.notice).toMatch(/simple direct route/i);
  });
});

describe("snapToRoute", () => {
  it("returns coords unchanged when the route has fewer than 2 points", () => {
    expect(snapToRoute([-93.23, 44.97], [])).toEqual([-93.23, 44.97]);
    expect(snapToRoute([-93.23, 44.97], [[-93.23, 44.97]])).toEqual([-93.23, 44.97]);
  });

  it("snaps a point that lies exactly on a segment endpoint", () => {
    const route: [number, number][] = [[-93.230, 44.970], [-93.220, 44.970]];
    // The point is the first endpoint itself
    expect(snapToRoute([-93.230, 44.970], route)).toEqual([-93.230, 44.970]);
  });

  it("snaps a point that is off the road to the nearest segment", () => {
    // Horizontal segment from (0,0) to (1,0); point is at (0.5, 1) — should snap to (0.5, 0)
    const route: [number, number][] = [[0, 0], [1, 0]];
    const snapped = snapToRoute([0.5, 1], route);
    expect(snapped[0]).toBeCloseTo(0.5, 5);
    expect(snapped[1]).toBeCloseTo(0, 5);
  });

  it("clamps to the nearest endpoint when the projection falls outside the segment", () => {
    // Segment from (0,0) to (1,0); point at (-1, 0) should clamp to (0,0)
    const route: [number, number][] = [[0, 0], [1, 0]];
    const snapped = snapToRoute([-1, 0], route);
    expect(snapped[0]).toBeCloseTo(0, 5);
    expect(snapped[1]).toBeCloseTo(0, 5);
  });

  it("picks the closest segment when the route has multiple segments", () => {
    // L-shaped route: (0,0)→(1,0)→(1,1); point at (0.6, 0.6) is closer to vertical segment
    const route: [number, number][] = [[0, 0], [1, 0], [1, 1]];
    const snapped = snapToRoute([0.6, 0.6], route);
    // Closest point on (1,0)→(1,1) is (1, 0.6)
    expect(snapped[0]).toBeCloseTo(1, 5);
    expect(snapped[1]).toBeCloseTo(0.6, 5);
  });
});
