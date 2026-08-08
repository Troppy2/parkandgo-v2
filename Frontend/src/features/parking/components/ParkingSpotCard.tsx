import { useState, type ReactNode } from "react"
import clsx from "clsx"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { ParkingSpot } from "../../../types/parking.types"
import type { SpotReviewSummary } from "../../../types/review.types"
import { useNavStore } from "../../../store/navStore"
import { useUIStore } from "../../../store/uiStore"
import { useAuthStore } from "../../../store/authStore"
import { getSavedSpots, saveSpot, unsaveSpot } from "../../profile/services/profileApi"
import { createParkingHistory } from "../../navigation/services/historyApi"
import { getSpotReviewSummary, submitSpotReview } from "../services/reviewsApi"
import { logContextEvent } from "../../navigation/services/navigationApi"
import { formatParkingCost } from "../../../lib/parking/formatters"

interface ParkingSpotCardProps {
  spot: ParkingSpot
  details?: ReactNode
}

export default function ParkingSpotCard({ spot, details }: ParkingSpotCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewNotes, setReviewNotes] = useState("")
  const startNavigation = useNavStore((s) => s.startNavigation)
  const beginNavigation = useNavStore((s) => s.beginNavigation)
  const setTravelMode = useNavStore((s) => s.setTravelMode)
  const showToast = useUIStore((s) => s.showToast)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const queryClient = useQueryClient()

  const typeIcon =
    spot.parking_type === "Parking Garage"
      ? "bi-building"
      : spot.parking_type === "Street Parking"
      ? "bi-signpost-fill"
      : "bi-tree"

  const formattedCost = formatParkingCost(spot.cost)
  const priceLabel = formattedCost === "N/A" ? "Price N/A" : formattedCost === "Free" ? "Free" : `${formattedCost}/hr`

  const { data: savedSpots } = useQuery({
    queryKey: ["saved-spots"],
    queryFn: getSavedSpots,
    enabled: isAuthenticated,
  })

  const { data: reviewSummary } = useQuery<SpotReviewSummary>({
    queryKey: ["spot-review-summary", spot.spot_id],
    queryFn: () => getSpotReviewSummary(spot.spot_id),
    enabled: expanded,
  })

  const isSaved = savedSpots?.some((s) => s.spot_id === spot.spot_id) ?? false

  const historyMutation = useMutation({
    mutationFn: () =>
      createParkingHistory({
        spot_id: spot.spot_id,
        start_time: new Date().toISOString(),
      }),
  })

  const reviewMutation = useMutation({
    mutationFn: () =>
      submitSpotReview({
        spot_id: spot.spot_id,
        rating: reviewRating,
        notes: reviewNotes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spot-review-summary", spot.spot_id] })
      setReviewOpen(false)
      setReviewNotes("")
      setReviewRating(5)
      showToast("Spot rating saved", "success")
    },
    onError: () => showToast("Failed to save rating", "error"),
  })

  const handleNavigate = () => {
    startNavigation(spot)

    if (isAuthenticated) {
      void historyMutation.mutateAsync().catch(() => {
        // History is best-effort. Navigation should still proceed.
      })
    }
  }

  const handleDirections = () => {
    setTravelMode("driving")
    startNavigation(spot)
    beginNavigation()

    if (isAuthenticated) {
      void historyMutation.mutateAsync().catch(() => {
        // History is best-effort. Navigation should still proceed.
      })
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await unsaveSpot(spot.spot_id)
      } else {
        await saveSpot(spot.spot_id)
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["saved-spots"] })
      const prev = queryClient.getQueryData<ParkingSpot[]>(["saved-spots"])
      queryClient.setQueryData<ParkingSpot[]>(["saved-spots"], (old = []) =>
        isSaved
          ? old.filter((s) => s.spot_id !== spot.spot_id)
          : [...old, spot]
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["saved-spots"], ctx?.prev)
      showToast(
        isAuthenticated ? "Failed to save spot - please try again" : "Sign in to save spots",
        "error"
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["saved-spots"] }),
  })

  return (
    <div className="bg-white border border-black/9 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-black/6">
        <i className={`bi ${typeIcon} text-maroon text-sm`} />
        <span className="text-[11px] font-semibold text-text2">{spot.parking_type ?? "Parking"}</span>
      </div>

      <div className="p-3">
        <div className="font-display text-[15px] font-bold text-text1 mb-0.5 leading-snug tracking-tight">{spot.spot_name}</div>
        <div className="text-[11px] text-text2 mb-2.5">{spot.campus_location ?? "Campus N/A"}</div>

        <div className="flex gap-2 mb-3">
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-black/15 text-text1">
            {priceLabel}
          </span>
          <span
            className={clsx(
              "text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-black/15 flex items-center gap-1",
              spot.is_verified ? "text-text1" : "text-text2"
            )}
            title={spot.is_verified ? "Community-submitted and staff-confirmed" : "Community-submitted, not yet verified"}
          >
            <i className="bi bi-patch-check-fill text-[9px]" />
            {spot.is_verified ? "Verified" : "Unverified"}
          </span>
        </div>

        <div className="flex gap-1.5 items-center">
          <button
            className="text-[10px] text-maroon font-semibold underline-animate flex-shrink-0"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Hide details" : "See details"}
            <i className={`bi bi-chevron-${expanded ? "up" : "down"} ml-0.5 text-[9px]`} />
          </button>

          <button
            onClick={() => {
              handleNavigate()
              void logContextEvent("recommendation_navigate_click", {
                spot_id: spot.spot_id,
                source: "recommendation_card",
              }).catch(() => undefined)
            }}
            className="flex-1 bg-maroon text-white rounded-[10px] py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 min-h-[44px] transition-all duration-150 hover:bg-maroon-hover hover:-translate-y-[1px] active:bg-[var(--color-maroon-dark)] active:scale-[0.97]"
          >
            <i className="bi bi-map-fill" />
            Navigate Here
          </button>

          <button
            onClick={() => {
              handleDirections()
              void logContextEvent("recommendation_directions_click", {
                spot_id: spot.spot_id,
                source: "recommendation_card",
              }).catch(() => undefined)
            }}
            className="w-[44px] h-[44px] rounded-[10px] border-[1.5px] border-black/15 bg-[#e8e8ed] flex items-center justify-center flex-shrink-0 transition-all duration-150 hover:border-maroon hover:bg-[#d1d1d6] hover:-translate-y-[1px] active:scale-[0.97]"
            title="Directions"
          >
            <i className="bi bi-sign-turn-right text-text2 text-base" />
          </button>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className={clsx(
              "w-[44px] h-[44px] rounded-[10px] border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-[0.97]",
              saveMutation.isPending && "opacity-50 cursor-not-allowed",
              isSaved
                ? "bg-maroon border-maroon"
                : "bg-[#e8e8ed] border-black/[0.15] hover:border-maroon hover:bg-[#d1d1d6] hover:-translate-y-[1px]"
            )}
          >
            <i
              className={clsx(
                "bi text-lg",
                saveMutation.isPending
                  ? "bi-hourglass-split text-text2"
                  : isSaved
                  ? "bi-bookmark-fill text-white"
                  : "bi-bookmark text-text2"
              )}
            />
          </button>
        </div>

        {expanded && (
          <div className="mt-2.5">
            {details ?? (
              <div className="rounded-[10px] border border-black/8 bg-bg2 p-2.5 text-[11px] text-text2 space-y-1.5">
                <div>
                  <span className="font-semibold text-text1">Address:</span> {spot.address ?? "N/A"}
                </div>
                <div>
                  <span className="font-semibold text-text1">Walk time:</span> {spot.walk_time ?? "N/A"}
                </div>
                <div>
                  <span className="font-semibold text-text1">Nearby:</span> {spot.near_buildings ?? "N/A"}
                </div>
              </div>
            )}

            <div className="mt-3 rounded-[10px] border border-black/8 bg-white p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-text1">Safety rating</div>
                <div className="text-[11px] text-text2">
                  {reviewSummary ? (
                    <>
                      <span className="font-semibold text-text1">
                        {reviewSummary.average_rating.toFixed(1)} / 5
                      </span>{" "}
                      · {reviewSummary.review_count} review{reviewSummary.review_count === 1 ? "" : "s"}
                    </>
                  ) : (
                    "Loading ratings..."
                  )}
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, index) => index + 1).map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className="w-9 h-9 flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95"
                    aria-label={`Rate ${rating} star${rating === 1 ? "" : "s"}`}
                    aria-pressed={reviewRating === rating}
                  >
                    <i
                      className={clsx(
                        "bi text-[20px] transition-colors",
                        reviewRating >= rating ? "bi-star-fill text-gold" : "bi-star text-text3"
                      )}
                    />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReviewOpen((value) => !value)}
                  className="ml-auto text-[11px] font-semibold text-maroon underline-animate"
                >
                  {reviewOpen ? "Cancel" : "Rate this spot"}
                </button>
              </div>

              {reviewOpen && (
                <div className="space-y-2">
                  <textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Optional safety notes, lighting, gate access, etc."
                    className="w-full min-h-[78px] rounded-[10px] border border-black/10 px-3 py-2 text-[12px] outline-none focus:border-maroon"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate()}
                      className="px-3 py-2 rounded-[10px] bg-maroon text-white text-[11px] font-semibold min-h-[40px] disabled:opacity-50"
                    >
                      {reviewMutation.isPending ? "Saving..." : "Save rating"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
