import clsx from "clsx"
import type { SpotFilters, CampusLocation, ParkingType } from "../../../types/parking.types"

interface SearchFiltersProps {
    filters: SpotFilters
    onChange: (updated: SpotFilters) => void
    isOpen: boolean
    sliderMax?: number
}

// Chip options — match your backend's allowed values exactly
const PARKING_TYPES = ["Parking Garage", "Surface Lot", "Street Parking"] as const
const CAMPUSES = ["East Bank", "West Bank", "St. Paul"] as const

export default function SearchFilters({ filters, onChange, isOpen, sliderMax = 20 }: SearchFiltersProps) {
    // Helper to toggle a chip value
    // If already selected = clear it (set to undefined)
    // If not selected = set it
    const toggleType = (type: string) => {
        onChange({
            ...filters,
            parking_type: filters.parking_type === type ? undefined : type as ParkingType,
        })
    }

    const toggleCampus = (campus: string) => {
        onChange({
            ...filters,
            campus_location: filters.campus_location === campus ? undefined : campus as CampusLocation,
        })
    }

    return (
        // Matches .filters-expand — max-height animation for open/close
        <div
            className={clsx(
                "overflow-hidden transition-all duration-300 px-3.5",
                isOpen ? "max-h-[200px]" : "max-h-0"
            )}
        >
            {/* Parking Type section */}
            {/* Matches .filter-sec + .filter-sec-t */}
            <div className="mb-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-text3 mb-1.5">
                    Parking Type
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {PARKING_TYPES.map((type) => (
                        <button
                            key={type}
                            onClick={() => toggleType(type)}
                            className={clsx("chip", filters.parking_type === type && "chip-ac")}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Campus section */}
            <div className="mb-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-text3 mb-1.5">
                    Campus
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {CAMPUSES.map((campus) => (
                        <button
                            key={campus}
                            onClick={() => toggleCampus(campus)}
                            className={clsx("chip", filters.campus_location === campus && "chip-ac")}
                        >
                            {campus}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cost slider — matches .cslide-row */}
            <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-text3 mb-1.5">
                    MAX COST / HR
                </div>
                <div className="flex items-center gap-2.5">
                    <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        step={0.5}
                        value={filters.max_cost ?? sliderMax}
                        onChange={(e) => onChange({ ...filters, max_cost: Number(e.target.value) })}
                        style={{ accentColor: "#7A0019" }}
                        className="flex-1"
                    />
                    <span className="text-[11px] font-bold text-maroon whitespace-nowrap">
                        {(filters.max_cost ?? sliderMax) >= sliderMax
                            ? "Any"
                            : `$${(filters.max_cost ?? sliderMax).toFixed(2)}/hr`}
                    </span>
                </div>
            </div>
        </div>
    )
}
