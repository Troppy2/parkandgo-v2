import { useUnverifiedSpots, useVerifySpot, useDeleteSpot } from "../hooks/useAdmin"
import { Skeleton } from "@/components/ui"

export default function SpotManagement() {
  const { data: spots, isLoading, error } = useUnverifiedSpots()
  const verify = useVerifySpot()
  const remove = useDeleteSpot()

  if (isLoading) return <Skeleton className="h-40" />
  if (error) return <div className="text-red-500 text-sm">Failed to load unverified spots</div>

  return (
    <div className="bg-white rounded-2xl border border-black/[0.12] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
        <i className="bi bi-clock-fill text-amber-500" />
        <span className="font-semibold text-sm text-text1">Pending Review</span>
        <span className="ml-auto text-xs text-text1 bg-gray-100 rounded-full px-2 py-0.5">{spots?.length ?? 0}</span>
      </div>

      {!spots || spots.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-text1">No spots pending review</div>
      ) : (
        <div className="divide-y divide-black/5">
          {spots.map((spot) => (
            <div key={spot.spot_id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-text1 truncate">{spot.spot_name}</div>
                <div className="text-xs text-text1">
                  {[spot.campus_location, spot.parking_type, spot.cost !== null ? `$${spot.cost.toFixed(2)}/hr` : null]
                    .filter(Boolean)
                    .join(" \u00B7 ")}
                </div>
              </div>
              <button
                onClick={() => verify.mutate(spot.spot_id)}
                disabled={verify.isPending}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors min-h-[36px]"
              >
                <i className="bi bi-check-lg mr-1" />
                Verify
              </button>
              <button
                onClick={() => remove.mutate(spot.spot_id)}
                disabled={remove.isPending}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors min-h-[36px]"
              >
                <i className="bi bi-trash mr-1" />
                Reject
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
