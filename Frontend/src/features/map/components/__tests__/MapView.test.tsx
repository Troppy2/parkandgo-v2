import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapView from "../MapView";
import { useNavStore } from "../../../../store/navStore";
import { useUIStore } from "../../../../store/uiStore";
import type { ParkingSpot } from "../../../../types/parking.types";

const { routeLayerMock } = vi.hoisted(() => ({
  routeLayerMock: vi.fn(() => null),
}));

const flyToMock = vi.fn();
const watchPositionMock = vi.fn();
const getCurrentPositionMock = vi.fn();
const clearWatchMock = vi.fn();

vi.mock("../../../events/hooks/useEvents", () => ({
  useEvents: () => ({ data: undefined }),
}));

vi.mock("../RouteLayer", () => ({
  default: routeLayerMock,
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    flyTo = flyToMock;
    zoomIn = vi.fn();
    zoomOut = vi.fn();
    remove = vi.fn();
    setStyle = vi.fn();
    setPitch = vi.fn();
    setBearing = vi.fn();
    once = vi.fn();
    getStyle = vi.fn(() => ({ layers: [] }));
    addLayer = vi.fn();
    addSource = vi.fn();
    getSource = vi.fn(() => null);
    getLayer = vi.fn(() => null);
    removeLayer = vi.fn();
    removeSource = vi.fn();
    isStyleLoaded = vi.fn(() => true);
  }

  class MockMarker {
    setLngLat = vi.fn(() => this);
    setPopup = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn();
  }

  class MockPopup {
    setHTML = vi.fn(() => this);
  }

  return {
    default: {
      Map: MockMap,
      Marker: MockMarker,
      Popup: MockPopup,
    },
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

function createPosition(longitude: number, latitude: number, heading = 0): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading,
      speed: null,
      toJSON() {
        return {
          latitude: this.latitude,
          longitude: this.longitude,
          accuracy: this.accuracy,
          altitude: this.altitude,
          altitudeAccuracy: this.altitudeAccuracy,
          heading: this.heading,
          speed: this.speed,
        };
      },
    } as GeolocationCoordinates,
    timestamp: Date.now(),
    toJSON() {
      return {
        coords: this.coords.toJSON(),
        timestamp: this.timestamp,
      };
    },
  };
}

describe("MapView navigation camera", () => {
  beforeEach(() => {
    cleanup();
    flyToMock.mockReset();
    watchPositionMock.mockReset();
    getCurrentPositionMock.mockReset();
    clearWatchMock.mockReset();
    routeLayerMock.mockClear();
    useNavStore.setState(useNavStore.getInitialState());
    useUIStore.setState(useUIStore.getInitialState());

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: watchPositionMock,
        getCurrentPosition: getCurrentPositionMock,
        clearWatch: clearWatchMock,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("flies to the cached user location when Start is pressed", async () => {
    let watchSuccess: PositionCallback | null = null;

    watchPositionMock.mockImplementation((success: PositionCallback) => {
      watchSuccess = success;
      return 7;
    });

    render(<MapView />);

    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());

    act(() => {
      watchSuccess?.(createPosition(-93.2277, 44.974));
    });

    act(() => {
      useNavStore.getState().startNavigation(fakeSpot);
    });

    await waitFor(() => {
      expect(flyToMock).toHaveBeenCalledWith(expect.objectContaining({
        center: [fakeSpot.longitude, fakeSpot.latitude],
        zoom: 16,
      }));
    });

    act(() => {
      useNavStore.getState().beginNavigation();
    });

    await waitFor(() => {
      expect(flyToMock).toHaveBeenLastCalledWith(expect.objectContaining({
        center: [-93.2277, 44.974],
        zoom: 16,
        essential: true,
      }));
    });

    expect(getCurrentPositionMock).not.toHaveBeenCalled();
  });

  it("requests the current position on Start when no cached location is available", async () => {
    watchPositionMock.mockReturnValue(11);
    getCurrentPositionMock.mockImplementation((success: PositionCallback) => {
      success(createPosition(-93.2261, 44.9734));
    });

    render(<MapView />);

    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());

    act(() => {
      useNavStore.getState().startNavigation(fakeSpot);
      useNavStore.getState().beginNavigation();
    });

    await waitFor(() => {
      expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(flyToMock).toHaveBeenLastCalledWith(expect.objectContaining({
        center: [-93.2261, 44.9734],
        zoom: 16,
        essential: true,
      }));
    });
  });

  it("passes only tuple coordinates into RouteLayer for route drawing", async () => {
    let watchSuccess: PositionCallback | null = null;

    watchPositionMock.mockImplementation((success: PositionCallback) => {
      watchSuccess = success;
      return 5;
    });

    render(<MapView />);

    await waitFor(() => expect(routeLayerMock).toHaveBeenCalled());

    act(() => {
      watchSuccess?.(createPosition(-93.228, 44.9739));
    });

    await waitFor(() => {
      const lastCall = routeLayerMock.mock.calls[routeLayerMock.mock.calls.length - 1] as
        | unknown
        | undefined;
      const props = (lastCall as [{ userLocation: [number, number] | null }] | undefined)?.[0];
      expect(props?.userLocation).toEqual([-93.228, 44.9739]);
    });
  });
});
