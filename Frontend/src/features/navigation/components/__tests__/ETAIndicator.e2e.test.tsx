import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ETAIndicator from "../ETAIndicator";
import { useNavStore } from "../../../../store/navStore";
import { useUIStore } from "../../../../store/uiStore";
import {
  disableMockGeolocation,
  enableMockGeolocation,
  setMockLocation,
  UMN_TEST_LOCATIONS,
} from "../../../../lib/testing/mockGeolocation";
import type { ParkingSpot } from "../../../../types/parking.types";
import { ROUTE_ATTEMPT_TIMEOUT_MS } from "../services/routingApi";
import type { RouteResult } from "../services/routingApi";

const fetchRouteMock = vi.fn();
vi.mock("../services/routingApi", async () => {
  const actual = await vi.importActual("../services/routingApi");
  return {
    ...actual,
    // fetchRoutesVia is what ETAIndicator calls: it returns every option the
    // router offered, and the store selects the first. fetchRoute and
    // fetchRouteVia are still exported as the single-route faces of it, but the
    // component no longer goes through either, so mocking those would leave the
    // real network call in place here.
    fetchRoutesVia: (...args: unknown[]) => fetchRouteMock(...args),
  };
});

const fakeSpot: ParkingSpot = {
  spot_id: 1,
  spot_name: "East River Road",
  campus_location: "East Bank",
  parking_type: "Street Parking",
  cost: 1.5,
  walk_time: "10 min walk",
  near_buildings: "Science Library",
  address: "123 East River Road",
  latitude: 44.975,
  longitude: -93.22,
  is_verified: true,
  submitted_by: null,
  created_at: null,
};

const resolvedRoute: RouteResult = {
  coordinates: [
    [-93.2277, 44.974],
    [-93.2245, 44.9744],
    [-93.22, 44.975],
  ],
  steps: [
    {
      instruction: "Head toward East River Road",
      distance: "0.3 mi",
      distanceMeters: 500,
      maneuverType: "depart",
      maneuverModifier: "straight",
      icon: "bi-arrow-up-circle-fill",
      location: [-93.2277, 44.974],
    },
    {
      instruction: "Turn right on East River Road",
      distance: "0.1 mi",
      distanceMeters: 160,
      maneuverType: "turn",
      maneuverModifier: "right",
      icon: "bi-arrow-90deg-right",
      location: [-93.2245, 44.9744],
    },
    {
      instruction: "You have arrived",
      distance: "0 ft",
      distanceMeters: 0,
      maneuverType: "arrive",
      maneuverModifier: "straight",
      icon: "bi-p-circle-fill",
      location: [-93.22, 44.975],
    },
  ],
  totalDistanceMeters: 500,
  totalDurationSeconds: 900,
  source: "network",
  notice: null,
};

