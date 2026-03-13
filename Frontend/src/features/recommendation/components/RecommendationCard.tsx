import { useState } from "react";
import clsx from "clsx";
import type { RecommendationResponse } from "../../../types/recommendation.types";
import ScoreBreakdown from "./ScoreBreakdown";
import { Badge } from "../../../components/ui";
import { useNavStore } from "../../../store/navStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { saveSpot, unsaveSpot, getSavedSpots } from "../../profile/services/profileApi"

interface RecommendationCardProps {
  recommendation: RecommendationResponse
  rank: number
}

export default function RecommendationCard({
  recommendation,
  rank,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const startNavigation = useNavStore((s) => s.startNavigation);
  const { spot, score, score_breakdown } = recommendation;
  const queryClient = useQueryClient()
  const { data: savedSpots } = useQuery({ queryKey: ["saved-spots"], queryFn: getSavedSpots })
  const isSaved = savedSpots?.some((s) => s.spot_id === spot.spot_id) ?? false
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) await unsaveSpot(spot.spot_id)
      else await saveSpot(spot.spot_id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-spots"] }),
  })
  // Price display: $0 = "Free", otherwise "$X.XX/hr"
  const priceLabel = spot.cost === null ? "Price N/A" : spot.cost === 0 ? "Free" : `$${spot.cost.toFixed(2)}/hr`;
  const scoreLabel = Number.isFinite(score) ? Math.round(score) : 0;

  return (
    // Top-ranked card gets maroon border treatment — rank === 1
    // Base card: bg-white border rounded-2xl overflow-hidden shadow-sm cursor-pointer
    // Top card adds: border-maroon shadow-[0_2px_8px_rgba(122,0,25,0.15)]
    <div
      className={clsx(
        "bg-white border rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        rank === 1 ? "border-maroon shadow-[0_2px_8px_rgba(122,0,25,0.15)]" : "border-black/9"
      )}
    >
      {/* Header band green gradient, shows rank badge */}
      <div className="h-[62px] bg-green-gradient flex items-center justify-center relative">
        <div className="absolute top-1.5 left-1.5 bg-gold-light text-text1 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          #{rank}
        </div>
        {/* Score box with black text */}
        <div className="bg-maroon-light border border-maroon/20 rounded-xl w-11 h-11 flex flex-col items-center justify-center text-text1">
          <span className="text-lg font-black leading-none">{scoreLabel}</span>
          <span className="text-[7px] tracking-wide">SCORE</span>
        </div>
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
        <div className="flex gap-2 mt-2">
          <button
            className="text-[10px] text-maroon font-semibold underline-animate"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Hide details" : "See details"}
          </button>
          <button
            onClick={() => startNavigation(spot)}
            className="flex-1 bg-maroon text-white rounded-[10px] py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <i className="bi bi-arrow-up-circle-fill" />
            Navigate
          </button>
          {/* Bookmark button */}
          <button
            onClick={() => saveMutation.mutate()}
            className={clsx(
              "w-[46px] h-[46px] rounded-[10px] border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors duration-200",
              isSaved ? "bg-maroon border-maroon" : "bg-bg border-black/9 hover:border-maroon"
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
