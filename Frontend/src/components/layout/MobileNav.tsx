import { useState, type ReactNode } from "react"
import clsx from "clsx"
import { useUIStore } from "../../store/uiStore"
import SearchFilters from "../../features/search/components/SearchFilters"
import SearchResults from "../../features/search/components/SearchResults"
import { useDebouncedSearch } from "../../features/search/hooks/useDebouncedSearch"
import type { SpotFilters } from "../../types/parking.types"
import EventList from "../../features/events/components/EventList"
import type { CampusEvent } from "../../types/campus_event.types"

interface MobileNavProps {
  children: ReactNode
  onSuggestSpotClick?: () => void
}

export default function MobileNav({ children, onSuggestSpotClick }: MobileNavProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<SpotFilters>({})
  const { data: filterResults, isLoading: filterLoading } = useDebouncedSearch(filters)

  const hasActiveFilters =
    !!filters.parking_type ||
    !!filters.campus_location ||
    (filters.max_cost !== undefined && filters.max_cost < 20)

  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const mapInstance = useUIStore((s) => s.mapInstance)

  const handleEventMapClick = (event: CampusEvent) => {
    if (!mapInstance || event.longitude == null || event.latitude == null) return
    mapInstance.flyTo({
      center: [event.longitude, event.latitude],
      zoom: 16,
      duration: 800,
    })
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[22px] shadow-lg z-20">

      {/* Drag handle - tap to expand/collapse */}
      <div
        className="flex justify-center pt-2.5 pb-1 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-9 h-1 bg-gray-300 rounded" />
      </div>

      {/* Tab switcher - always visible; tapping a tab also expands the sheet */}
      <div className="flex border-b border-black/9 mx-3.5">
        <button
          onClick={() => { setActiveTab("spots"); setIsExpanded(true) }}
          className={clsx(
            "flex-1 pb-2 text-xs font-semibold border-b-2 -mb-px transition-colors",
            activeTab === "spots" ? "text-maroon border-maroon" : "text-text3 border-transparent"
          )}
        >
          <i className="bi bi-car-front-fill mr-1" />
          Suggested Spots
        </button>
        <button
          onClick={() => { setActiveTab("events"); setIsExpanded(true) }}
          className={clsx(
            "flex-1 pb-2 text-xs font-semibold border-b-2 -mb-px transition-colors",
            activeTab === "events" ? "text-maroon border-maroon" : "text-text3 border-transparent"
          )}
        >
          <i className="bi bi-calendar-event-fill mr-1" />
          Local Events
        </button>
      </div>

      {/* Content - only shown when expanded */}
      {isExpanded && (
        <div className="max-h-[55vh] overflow-y-auto pb-4 scrollbar-none animate-slide-up">
          {activeTab === "events" ? (
            <EventList onEventMapClick={handleEventMapClick} />
          ) : (
            <>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer w-full"
              >
                <span className="text-[12px] font-semibold text-maroon flex items-center gap-1.5">
                  <i className="bi bi-sliders text-xs" />
                  {hasActiveFilters ? "Filters active" : "See Filters"}
                </span>
                <i
                  className={clsx(
                    "bi bi-chevron-down text-[11px] text-maroon transition-transform",
                    filtersOpen ? "rotate-180" : ""
                  )}
                />
              </button>
              <SearchFilters filters={filters} onChange={setFilters} isOpen={filtersOpen} />
              {hasActiveFilters
                ? <SearchResults spots={filterResults} isLoading={filterLoading} query="" />
                : children
              }

              {/* Suggest a Spot card - matches mobile prototype */}
              <div className="px-3.5 pt-1">
                <button
                  onClick={() => onSuggestSpotClick?.()}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 border-[1.5px] border-dashed border-maroon/30 rounded-[12px] bg-maroon-light transition-all duration-200 hover:-translate-y-[1px]"
                >
                  <div className="w-8 h-8 bg-maroon rounded-[8px] flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-plus-lg text-white text-sm" />
                  </div>
                  <div className="text-left">
                    <div className="text-[12px] font-semibold text-maroon">
                      Suggest a Spot
                    </div>
                    <div className="text-[10px] text-maroon/60 mt-0.5">
                      Help the community
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}
