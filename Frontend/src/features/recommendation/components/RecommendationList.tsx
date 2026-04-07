import { useRecommendations } from "../hooks/useRecommendations"
import { useAuthStore } from "../../../store/authStore"
import { useMediaQuery } from "../../../hooks/useMediaQuery"
import { useUIStore } from "../../../store/uiStore"
import { useNavStore } from "../../../store/navStore"
import { useRecommendationStore } from "../../../store/recommendationStore"
import { recommendationHasDirections } from "../../../lib/parking/spotDirections"
import RecommendationCard from "./RecommendationCard"
import LoadingSkeleton from "./LoadingSkeleton"

export default function RecommendationList() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isOffline = useUIStore((s) => s.isOffline)
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const verifiedOnly = useUIStore((s) => s.verifiedOnly)
  const directionsOnly = useUIStore((s) => s.directionsOnly)
  const cachedRecommendations = useRecommendationStore((s) => s.cachedRecommendations)
  const rememberedSpot = useNavStore((s) => s.rememberedSpot)
  const startNavigation = useNavStore((s) => s.startNavigation)
  
  const { data, isLoading, isError } = useRecommendations({ verifiedOnly })
  
  // Prefer fresh query data; fall back to the persisted Zustand cache on error or
  // when the device is offline (TanStack may still have in-memory data when offline,
  // but we check isOffline explicitly so the fallback doesn't depend on isError alone).
  const recommendations = data ?? ((isError || isOffline) && cachedRecommendations.length > 0 ? cachedRecommendations : [])
  const visibleData = directionsOnly ? recommendations.filter(recommendationHasDirections) : recommendations

  if (!isAuthenticated) {
    return (
      <div className="p-5 text-center">
        <i className="bi bi-lock text-text3 text-2xl mb-2 block" />
        <p className="text-[13px] font-medium text-text2">Sign in for personalized spot recommendations</p>
      </div>
    )
  }
  
  if (isLoading) return <LoadingSkeleton />
  
  if (isError && cachedRecommendations.length === 0) {
    return <div className="p-4 text-[12px] text-red text-center">Error loading recommendations. Please try again.</div>
  }

  // Show offline notice whenever the device is offline and we have cached data,
  // regardless of whether the query has returned an error yet.
  const isUsingCache = isOffline && cachedRecommendations.length > 0

  if (isDesktop) {
    if (visibleData.length === 0) {
      return (
        <div className="p-4 space-y-3">
          {rememberedSpot && (
            <div className="rounded-2xl border border-maroon/25 bg-maroon-light p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-maroon">
                <i className="bi bi-pin-angle-fill" />
                Remembered Parking Spot
              </div>
              <div className="mt-1 text-[13px] font-bold text-text1">{rememberedSpot.spot_name}</div>
              <button
                type="button"
                onClick={() => startNavigation(rememberedSpot)}
                className="mt-2 rounded-[10px] bg-maroon px-3 py-2 text-[11px] font-semibold text-white"
              >
                Navigate
              </button>
            </div>
          )}
          <div className="text-[12px] text-text3 text-center">No spots found nearby</div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4 p-4">
        {isUsingCache && (
          <div className="bg-amber-100 text-amber-900 text-xs p-3 rounded text-center">
            You're offline. Showing cached recommendations.
          </div>
        )}
        {rememberedSpot && (
          <div className="rounded-2xl border border-maroon/25 bg-maroon-light p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-maroon">
              <i className="bi bi-pin-angle-fill" />
              Remembered Parking Spot
            </div>
            <div className="mt-1 text-[13px] font-bold text-text1">{rememberedSpot.spot_name}</div>
            <button
              type="button"
              onClick={() => startNavigation(rememberedSpot)}
              className="mt-2 rounded-[10px] bg-maroon px-3 py-2 text-[11px] font-semibold text-white"
            >
              Navigate
            </button>
          </div>
        )}
        {visibleData.map((rec) => (
          <RecommendationCard key={rec.spot.spot_id} recommendation={rec} />
        ))}
      </div>
    )
  }

  const hasData = visibleData.length > 0

  return (
    <div>
      {isUsingCache && (
        <div className="bg-amber-100 text-amber-900 text-xs p-3 m-3 rounded text-center">
          You're offline. Showing cached recommendations.
        </div>
      )}
      {rememberedSpot && (
        <div className="mx-3.5 mt-3 rounded-2xl border border-maroon/25 bg-maroon-light p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-maroon">
            <i className="bi bi-pin-angle-fill" />
            Remembered Parking Spot
          </div>
          <div className="mt-1 text-[13px] font-bold text-text1">{rememberedSpot.spot_name}</div>
          <button
            type="button"
            onClick={() => startNavigation(rememberedSpot)}
            className="mt-2 w-full rounded-[10px] bg-maroon py-2.5 text-[11px] font-semibold text-white"
          >
            Navigate to remembered spot
          </button>
        </div>
      )}
      <div className="px-3.5 py-2.5 flex items-center gap-2">
        <span className="text-[13px] font-bold text-text1">Suggested Spots</span>
        {verifiedOnly && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-maroon bg-maroon-light rounded-full px-2 py-0.5">
            <i className="bi bi-patch-check-fill text-[9px]" />
            Verified
          </span>
        )}
        {directionsOnly && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-maroon bg-maroon-light rounded-full px-2 py-0.5">
            <i className="bi bi-sign-turn-right-fill text-[9px]" />
            Directions
          </span>
        )}
        {hasData && (
          <span className="ml-auto text-[11px] font-medium text-text2 bg-bg2 rounded-full px-2 py-0.5">
            {visibleData.length} spots
          </span>
        )}
      </div>

      {!hasData && (
        <div className="px-3.5 pb-2 text-[12px] text-text3">No spots found nearby</div>
      )}

      <div className="flex gap-2.5 px-3.5 pb-4 overflow-x-auto scrollbar-none">
        {visibleData.map((rec) => (
          <div key={rec.spot.spot_id} className="flex-shrink-0 w-[340px]">
            <RecommendationCard recommendation={rec} />
          </div>
        ))}
      </div>
    </div>
  )
}
