/**
 * Mock geolocation for testing navigation without real GPS permission.
 * Usage: enableMockGeolocation() before tests.
 */

export interface MockLocation {
  lng: number;
  lat: number;
  accuracy?: number;
}

let mockEnabled = false;
let mockLocation: MockLocation | null = null;
const activeIntervals = new Map<number, ReturnType<typeof setInterval>>();
let nextWatchId = 1;

// UMN Campus locations for testing
export const UMN_TEST_LOCATIONS = {
  eastBank: { lng: -93.2277, lat: 44.974 },
  eastRiverRoad: { lng: -93.22, lat: 44.975 },
  nearbyWalk: { lng: -93.227, lat: 44.975 },
};

function createMockPosition(): GeolocationPosition | null {
  if (!mockLocation) return null;

  return {
    coords: {
      latitude: mockLocation.lat,
      longitude: mockLocation.lng,
      accuracy: mockLocation.accuracy ?? 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
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

export function enableMockGeolocation() {
  mockEnabled = true;
  mockLocation = UMN_TEST_LOCATIONS.eastBank;

  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback) => {
        const position = createMockPosition();
        if (position) {
          setTimeout(() => success(position), 50);
        } else if (error) {
          error({
            code: 1,
            message: "Mock location not set",
            PERMISSION_DENIED: 1,
          } as GeolocationPositionError);
        }
      },

      watchPosition: (success: PositionCallback, error?: PositionErrorCallback) => {
        const position = createMockPosition();
        const watchId = nextWatchId++;

        if (position) {
          success(position);
        } else if (error) {
          error({
            code: 1,
            message: "Mock location not set",
            PERMISSION_DENIED: 1,
          } as GeolocationPositionError);
        }

        const intervalId = setInterval(() => {
          const nextPosition = createMockPosition();
          if (nextPosition) success(nextPosition);
        }, 300);

        activeIntervals.set(watchId, intervalId);
        return watchId;
      },

      clearWatch: (watchId: number) => {
        const intervalId = activeIntervals.get(watchId);
        if (intervalId) {
          clearInterval(intervalId);
          activeIntervals.delete(watchId);
        }
      },
    },
    configurable: true,
  });
}

export function disableMockGeolocation() {
  mockEnabled = false;
  mockLocation = null;
  activeIntervals.forEach((intervalId) => clearInterval(intervalId));
  activeIntervals.clear();
}

export function setMockLocation(location: MockLocation) {
  mockLocation = location;
}

export function getMockLocation() {
  return mockLocation;
}

export function isMockEnabled() {
  return mockEnabled;
}