describe("ETAIndicator", () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState());
    enableMockGeolocation();
    setMockLocation(UMN_TEST_LOCATIONS.eastBank);
    fetchRouteMock.mockReset();
    fetchRouteMock.mockResolvedValue([resolvedRoute]);
    useUIStore.setState({ toasts: [] });
  });

  afterEach(() => {
    disableMockGeolocation();
    vi.clearAllMocks();
  });

  // fetchRoute has already retried by the time it rejects, so this is the end of
  // the line. The user gets told plainly rather than handed a straight line
  // through the buildings and left to work out that it is not a real route.
  it("toasts when routing has failed for good", async () => {
    fetchRouteMock.mockRejectedValue(new Error("route unavailable"));

    useNavStore.getState().setCurrentUserLocation({ coords: [-93.2277, 44.974], heading: 0 });
    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().beginNavigation();

    await waitFor(() => {
      expect(useNavStore.getState().routeStatus).toBe("error");
    });

    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe("error");
    expect(toasts[0].message).toMatch(/couldn't calculate a route/i);
    expect(useNavStore.getState().route).toBeNull();
  });

  it("warns that a slow route is still coming, but only before Start", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchRouteMock.mockImplementation(() => new Promise<RouteResult[]>(() => {}));

    useNavStore.getState().setCurrentUserLocation({ coords: [-93.2277, 44.974], heading: 0 });
    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    await waitFor(() => expect(fetchRouteMock).toHaveBeenCalled());

    await act(async () => {
      vi.advanceTimersByTime(ROUTE_ATTEMPT_TIMEOUT_MS + 50);
    });

    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    // Progress, not failure: a red toast here would report a problem that has
    // not happened yet.
    expect(toasts[0].type).toBe("info");

    vi.useRealTimers();
  });

  it("leaves the slow-route notice to the TurnByTurn header once guidance is running", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchRouteMock.mockImplementation(() => new Promise<RouteResult[]>(() => {}));

    useNavStore.getState().setCurrentUserLocation({ coords: [-93.2277, 44.974], heading: 0 });
    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().beginNavigation();
    await waitFor(() => expect(fetchRouteMock).toHaveBeenCalled());

    await act(async () => {
      vi.advanceTimersByTime(ROUTE_ATTEMPT_TIMEOUT_MS + 50);
    });

    // TurnByTurn already shows "Calculating your route" with a spinner, so a
    // toast on top of it is the same news twice.
    expect(useUIStore.getState().toasts).toHaveLength(0);

    vi.useRealTimers();
  });

  it("uses the already watched location before asking for a fresh GPS fix", async () => {
    const getCurrentPositionSpy = vi.spyOn(navigator.geolocation, "getCurrentPosition");

    useNavStore.getState().setCurrentUserLocation({
      coords: [-93.2277, 44.974],
      heading: 0,
    });

    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().beginNavigation();

    await waitFor(() => {
      expect(fetchRouteMock).toHaveBeenCalledWith(
        [
          [-93.2277, 44.974],
          [fakeSpot.longitude, fakeSpot.latitude],
        ],
        "walking"
      );
    });

    expect(getCurrentPositionSpy).not.toHaveBeenCalled();
  });

  it("stores a route error when geolocation cannot be resolved", async () => {
    disableMockGeolocation();

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({
            code: 1,
            message: "blocked",
            PERMISSION_DENIED: 1,
          } as GeolocationPositionError);
        },
      },
    });

    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().beginNavigation();

    await waitFor(() => {
      expect(useNavStore.getState().routeStatus).toBe("error");
      expect(useNavStore.getState().routeError).toMatch(/couldn't get your location/i);
    });
  });

  it("keeps the route empty while the live route request is still loading", async () => {
    let resolveRoute: ((routes: RouteResult[]) => void) | null = null;
    fetchRouteMock.mockImplementationOnce(
      () =>
        new Promise<RouteResult[]>((resolve) => {
          resolveRoute = resolve;
        })
    );

    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().beginNavigation();

    await waitFor(() => {
      expect(fetchRouteMock).toHaveBeenCalledOnce();
    });

    expect(useNavStore.getState().route).toBeNull();
    expect(useNavStore.getState().routeStatus).not.toBe("ready");

    resolveRoute!([resolvedRoute]);

    await waitFor(() => {
      expect(useNavStore.getState().routeStatus).toBe("ready");
      expect(useNavStore.getState().route).toEqual(resolvedRoute);
    });
  });

  it("updates live stats from the dedicated navigation watch like the legacy app", async () => {
    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().beginNavigation();

    await waitFor(() => {
      expect(useNavStore.getState().distanceRemainingMiles).not.toBeNull();
      expect(useNavStore.getState().etaMinutes).not.toBeNull();
      expect(useNavStore.getState().routeStatus).toBe("ready");
    });
  });

  it("jumps directly to the closest route step as the user moves", async () => {
    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().beginNavigation();

    await waitFor(() => {
      expect(useNavStore.getState().routeStatus).toBe("ready");
    });

    expect(useNavStore.getState().currentStepIndex).toBe(0);

    useNavStore.getState().setCurrentUserLocation({
      coords: resolvedRoute.steps[2].location,
      heading: 0,
    });

    await waitFor(() => {
      expect(useNavStore.getState().currentStepIndex).toBe(2);
    });
  });
  // ── Trips with stops ──

  const stopPlace = {
    ...fakeSpot,
    spot_id: 42,
    spot_name: "Church Street Garage",
    latitude: 44.9745,
    longitude: -93.2355,
  };

  it("routes through every stop, in order", async () => {
    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().addStop(stopPlace);

    await waitFor(() => {
      expect(fetchRouteMock).toHaveBeenLastCalledWith(
        [
          [-93.2277, 44.974],
          [stopPlace.longitude, stopPlace.latitude],
          [fakeSpot.longitude, fakeSpot.latitude],
        ],
        "walking"
      );
    });
  });

  // The guard that skips an already-launched request used to key on the
  // destination id alone. Reordering two stops changes neither the id nor the
  // travel mode, so without the stops in the key the map would go on showing a
  // route the panel no longer describes.
  it("refetches when the stops are reordered under an unchanged destination", async () => {
    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().addStop(stopPlace);
    useNavStore.getState().addStop({ ...stopPlace, spot_id: 43, longitude: -93.24 });

    await waitFor(() => expect(fetchRouteMock).toHaveBeenCalled());
    const before = fetchRouteMock.mock.calls.length;

    useNavStore.getState().moveStop(0, 1);

    await waitFor(() => {
      expect(fetchRouteMock.mock.calls.length).toBeGreaterThan(before);
    });

    const [points] = fetchRouteMock.mock.calls.at(-1) as [Array<[number, number]>];
    expect(points[1][0]).toBe(-93.24);
  });

  it("starts from an explicit origin without asking for a GPS fix", async () => {
    const getCurrentPositionSpy = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    render(<ETAIndicator />);

    useNavStore.getState().startNavigation(fakeSpot);
    useNavStore.getState().setOrigin({
      ...stopPlace,
      spot_id: 44,
      latitude: 44.98,
      longitude: -93.25,
    });

    await waitFor(() => {
      expect(fetchRouteMock).toHaveBeenLastCalledWith(
        [
          [-93.25, 44.98],
          [fakeSpot.longitude, fakeSpot.latitude],
        ],
        "walking"
      );
    });

    expect(getCurrentPositionSpy).not.toHaveBeenCalled();
  });
});
