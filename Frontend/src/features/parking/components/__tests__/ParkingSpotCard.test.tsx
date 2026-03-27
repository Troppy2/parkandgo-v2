import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ParkingSpotCard from "../ParkingSpotCard";
import { useNavStore } from "../../../../store/navStore";
import { useAuthStore } from "../../../../store/authStore";
import type { ParkingSpot } from "../../../../types/parking.types";

// The 8 verified UMN parking spots exactly as seeded in parkandgo_db_postgres.sql
const UMN_SPOTS: ParkingSpot[] = [
  {
    spot_id: 1,
    spot_name: "Oak Street Ramp",
    campus_location: "East Bank",
    parking_type: "Parking Garage",
    cost: 2.50,
    walk_time: "5 min to Coffman",
    near_buildings: "Coffman Union, Walter Library, Carlson School, Northrop Auditorium",
    address: "401 SE Oak St, Minneapolis, MN 55455",
    latitude: 44.9739,
    longitude: -93.2312,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
  {
    spot_id: 2,
    spot_name: "19th Ave Meters",
    campus_location: "East Bank",
    parking_type: "Street Parking",
    cost: 1.50,
    walk_time: "8 min to Keller",
    near_buildings: "Keller Hall, Tate Lab, Recreation Center",
    address: "19th Ave SE & University Ave SE, Minneapolis, MN 55455",
    latitude: 44.9785,
    longitude: -93.2345,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
  {
    spot_id: 3,
    spot_name: "Church Street Garage",
    campus_location: "East Bank",
    parking_type: "Parking Garage",
    cost: 2.00,
    walk_time: "3 min to Anderson",
    near_buildings: "Anderson Hall, Bruininks Hall, Nicholson Hall",
    address: "80 Church St SE, Minneapolis, MN 55455",
    latitude: 44.9763,
    longitude: -93.2343,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
  {
    spot_id: 4,
    spot_name: "4th St Ramp",
    campus_location: "East Bank",
    parking_type: "Parking Garage",
    cost: 2.50,
    walk_time: "7 min to Walter Library",
    near_buildings: "Walter Library, Coffman Union",
    address: "1625 4th St SE, Minneapolis, MN 55455",
    latitude: 44.9806,
    longitude: -93.2355,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
  {
    spot_id: 5,
    spot_name: "East River Road Garage",
    campus_location: "East Bank",
    parking_type: "Parking Garage",
    cost: 1.00,
    walk_time: "10 min to Northrop",
    near_buildings: "Northrop Auditorium, Kolthoff Hall",
    address: "385 East River Pkwy, Minneapolis, MN 55455",
    latitude: 44.9732,
    longitude: -93.2392,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
  {
    spot_id: 6,
    spot_name: "Washington Ave Bridge Lot",
    campus_location: "West Bank",
    parking_type: "Surface Lot",
    cost: 1.00,
    walk_time: "2 min to Wilson Library",
    near_buildings: "Wilson Library, West Bank Buildings",
    address: "224 19th Ave S, Minneapolis, MN 55455",
    latitude: 44.9729,
    longitude: -93.2435,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
  {
    spot_id: 7,
    spot_name: "21st Ave Ramp",
    campus_location: "West Bank",
    parking_type: "Parking Garage",
    cost: 2.50,
    walk_time: "4 min to Blegen",
    near_buildings: "Blegen Hall, Ferguson Hall",
    address: "400 21st Ave S, Minneapolis, MN 55455",
    latitude: 44.9708,
    longitude: -93.2421,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
  {
    spot_id: 8,
    spot_name: "19th Ave Ramp (West Bank)",
    campus_location: "West Bank",
    parking_type: "Parking Garage",
    cost: 1.50,
    walk_time: "5 min to Rarig",
    near_buildings: "Rarig Center, West Bank Arts Buildings",
    address: "300 19th Ave S, Minneapolis, MN 55455",
    latitude: 44.9719,
    longitude: -93.2443,
    is_verified: true,
    submitted_by: null,
    created_at: null,
  },
];

// UMN campus bounding box — all verified spots must fall inside this box.
const UMN_BOUNDS = { minLat: 44.96, maxLat: 44.99, minLng: -93.27, maxLng: -93.20 };

// ─── helpers ─────────────────────────────────────────────────────────────────

function renderCard(spot: ParkingSpot) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ParkingSpotCard spot={spot} />
    </QueryClientProvider>,
  );
}

// ─── Suite 1: coordinate bounds (pure data — no render needed) ───────────────

describe("UMN parking spot geolocation", () => {
  it.each(UMN_SPOTS)(
    "$spot_name has non-null lat/lng within UMN campus bounds",
    (spot) => {
      expect(spot.latitude).not.toBeNull();
      expect(spot.longitude).not.toBeNull();
      expect(spot.latitude!).toBeGreaterThanOrEqual(UMN_BOUNDS.minLat);
      expect(spot.latitude!).toBeLessThanOrEqual(UMN_BOUNDS.maxLat);
      expect(spot.longitude!).toBeGreaterThanOrEqual(UMN_BOUNDS.minLng);
      expect(spot.longitude!).toBeLessThanOrEqual(UMN_BOUNDS.maxLng);
    },
  );
});

// ─── Suite 2: "Navigate Here" button ─────────────────────────────────────────

describe("ParkingSpotCard — Navigate Here", () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState());
    useAuthStore.setState({ isAuthenticated: false, isGuest: false, user: null, token: null });
  });

  afterEach(() => {
    cleanup();
  });

  it.each(UMN_SPOTS)(
    "$spot_name — 'Navigate Here' sets isNavigating=true with correct coordinates",
    (spot) => {
      renderCard(spot);

      fireEvent.click(screen.getByRole("button", { name: /navigate here/i }));

      const state = useNavStore.getState();
      expect(state.isNavigating).toBe(true);
      expect(state.hasStartedNavigation).toBe(false);
      expect(state.destination?.spot_id).toBe(spot.spot_id);
      expect(state.destination?.latitude).toBe(spot.latitude);
      expect(state.destination?.longitude).toBe(spot.longitude);
    },
  );

  it.each(UMN_SPOTS)(
    "$spot_name — 'Directions' icon also starts navigation with correct coordinates",
    (spot) => {
      renderCard(spot);

      fireEvent.click(screen.getByTitle("Directions"));

      const state = useNavStore.getState();
      expect(state.isNavigating).toBe(true);
      expect(state.destination?.latitude).toBe(spot.latitude);
      expect(state.destination?.longitude).toBe(spot.longitude);
    },
  );
});
