import { describe, it, expect } from "vitest"
import {
  buildingToParkingSpot,
  estimateWalkMinutes,
  formatBuildingDistance,
} from "../utils/buildingMappers"
import type { CampusBuilding } from "../../../types/campus_building.types"

const coffman: CampusBuilding = {
  building_id: 42,
  name: "Coffman Memorial Union",
  short_name: "CMU",
  campus_location: "East Bank",
  address: "300 Washington Ave SE",
  latitude: 44.972823,
  longitude: -93.23535,
  osm_id: "way/30056874",
  created_at: null,
  distance_miles: 0.25,
}

describe("buildingToParkingSpot", () => {
  it("carries the identity fields navigation needs", () => {
    const spot = buildingToParkingSpot(coffman)
    expect(spot.spot_id).toBe(42)
    expect(spot.spot_name).toBe("Coffman Memorial Union")
    expect(spot.latitude).toBe(44.972823)
    expect(spot.longitude).toBe(-93.23535)
    expect(spot.campus_location).toBe("East Bank")
    expect(spot.address).toBe("300 Washington Ave SE")
  })

  it("leaves parking-only fields null so RouteDisplay can hide those rows", () => {
    // If these were filled with placeholders, a building destination would show
    // "Parking Type: --" and a fake cost in the trip details panel.
    const spot = buildingToParkingSpot(coffman)
    expect(spot.parking_type).toBeNull()
    expect(spot.cost).toBeNull()
    expect(spot.is_verified).toBeNull()
    expect(spot.walk_time).toBeNull()
    expect(spot.near_buildings).toBeNull()
    expect(spot.submitted_by).toBeNull()
  })

  it("handles a building with no address or abbreviation", () => {
    const spot = buildingToParkingSpot({ ...coffman, address: null, short_name: null })
    expect(spot.address).toBeNull()
    expect(spot.spot_name).toBe("Coffman Memorial Union")
  })
})

describe("formatBuildingDistance", () => {
  it("returns null when no distance is known", () => {
    expect(formatBuildingDistance(null)).toBeNull()
  })

  it("uses feet below a tenth of a mile", () => {
    expect(formatBuildingDistance(0.05)).toBe("264 ft")
  })

  it("uses miles at or above a tenth", () => {
    expect(formatBuildingDistance(0.25)).toBe("0.3 mi")
    expect(formatBuildingDistance(1.44)).toBe("1.4 mi")
  })
})

describe("estimateWalkMinutes", () => {
  it("returns null when no distance is known", () => {
    expect(estimateWalkMinutes(null)).toBeNull()
  })

  it("estimates at 3 mph to match the routing service fallback", () => {
    // 1.5 miles at 3 mph is 30 minutes.
    expect(estimateWalkMinutes(1.5)).toBe("30 min walk")
  })

  it("never rounds down to zero minutes", () => {
    expect(estimateWalkMinutes(0.001)).toBe("1 min walk")
  })
})
