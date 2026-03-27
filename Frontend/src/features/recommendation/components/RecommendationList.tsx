import { useRecommendations } from "../hooks/useRecommendations"
import { useAuthStore } from "../../../store/authStore"
import { useMediaQuery } from "../../../hooks/useMediaQuery"
import { useUIStore } from "../../../store/uiStore"
import { recommendationHasDirections } from "../../../lib/parking/spotDirections"
import RecommendationCard from "./RecommendationCard"
import LoadingSkeleton from "./LoadingSkeleton"

export default function RecommendationList() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const verifiedOnly = useUIStore((s) => s.verifiedOnly)
  const directionsOnly = useUIStore((s) => s.directionsOnly)
  const { data, isLoading, isError } = useRecommendations({ verifiedOnly })
  const visibleData = directionsOnly ? (data ?? []).filter(recommendationHasDirections) : (data ?? [])

  if (!isAuthenticated) {
    return (
      <div className="p-5 text-center">
        <i className="bi bi-lock text-text3 text-2xl mb-2 block" />
        <p className="text-[13px] font-medium text-text2">Sign in for personalized spot recommendations</p>
      </div>
    )
  }
  if (isLoading) return <LoadingSkeleton />
  if (isError) return <div className="p-4 text-[12px] text-red text-center">Error loading recommendations. Please try again.</div>

  if (isDesktop) {
    if (visibleData.length === 0) {
      return (
        <div className="p-4 text-[12px] text-text3 text-center">
          No spots found nearby
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4 p-4">
        {visibleData.map((rec) => (
          <RecommendationCard key={rec.spot.spot_id} recommendation={rec} />
        ))}
      </div>
    )
  }

  const hasData = visibleData.length > 0

  return (
    <div>
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
