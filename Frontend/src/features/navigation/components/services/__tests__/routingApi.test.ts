import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRouteCache, fetchRoute } from "../routingApi";

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
