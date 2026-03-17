import { useRecommendations } from "../hooks/useRecommendations"
import { useAuthStore } from "../../../store/authStore"
import { useMediaQuery } from "../../../hooks/useMediaQuery"
import { useNavStore } from "../../../store/navStore"
import { useUIStore } from "../../../store/uiStore"
import RecommendationCard from "./RecommendationCard"
import LoadingSkeleton from "./LoadingSkeleton"

export default function RecommendationList() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const verifiedOnly = useUIStore((s) => s.verifiedOnly)
  const { data, isLoading, isError } = useRecommendations({ verifiedOnly })
  const startNavigation = useNavStore((s) => s.startNavigation)
  const setSuggestSpotOpen = useUIStore((s) => s.setSuggestSpotOpen)

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

  // ── Desktop: full-width vertical list (sidebar) ──
  if (isDesktop) {
    if (!data || data.length === 0) {
      return (
        <div className="p-4 text-[12px] text-text3 text-center">
          No spots found nearby
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-4 p-4">
        {data.map((rec) => (
          <RecommendationCard key={rec.spot.spot_id} recommendation={rec} />
        ))}
      </div>
    )
  }

  // ── Mobile: horizontal scroll cards matching .gscroll design ──
  const hasData = data && data.length > 0

  return (
    <div>
      {/* Title row — matches .gbs-ttl */}
      <div className="px-3.5 py-2.5 flex items-center gap-2">
        <span className="text-[13px] font-bold text-text1">Suggested Spots</span>
        {verifiedOnly && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-maroon bg-maroon-light rounded-full px-2 py-0.5">
            <i className="bi bi-patch-check-fill text-[9px]" />
            Verified
          </span>
        )}
        {hasData && (
          <span className="ml-auto text-[11px] font-medium text-text2 bg-bg2 rounded-full px-2 py-0.5">
            {data!.length} spots
          </span>
        )}
      </div>

      {/* Empty state message — shown before the Suggest card when no results */}
      {!hasData && (
        <div className="px-3.5 pb-2 text-[12px] text-text3">No spots found nearby</div>
      )}

      {/* Horizontal scroll row — matches .gscroll */}
      <div className="flex gap-2.5 px-3.5 pb-4 overflow-x-auto scrollbar-none">
        {(data ?? []).map((rec) => {
          const { spot } = rec
          const priceLabel = spot.cost === null ? "N/A" : spot.cost === 0 ? "Free" : `$${spot.cost.toFixed(2)}/hr`
          const typeIcon = spot.parking_type === "Parking Garage" ? "bi-building" : spot.parking_type === "Street Parking" ? "bi-signpost-fill" : "bi-tree"

          return (
            // Mobile card — 148px wide, no rank badge
            <div
              key={spot.spot_id}
              onClick={() => startNavigation(spot)}
              className="flex-shrink-0 w-[148px] bg-white border-[1.5px] border-black/9 rounded-[14px] overflow-hidden cursor-pointer shadow-sm hover:shadow-md hover:border-maroon transition-all duration-150 active:scale-[0.97]"
            >
              {/* Parking type icon header — no score */}
              <div className="h-[52px] bg-gradient-to-br from-maroon-light to-gold-light flex items-center justify-center">
                <i className={`bi ${typeIcon} text-maroon text-2xl`} />
              </div>

              {/* Card body */}
              <div className="p-2 pb-2.5">
                <div className="text-[11px] font-bold text-text1 mb-0.5 leading-tight line-clamp-2">
                  {spot.spot_name}
                </div>
                <div className="text-[10px] text-text2 flex flex-col gap-px">
                  <span className="truncate">{spot.campus_location}</span>
                </div>
                <span className="inline-block mt-1.5 text-[10px] font-bold text-maroon bg-maroon-light rounded-full px-2 py-0.5">
                  {priceLabel}
                </span>
              </div>
            </div>
          )
        })}

        {/* "Suggest a Spot" end card — matches .gscard-add */}
        <div
          onClick={() => setSuggestSpotOpen(true)}
          className="flex-shrink-0 w-[120px] border-[1.5px] border-dashed border-maroon/30 rounded-[14px] flex flex-col items-center justify-center gap-1.5 px-2.5 py-3.5 bg-maroon-light cursor-pointer transition-all duration-150 hover:bg-maroon-light2 hover:border-solid hover:border-maroon active:scale-[0.97]"
        >
          <div className="w-[30px] h-[30px] bg-maroon rounded-[8px] flex items-center justify-center">
            <i className="bi bi-plus-lg text-white text-base" />
          </div>
          <span className="text-[10px] font-semibold text-maroon text-center leading-snug">
            Suggest a Spot
          </span>
        </div>
      </div>
    </div>
  )
}
