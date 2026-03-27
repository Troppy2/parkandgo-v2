import type { ParkingSpot } from "../../../types/parking.types"
import Skeleton from "../../../components/ui/Skeleton"
import ParkingSpotCard from "../../parking/components/ParkingSpotCard"

interface SearchResultsProps {
    spots: ParkingSpot[] | undefined
    isLoading: boolean
    query: string
    onReset?: () => void
}

export default function SearchResults({ spots, isLoading, query, onReset }: SearchResultsProps) {
    if (isLoading) {
        return (
            <div className="space-y-3 p-3.5">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
            </div>
        )
    }

    // Empty state — no spots match active filters
    if (!spots || spots.length === 0) {
        return (
            <div className="px-3.5 py-8 text-center">
                <i className="bi bi-p-square text-text3 text-3xl mb-2 block" />
                <div className="text-[13px] font-semibold text-text1 mb-1">No spots match your filters</div>
                <div className="text-[11px] text-text2 mb-4">Try adjusting your filters</div>
                {onReset && (
                    <button
                        onClick={onReset}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-maroon text-white rounded-full text-[12px] font-semibold transition-colors hover:bg-maroon-hover active:scale-95"
                    >
                        <i className="bi bi-x-circle text-sm" />
                        Reset Filters
                    </button>
                )}
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
                <span className="text-[13px] font-bold text-text1">
                    {query ? `Results for "${query}"` : "Filtered spots"}
                </span>
                                <span className="text-[11px] font-medium text-text1 bg-bg2 rounded-full px-2.5 py-1">
                    {spots.length} spot{spots.length !== 1 ? "s" : ""}
                </span>
            </div>

            <div className="space-y-2 px-3.5 pb-4">
                {spots.map((spot) => {
                    return (
                        <ParkingSpotCard key={spot.spot_id} spot={spot} />
                    )
                })}
            </div>
        </div>
    )
}
