import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import TurnByTurn from "../TurnByTurn";
import { useNavStore } from "../../../../store/navStore";
import type { ParkingSpot } from "../../../../types/parking.types";

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

describe("TurnByTurn", () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState());
  });

  it("shows a retry state instead of endless calculating when route loading fails", () => {
    useNavStore.setState({
      ...useNavStore.getState(),
      isNavigating: true,
      hasStartedNavigation: true,
      navOverlayVisible: true,
      destination: fakeSpot,
      routeStatus: "error",
      routeError: "We couldn't calculate a route right now. Try again in a moment.",
    });

    render(<TurnByTurn />);

    expect(screen.getByText(/couldn't load turn-by-turn directions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries the route request from the notice state", () => {
    useNavStore.setState({
      ...useNavStore.getState(),
      isNavigating: true,
      hasStartedNavigation: true,
      navOverlayVisible: true,
      destination: fakeSpot,
      routeStatus: "ready",
      routeNotice: "Showing a simple direct route. Retry for turn-by-turn directions.",
      route: {
        coordinates: [
          [-93.2277, 44.974],
          [-93.22, 44.975],
        ],
        steps: [
          {
            instruction: "Head toward your destination",
            distance: "0.5 mi",
            distanceMeters: 800,
            maneuverType: "depart",
            maneuverModifier: "straight",
            icon: "bi-arrow-up-circle-fill",
            location: [-93.2277, 44.974],
          },
        ],
        totalDistanceMeters: 800,
        totalDurationSeconds: 600,
        source: "fallback",
        notice: "Showing a simple direct route. Retry for turn-by-turn directions.",
      },
    });

    render(<TurnByTurn />);

    const previousRequestId = useNavStore.getState().routeRequestId;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(useNavStore.getState().routeRequestId).toBe(previousRequestId + 1);
    expect(useNavStore.getState().routeStatus).toBe("loading");
  });
});
