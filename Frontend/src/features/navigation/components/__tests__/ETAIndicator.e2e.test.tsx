import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ETAIndicator from "../ETAIndicator";
import { useNavStore } from "../../../../store/navStore";
import {
  disableMockGeolocation,
  enableMockGeolocation,
  setMockLocation,
  UMN_TEST_LOCATIONS,
} from "../../../../lib/testing/mockGeolocation";
import type { ParkingSpot } from "../../../../types/parking.types";

const fetchRouteMock = vi.fn();

vi.mock("../services/routingApi", () => ({
  createDirectRoutePreview: (userLng: number, userLat: number, destLng: number, destLat: number) => ({
    coordinates: [
      [userLng, userLat],
      [destLng, destLat],
    ],
    steps: [
      {
        instruction: "Head toward your destination",
        distance: "0.5 mi",
        distanceMeters: 800,
        maneuverType: "depart",
        maneuverModifier: "straight",
        icon: "bi-arrow-up-circle-fill",
        location: [userLng, userLat],
      },
    ],
    totalDistanceMeters: 800,
    totalDurationSeconds: 600,
    source: "fallback",
    notice: "Loading live turn-by-turn directions...",
  }),
  fetchRoute: (...args: unknown[]) => fetchRouteMock(...args),
}));

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

describe("ETAIndicator", () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState());
    enableMockGeolocation();
    setMockLocation(UMN_TEST_LOCATIONS.eastBank);
    fetchRouteMock.mockReset();
    fetchRouteMock.mockResolvedValue({
      coordinates: [
        [-93.2277, 44.974],
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
    });
  });

  afterEach(() => {
    disableMockGeolocation();
    vi.clearAllMocks();
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
        -93.2277,
        44.974,
        fakeSpot.longitude,
        fakeSpot.latitude,
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
});
