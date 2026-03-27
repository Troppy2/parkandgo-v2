import type { RecommendationResponse } from "../../../types/recommendation.types";
import ScoreBreakdown from "./ScoreBreakdown";
import ParkingSpotCard from "../../parking/components/ParkingSpotCard"

interface RecommendationCardProps {
  recommendation: RecommendationResponse
}

export default function RecommendationCard({
  recommendation,
}: RecommendationCardProps) {
  const { spot, score_breakdown } = recommendation;

  return (
    <ParkingSpotCard
      spot={spot}
      details={<ScoreBreakdown breakdown={score_breakdown} />}
    />
  );
}
