import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapView from "../MapView";
import { useNavStore } from "../../../../store/navStore";
import { useUIStore } from "../../../../store/uiStore";
import type { ParkingSpot } from "../../../../types/parking.types";

const { routeLayerMock } = vi.hoisted(() => ({
  routeLayerMock: vi.fn(() => null),
}));

const flyToMock = vi.fn();
const easeToMock = vi.fn();
const getPitchMock = vi.fn(() => 0);
const getBearingMock = vi.fn(() => 0);
const isMovingMock = vi.fn(() => false);
const onceMock = vi.fn();
const onMock = vi.fn();
const offMock = vi.fn();
const watchPositionMock = vi.fn();
const getCurrentPositionMock = vi.fn();
const clearWatchMock = vi.fn();

vi.mock("../../../events/hooks/useEvents", () => ({
  useEvents: () => ({ data: undefined }),
}));

// MapView pins nearby buildings in Campus Mode. Mocked for the same reason as
// useEvents: these tests render MapView without a QueryClientProvider.
vi.mock("../../../campus/hooks/useCampusBuildings", () => ({
  useNearbyBuildings: () => ({ data: undefined }),
}));

vi.mock("../RouteLayer", () => ({
  default: routeLayerMock,
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    flyTo = flyToMock;
    easeTo = easeToMock;
    isMoving = isMovingMock;
    setPadding = vi.fn();
    getContainer = vi.fn(() => document.createElement("div"));
    zoomIn = vi.fn();
    zoomOut = vi.fn();
    remove = vi.fn();
    setStyle = vi.fn();
    setPitch = vi.fn();
    setBearing = vi.fn();
    getPitch = getPitchMock;
    getBearing = getBearingMock;
    once = onceMock;
    on = onMock;
    off = offMock;
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
    easeToMock.mockReset();
    isMovingMock.mockReset();
    isMovingMock.mockReturnValue(false);
    onceMock.mockReset();
    onMock.mockReset();
    offMock.mockReset();
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

    // Issue #13: Start drops into the tilted, close-in guidance camera rather
    // than the flat browsing one.
    await waitFor(() => {
      expect(flyToMock).toHaveBeenLastCalledWith(expect.objectContaining({
        center: [-93.2277, 44.974],
        zoom: 17,
        pitch: 45,
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
        zoom: 17,
        pitch: 45,
        essential: true,
      }));
    });
  });

  // The route panel is fixed to the bottom of the viewport and overlays the
  // map, so an unpadded camera centers the destination behind it and the pin
  // ends up high in the strip of map that is actually visible.
  it("pads the destination fly for the route panel covering the bottom of the map", async () => {
    watchPositionMock.mockReturnValue(3);

    render(<MapView />);
    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());

    act(() => {
      useUIStore.getState().setNavPanelHeight(240);
      useNavStore.getState().startNavigation(fakeSpot);
    });

    await waitFor(() => {
      expect(flyToMock).toHaveBeenCalledWith(expect.objectContaining({
        center: [fakeSpot.longitude, fakeSpot.latitude],
        padding: { top: 0, left: 0, right: 0, bottom: 240 },
      }));
    });
  });

  it("re-frames the destination when the panel grows, without re-flying", async () => {
    watchPositionMock.mockReturnValue(4);

    render(<MapView />);
    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());

    act(() => {
      useUIStore.getState().setNavPanelHeight(240);
      useNavStore.getState().startNavigation(fakeSpot);
    });
    await waitFor(() => expect(flyToMock).toHaveBeenCalled());
    const flysAfterStart = flyToMock.mock.calls.length;

    // The "see details" drawer opening is a resize, not a new destination.
    act(() => {
      useUIStore.getState().setNavPanelHeight(420);
    });

    await waitFor(() => {
      expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({
        center: [fakeSpot.longitude, fakeSpot.latitude],
        padding: { top: 0, left: 0, right: 0, bottom: 420 },
      }));
    });
    expect(flyToMock.mock.calls.length).toBe(flysAfterStart);
  });

  it("does not move the camera when a re-render leaves the panel height alone", async () => {
    let watchSuccess: PositionCallback | null = null;
    watchPositionMock.mockImplementation((success: PositionCallback) => {
      watchSuccess = success;
      return 6;
    });

    render(<MapView />);
    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());

    act(() => {
      watchSuccess?.(createPosition(-93.2277, 44.974));
    });

    act(() => {
      useUIStore.getState().setNavPanelHeight(240);
      useNavStore.getState().startNavigation(fakeSpot);
    });
    await waitFor(() => expect(flyToMock).toHaveBeenCalled());
    easeToMock.mockClear();

    // Pressing Start re-runs the framing effect. It must not ease here: that
    // would cancel the fly-to-user camera move mid-flight.
    act(() => {
      useNavStore.getState().beginNavigation();
    });

    await waitFor(() => expect(flyToMock.mock.calls.length).toBeGreaterThan(1));
    expect(easeToMock).not.toHaveBeenCalled();
  });

  // Regression: pressing Start removes the Cancel/Start row, so the panel
  // shrinks and the ResizeObserver reports a new height while the fly to the
  // user is still in flight. A padding ease fired at that moment cancels the
  // fly, and because ResizeObserver runs before paint the camera never visibly
  // moves at all.
  it("does not let a panel resize cancel the fly to the user on Start", async () => {
    let watchSuccess: PositionCallback | null = null;
    watchPositionMock.mockImplementation((success: PositionCallback) => {
      watchSuccess = success;
      return 9;
    });

    render(<MapView />);
    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());

    act(() => {
      watchSuccess?.(createPosition(-93.2277, 44.974));
    });
    act(() => {
      useUIStore.getState().setNavPanelHeight(300);
      useNavStore.getState().startNavigation(fakeSpot);
    });
    await waitFor(() => expect(flyToMock).toHaveBeenCalled());

    // The fly to the user is now in flight.
    isMovingMock.mockReturnValue(true);

    act(() => {
      useNavStore.getState().beginNavigation();
    });
    await waitFor(() => {
      expect(flyToMock).toHaveBeenLastCalledWith(expect.objectContaining({
        center: [-93.2277, 44.974],
      }));
    });

    // The Cancel/Start row is gone, so the panel shrinks mid-fly.
    act(() => {
      useUIStore.getState().setNavPanelHeight(254);
    });

    // The padding must be deferred to moveend, not eased immediately, or it
    // cancels the fly and the camera never reaches the user.
    await waitFor(() => expect(onceMock).toHaveBeenCalledWith("moveend", expect.any(Function)));
    expect(easeToMock).not.toHaveBeenCalled();

    // Once the fly finishes, the deferred padding is applied without a center,
    // so the camera stays where the fly left it: on the user.
    // The last moveend listener is the deferred padding. Effect 5 registers an
    // earlier one to re-arm the follow camera when its fly lands.
    const deferred = onceMock.mock.calls
      .filter((c) => c[0] === "moveend")
      .at(-1)?.[1] as () => void;
    isMovingMock.mockReturnValue(false);
    act(() => { deferred(); });

    expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({
      padding: { top: 0, bottom: 254, left: 0, right: 0 },
    }));
    expect(easeToMock.mock.calls[0][0]).not.toHaveProperty("center");
  });

  it("clears the panel padding when navigation ends", async () => {
    let watchSuccess: PositionCallback | null = null;
    watchPositionMock.mockImplementation((success: PositionCallback) => {
      watchSuccess = success;
      return 8;
    });

    render(<MapView />);
    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());

    act(() => {
      watchSuccess?.(createPosition(-93.2277, 44.974));
    });
    act(() => {
      useUIStore.getState().setNavPanelHeight(240);
      useNavStore.getState().startNavigation(fakeSpot);
    });
    await waitFor(() => expect(flyToMock).toHaveBeenCalled());

    act(() => {
      useNavStore.getState().endNavigation();
    });

    // Cleared inside the fly-back rather than as its own camera move, so the
    // two cannot cancel each other.
    await waitFor(() => {
      expect(flyToMock).toHaveBeenLastCalledWith(expect.objectContaining({
        center: [-93.2277, 44.974],
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      }));
    });
  });

  // The route line drew instantly sometimes and seconds late other times. Cause:
  // MapView passed mapRef.current, a ref assigned inside an effect, so RouteLayer
  // was handed null on the first render and the real map only on MapView's next
  // render, which nothing schedules. In practice it waited for an unrelated GPS
  // fix, and until then RouteLayer bailed out before even subscribing to the map.
  it("hands RouteLayer the map without waiting for an unrelated re-render", async () => {
    watchPositionMock.mockReturnValue(21);

    render(<MapView />);

    await waitFor(() => {
      const calls = routeLayerMock.mock.calls as unknown as Array<[{ map: unknown }]>;
      expect(calls[calls.length - 1]?.[0]?.map).not.toBeNull();
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

  // Drives MapView up to "guidance running and the opening fly has landed",
  // which is the only state where the follow camera is allowed to move.
  async function startGuidance() {
    let watchSuccess: PositionCallback | null = null;
    watchPositionMock.mockImplementation((success: PositionCallback) => {
      watchSuccess = success;
      return 12;
    });

    render(<MapView />);
    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());

    act(() => {
      watchSuccess?.(createPosition(-93.2277, 44.974));
    });
    act(() => {
      useNavStore.getState().startNavigation(fakeSpot);
      useNavStore.getState().beginNavigation();
    });
    await waitFor(() => expect(onceMock).toHaveBeenCalledWith("moveend", expect.any(Function)));

    // Land the fly to the user, which arms follow.
    const armFollow = onceMock.mock.calls.find((c) => c[0] === "moveend")?.[1] as () => void;
    act(() => { armFollow(); });
    easeToMock.mockClear();

    const moveWithHeading = (lng: number, lat: number, heading: number) =>
      act(() => { watchSuccess?.(createPosition(lng, lat, heading)); });
    const move = (lng: number, lat: number) => moveWithHeading(lng, lat, 0);

    return { move, moveWithHeading };
  }

  // Issue #10: the marker moved with each GPS fix but the camera never did, so
  // the driver watched themselves slide off the screen.
  it("follows the user with the camera while guidance is active", async () => {
    const { move } = await startGuidance();

    move(-93.23, 44.976);

    await waitFor(() => {
      expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({
        center: [-93.23, 44.976],
        essential: true,
      }));
    });

    // Recenter only: whatever zoom and bearing the user set must survive.
    const options = easeToMock.mock.calls[0][0];
    expect(options).not.toHaveProperty("zoom");
    expect(options).not.toHaveProperty("bearing");
  });

  // The button was invisible on phones while looking fine on desktop. It was
  // absolutely positioned inside a h-screen box, and on mobile browsers 100vh
  // is the large viewport, taller than what is on screen, so "bottom" was
  // measured from a point underneath the browser chrome. The route panel is
  // fixed, so the button has to be fixed too for the two to stay a fixed
  // distance apart.
  it("anchors Recenter to the visible viewport, above the route panel", async () => {
    await startGuidance();

    const pauseFollow = onMock.mock.calls.find((c) => c[0] === "dragstart")?.[1] as
      (e: { originalEvent?: unknown }) => void;
    act(() => { pauseFollow({ originalEvent: {} }); });

    const pill = screen.getByTitle("Recenter on my location").closest("div");
    expect(pill?.className).toContain("fixed");
    expect(pill?.className).not.toContain("absolute");
    // The panel is z-50, so anything lower hides the button behind the sheet
    // rather than merely putting it in the wrong place.
    expect(pill?.className).toContain("z-[60]");
  });

  it("stops following after a manual pan and resumes from Recenter", async () => {
    const { move } = await startGuidance();

    // The gesture handler registered on the map, fired with an originalEvent
    // so it reads as user-driven rather than one of our own eases.
    const pauseFollow = onMock.mock.calls.find((c) => c[0] === "dragstart")?.[1] as
      (e: { originalEvent?: unknown }) => void;
    act(() => { pauseFollow({ originalEvent: {} }); });

    move(-93.231, 44.977);
    expect(easeToMock).not.toHaveBeenCalled();

    flyToMock.mockClear();
    fireEvent.click(screen.getByTitle("Recenter on my location"));

    // One press has to undo panning, zooming out, and rotating all at once,
    // since that is the state the button appears in.
    expect(flyToMock).toHaveBeenCalledWith(expect.objectContaining({
      center: [-93.231, 44.977],
      zoom: 17,
      pitch: 45,
    }));

    easeToMock.mockClear();
    move(-93.232, 44.978);
    await waitFor(() => {
      expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({
        center: [-93.232, 44.978],
      }));
    });
  });

  it("ignores programmatic camera moves when deciding to pause follow", async () => {
    const { move } = await startGuidance();

    const pauseFollow = onMock.mock.calls.find((c) => c[0] === "zoomstart")?.[1] as
      (e: { originalEvent?: unknown }) => void;
    act(() => { pauseFollow({}); });

    move(-93.233, 44.979);
    await waitFor(() => expect(easeToMock).toHaveBeenCalled());
    expect(screen.queryByTitle("Recenter on my location")).toBeNull();
  });

  // Issue #13: guidance owns the camera for the length of the trip, and has to
  // give it back afterwards. Leaving the map tilted and turned to the last leg
  // of a finished trip is a state the user never asked for and cannot easily
  // undo, since the tilt controls are hidden during navigation.
  it("restores the browsing pitch and bearing when navigation ends", async () => {
    getPitchMock.mockReturnValue(0);
    getBearingMock.mockReturnValue(-17.6);

    const { move } = await startGuidance();
    move(-93.23, 44.976);
    flyToMock.mockClear();

    act(() => { useNavStore.getState().endNavigation(); });

    await waitFor(() => {
      expect(flyToMock).toHaveBeenLastCalledWith(expect.objectContaining({
        pitch: 0,
        bearing: -17.6,
      }));
    });

    getPitchMock.mockReturnValue(0);
    getBearingMock.mockReturnValue(0);
  });

  // Not every device can render a tilted map. The 3D style block already
  // degrades to flat rather than failing, and the guidance camera has to do the
  // same: a thrown pitch must not take the whole fly-to-user with it.
  it("falls back to a flat camera where pitch is unsupported", async () => {
    let watchSuccess: PositionCallback | null = null;
    watchPositionMock.mockImplementation((success: PositionCallback) => {
      watchSuccess = success;
      return 13;
    });

    render(<MapView />);
    await waitFor(() => expect(watchPositionMock).toHaveBeenCalled());
    act(() => { watchSuccess?.(createPosition(-93.2277, 44.974)); });

    flyToMock.mockClear();
    // Throw for the tilt specifically, the way a device without pitch support
    // would, and let every other camera move through untouched.
    flyToMock.mockImplementation((options: { pitch?: number }) => {
      if (options?.pitch != null) throw new Error("pitch not supported");
    });

    act(() => {
      useNavStore.getState().startNavigation(fakeSpot);
      useNavStore.getState().beginNavigation();
    });

    await waitFor(() => {
      const retry = flyToMock.mock.calls[flyToMock.mock.calls.length - 1][0];
      expect(retry).not.toHaveProperty("pitch");
      expect(retry).toMatchObject({ center: [-93.2277, 44.974], zoom: 17 });
    });

    flyToMock.mockImplementation(() => {});
  });

  // The opening fly sets the course-up bearing once. Without this the map keeps
  // facing the way the trip started and every turn after that reads as the
  // driver going sideways.
  it("turns the camera to follow a real course change", async () => {
    const { moveWithHeading } = await startGuidance();

    moveWithHeading(-93.23, 44.976, 90);

    await waitFor(() => {
      expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({ bearing: 90 }));
    });
  });

  // GPS heading wanders a couple of degrees per fix at walking pace and at a
  // standstill. Turning the whole world by that every second is far worse than
  // a bearing that lags slightly behind the truth.
  it("ignores heading noise below the turn deadband", async () => {
    getBearingMock.mockReturnValue(90);
    const { moveWithHeading } = await startGuidance();

    moveWithHeading(-93.23, 44.976, 92);

    await waitFor(() => expect(easeToMock).toHaveBeenCalled());
    expect(easeToMock.mock.calls[0][0]).not.toHaveProperty("bearing");

    getBearingMock.mockReturnValue(0);
  });
});
