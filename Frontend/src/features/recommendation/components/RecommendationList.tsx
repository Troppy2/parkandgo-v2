import { useRecommendations } from "../hooks/useRecommendations"
import { useAuthStore } from "../../../store/authStore"
import RecommendationCard from "./RecommendationCard"
import LoadingSkeleton from "./LoadingSkeleton"

export default function RecommendationList() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data, isLoading, isError } = useRecommendations({})

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
  if (!data || data.length === 0) return <div className="p-4 text-[12px] text-text3 text-center">No spots found.</div>
  return (
    <div className="flex flex-col gap-4 p-4">
      {data.map((rec, index) => (
        <RecommendationCard key={rec.spot.spot_id} recommendation={rec} rank={index + 1} />
      ))}
    </div>
  )
}