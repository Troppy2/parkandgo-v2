import { useState, type ReactNode } from "react"
import clsx from "clsx"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { ParkingSpot } from "../../../types/parking.types"
import { useNavStore } from "../../../store/navStore"
import { useUIStore } from "../../../store/uiStore"
import { useAuthStore } from "../../../store/authStore"
import { getSavedSpots, saveSpot, unsaveSpot } from "../../profile/services/profileApi"

interface ParkingSpotCardProps {
  spot: ParkingSpot
  details?: ReactNode
}

export default function ParkingSpotCard({ spot, details }: ParkingSpotCardProps) {
  const [expanded, setExpanded] = useState(false)
  const startNavigation = useNavStore((s) => s.startNavigation)
  const showToast = useUIStore((s) => s.showToast)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const queryClient = useQueryClient()

  const typeIcon =
    spot.parking_type === "Parking Garage"
      ? "bi-building"
      : spot.parking_type === "Street Parking"
      ? "bi-signpost-fill"
      : "bi-tree"

  const priceLabel =
    spot.cost === null ? "Price N/A" : spot.cost === 0 ? "Free" : `$${spot.cost.toFixed(2)}/hr`

  const { data: savedSpots } = useQuery({
    queryKey: ["saved-spots"],
    queryFn: getSavedSpots,
    enabled: isAuthenticated,
  })

  const isSaved = savedSpots?.some((s) => s.spot_id === spot.spot_id) ?? false

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await unsaveSpot(spot.spot_id)
      } else {
        await saveSpot(spot.spot_id)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-spots"] }),
    onError: () =>
      showToast(
        isAuthenticated ? "Failed to save spot - please try again" : "Sign in to save spots",
        "error"
      ),
  })

  return (
    <div className="bg-white border border-black/9 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-black/6">
        <i className={`bi ${typeIcon} text-maroon text-sm`} />
        <span className="text-[11px] font-semibold text-text2">{spot.parking_type ?? "Parking"}</span>
      </div>

      <div className="p-3">
        <div className="text-[13px] font-bold text-text1 mb-0.5 leading-snug">{spot.spot_name}</div>
        <div className="text-[11px] text-text2">{spot.campus_location ?? "Campus N/A"}</div>
        <div className="text-[11px] text-text2 mb-2.5">{spot.parking_type ?? "Parking type N/A"}</div>

        <div className="flex gap-2 mb-3">
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-black/15 text-text1">
            {priceLabel}
          </span>
          <span
            className={clsx(
              "text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-black/15 flex items-center gap-1",
              spot.is_verified ? "text-text1" : "text-text2"
            )}
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
            onClick={() => startNavigation(spot)}
            className="flex-1 bg-maroon text-white rounded-[10px] py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 min-h-[44px] transition-all duration-150 hover:bg-maroon-hover hover:-translate-y-[1px] active:bg-[var(--color-maroon-dark)] active:scale-[0.97]"
          >
            <i className="bi bi-map-fill" />
            Navigate Here
          </button>

          <button
            onClick={() => startNavigation(spot)}
            className="w-[44px] h-[44px] rounded-[10px] border-[1.5px] border-black/15 bg-[#e8e8ed] flex items-center justify-center flex-shrink-0 transition-all duration-150 hover:border-maroon hover:bg-maroon-light active:scale-[0.97]"
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
                : "bg-[#e8e8ed] border-black/[0.15] hover:border-maroon hover:bg-maroon-light"
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
          </div>
        )}
      </div>
    </div>
  )
}
