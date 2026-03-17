import type { ParkingSpot } from "../../../types/parking.types"
import Skeleton from "../../../components/ui/Skeleton"
import { useNavStore } from "../../../store/navStore"

interface SearchResultsProps {
    spots: ParkingSpot[] | undefined
    isLoading: boolean
    query: string
    onReset?: () => void
}

export default function SearchResults({ spots, isLoading, query, onReset }: SearchResultsProps) {
    const startNavigation = useNavStore((s) => s.startNavigation)

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
                <span className="text-[11px] font-medium text-text2 bg-bg2 rounded-full px-2.5 py-1">
                    {spots.length} spot{spots.length !== 1 ? "s" : ""}
                </span>
            </div>

            <div className="space-y-2 px-3.5 pb-4">
                {spots.map((spot) => {
                    const priceLabel = spot.cost === null ? "Price N/A" : spot.cost === 0 ? "Free" : `$${spot.cost.toFixed(2)}/hr`
                    return (
                        <div
                          key={spot.spot_id}
                          className="bg-white border border-black/8 rounded-2xl p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="font-semibold text-sm text-text1">{spot.spot_name}</div>
                                    <div className="text-xs text-text2 mt-0.5">
                                        {[spot.campus_location, spot.parking_type].filter(Boolean).join(" · ")}
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-maroon bg-maroon/8 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {priceLabel}
                                </span>
                            </div>
                            <button
                                onClick={() => startNavigation(spot)}
                                className="mt-2.5 w-full bg-maroon text-white rounded-[10px] py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-transform duration-200 hover:-translate-y-[1px]"
                            >
                                <i className="bi bi-map-fill" />
                                Navigate Here
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
