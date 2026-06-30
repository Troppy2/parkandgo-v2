import { describe, it, expect, vi, beforeEach } from "vitest"
import { useRecommendationStore } from "../../../../store/recommendationStore"

// Mock apiClient so no real HTTP calls are made
vi.mock("../../../../lib/api/client", () => ({
  default: {
    get: vi.fn(),
  },
}))

import apiClient from "../../../../lib/api/client"
import { getRecommendations } from "../recommendationApi"
import type { RecommendationResponse } from "../../../../types/recommendation.types"

const mockApiGet = vi.mocked(apiClient.get)

const fakeRecommendations = [
  {
    spot: {
      spot_id: 1,
      spot_name: "Oak Street Ramp",
      campus_location: "East Bank",
      parking_type: "Parking Garage",
      cost: 2.5,
      walk_time: "5 min walk",
      near_buildings: "Keller Hall",
      address: "100 Oak St SE",
      latitude: 44.974,
      longitude: -93.228,
      is_verified: true,
      submitted_by: null,
      created_at: null,
    },
    score: 72.5,
    score_breakdown: {
      cost: 20,
      distance: 22.5,
      travel_time: 15,
      preferences: 15,
      major: 10,
      verified: 5,
      event: 0,
    },
  },
    ] as RecommendationResponse[]

describe("getRecommendations", () => {
  beforeEach(() => {
    useRecommendationStore.setState({ cachedRecommendations: [] })
    mockApiGet.mockReset()
  })

  it("writes successful results to the recommendation cache", async () => {
    mockApiGet.mockResolvedValue({ data: fakeRecommendations })

    await getRecommendations({})

    expect(useRecommendationStore.getState().cachedRecommendations).toEqual(fakeRecommendations)
  })

  it("does not overwrite the cache when the response is empty", async () => {
    useRecommendationStore.setState({ cachedRecommendations: fakeRecommendations })
    mockApiGet.mockResolvedValue({ data: [] })

    await getRecommendations({})

    // Empty response must not clear the existing cache
    expect(useRecommendationStore.getState().cachedRecommendations).toEqual(fakeRecommendations)
  })

  it("returns the response data to the caller", async () => {
    mockApiGet.mockResolvedValue({ data: fakeRecommendations })

    const result = await getRecommendations({ lat: 44.974, lon: -93.228, limit: 10 })

    expect(result).toEqual(fakeRecommendations)
  })

  it("passes query params to the API correctly", async () => {
    mockApiGet.mockResolvedValue({ data: fakeRecommendations })

    await getRecommendations({ lat: 44.974, lon: -93.228, limit: 5, verifiedOnly: true })

    expect(mockApiGet).toHaveBeenCalledWith(expect.any(String), {
      params: {
        user_lat: 44.974,
        user_lon: -93.228,
        limit: 5,
        travel_mode: "walking",
        verified_only: true,
      },
    })
  })
})
