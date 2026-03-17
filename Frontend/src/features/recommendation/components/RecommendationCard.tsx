import { useState } from "react";
import clsx from "clsx";
import type { RecommendationResponse } from "../../../types/recommendation.types";
import ScoreBreakdown from "./ScoreBreakdown";
import { Badge } from "../../../components/ui";
import { useNavStore } from "../../../store/navStore";
import { useUIStore } from "../../../store/uiStore";
import { useAuthStore } from "../../../store/authStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { saveSpot, unsaveSpot, getSavedSpots } from "../../profile/services/profileApi"

interface RecommendationCardProps {
  recommendation: RecommendationResponse
}

export default function RecommendationCard({
  recommendation,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const startNavigation = useNavStore((s) => s.startNavigation);
  const showToast = useUIStore((s) => s.showToast);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { spot, score_breakdown } = recommendation;
  const queryClient = useQueryClient()

  // Only fetch saved spots when the user is actually authenticated
  const { data: savedSpots } = useQuery({
    queryKey: ["saved-spots"],
    queryFn: getSavedSpots,
    enabled: isAuthenticated,
  })
  const isSaved = savedSpots?.some((s) => s.spot_id === spot.spot_id) ?? false
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) await unsaveSpot(spot.spot_id)
      else await saveSpot(spot.spot_id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-spots"] }),
    onError: () => showToast(
      isAuthenticated ? "Failed to save spot — please try again" : "Sign in to save spots",
      "error"
    ),
  })
  // Price display: $0 = "Free", otherwise "$X.XX/hr"
  const priceLabel = spot.cost === null ? "Price N/A" : spot.cost === 0 ? "Free" : `$${spot.cost.toFixed(2)}/hr`;

  return (
    <div className="bg-white border border-black/9 rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Parking type icon header */}
      <div className="h-[42px] bg-maroon-light flex items-center px-3 gap-2">
        <i className={`bi ${spot.parking_type === "Parking Garage" ? "bi-building" : spot.parking_type === "Street Parking" ? "bi-signpost-fill" : "bi-tree"} text-maroon text-base`} />
        <span className="text-[11px] font-semibold text-maroon">{spot.parking_type ?? "Parking"}</span>
      </div>

      {/* Card body */}
      <div className="p-2.5">
        <div className="text-[11px] font-bold text-text1 mb-0.5">
          {spot.spot_name}
        </div>
        <div className="text-[10px] text-text2 flex flex-col gap-px mb-2">
          <span>{spot.campus_location}</span>
          <span>{spot.parking_type}</span>
        </div>

        <div className="flex gap-2 mb-2">
          <Badge variant="maroon">{priceLabel}</Badge>
          {spot.is_verified && (
            <Badge variant="green">
              <i className="bi bi-patch-check-fill mr-1"></i>
              Verified
            </Badge>
          )}
        </div>
        <div className="flex gap-1.5 mt-2">
          <button
            className="text-[10px] text-maroon font-semibold underline-animate flex-shrink-0 self-center"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Hide details" : "See details"}
            <i className={`bi bi-chevron-${expanded ? "up" : "down"} ml-0.5 text-[9px]`} />
          </button>
          <button
            onClick={() => startNavigation(spot)}
            className="flex-1 bg-maroon text-white rounded-[10px] py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 min-h-[44px] transition-all duration-150 hover:bg-maroon-hover active:scale-[0.97]"
          >
            <i className="bi bi-map" />
            Navigate Here
          </button>
          {/* Directions button — blue tint */}
          <button
            onClick={() => startNavigation(spot)}
            className="w-[44px] h-[44px] rounded-[10px] border-[1.5px] border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.08)] flex items-center justify-center flex-shrink-0 transition-all duration-150 hover:bg-[rgba(59,130,246,0.14)] active:scale-[0.97]"
            title="Directions"
          >
            <i className="bi bi-sign-turn-right text-blue text-base" />
          </button>
          {/* Bookmark button — always visible */}
          <button
            onClick={() => saveMutation.mutate()}
            className={clsx(
              "w-[44px] h-[44px] rounded-[10px] border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-[0.97]",
              isSaved ? "bg-maroon border-maroon" : "bg-[#f2f2f7] border-black/9 hover:border-maroon"
            )}
          >
            <i
              className={clsx(
                "bi text-lg",
                isSaved ? "bi-bookmark-fill text-white" : "bi-bookmark text-text2"
              )}
            />
          </button>
        </div>
        {expanded && <ScoreBreakdown breakdown={score_breakdown} />}
      </div>
    </div>

  );
}
