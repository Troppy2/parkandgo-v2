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
