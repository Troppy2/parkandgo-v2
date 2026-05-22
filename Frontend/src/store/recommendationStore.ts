/**
 * Simple Zustand store that caches the most recent parking recommendations.
 * 
 * - Persists data in localStorage (via Zustand persist)
 * - Stores raw backend response (no transformations)
 * - No cache invalidation - data stays until replaced or cleared
 * - Improves UX by avoiding refetches when returning to the list or switching views
 * 
 * Not a full caching solution. Fetching should be handled separately (e.g., useRecommendations hook).
 */
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { RecommendationResponse } from "../types/recommendation.types"
// This store is used to cache the most recent set of recommendations fetched from the backend.
interface RecommendationCacheState {
    cachedRecommendations: RecommendationResponse[]
    setCachedRecommendations: (recs: RecommendationResponse[]) => void
    clearCache: () => void
}

export const useRecommendationStore = create<RecommendationCacheState>()(
    persist(
        (set) => ({
            cachedRecommendations: [],
            setCachedRecommendations: (recs) => set({ cachedRecommendations: recs }),
            clearCache: () => set({ cachedRecommendations: [] }),
        }),
        {
            name: "recommendations-cache",
            partialize: (state) => ({
                cachedRecommendations: state.cachedRecommendations,
            }),
        }
    )
)