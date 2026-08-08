import { useState } from "react"
import clsx from "clsx"

import { useMediaQuery } from "../../../hooks/useMediaQuery"
import { useNavStore } from "../../../store/navStore"
import { useCampusBuildings, useNearbyBuildings } from "../hooks/useCampusBuildings"
import CampusBuildingCard from "./CampusBuildingCard"
import type { CampusBuilding } from "../../../types/campus_building.types"
import type { CampusLocation } from "../../../types/parking.types"
import { Skeleton } from "../../../components/ui"

const TOP_N = 5

const CAMPUS_FILTERS: { label: string; value: CampusLocation | "All" }[] = [
  { label: "All", value: "All" },
  { label: "East Bank", value: "East Bank" },
  { label: "West Bank", value: "West Bank" },
  { label: "St. Paul", value: "St. Paul" },
]

/**
 * The Buildings list shown in Campus Mode.
 *
 * Default ordering is nearest first, which is what makes the tab useful to
 * somebody standing on campus. When location is unavailable, whether denied,
 * still resolving, or the user is off campus, it falls back to the full
 * alphabetical list rather than showing an empty panel.
 */
export default function CampusBuildingList() {
  const [showAll, setShowAll] = useState(false)
  const [campus, setCampus] = useState<CampusLocation | "All">("All")
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const currentUserLocation = useNavStore((s) => s.currentUserLocation)

  const nearbyQuery = useNearbyBuildings(currentUserLocation?.coords ?? null)
  const allQuery = useCampusBuildings(campus === "All" ? undefined : campus)

  // Nearby is only meaningful with no campus filter applied. Once someone picks
  // a campus they are browsing rather than looking for what is closest, and the
  // nearby endpoint has no campus parameter.
  const usingNearby = campus === "All" && !!currentUserLocation && (nearbyQuery.data?.length ?? 0) > 0
  const activeQuery = usingNearby ? nearbyQuery : allQuery

  const buildings: CampusBuilding[] = activeQuery.data ?? []
  const displayed = showAll ? buildings : buildings.slice(0, TOP_N)

  const filterRow = (
    <div className="px-3.5 py-2 flex gap-1.5 overflow-x-auto border-b border-black/6 scrollbar-none items-center">
      {CAMPUS_FILTERS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => { setCampus(value); setShowAll(false) }}
          className={clsx("flex-shrink-0", campus === value ? "chip chip-ac" : "chip")}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (activeQuery.isLoading) {
    return (
      <div>
        {filterRow}
        <div className="p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[120px] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (activeQuery.isError) {
    return (
      <div>
        {filterRow}
        <div className="p-4 text-[12px] text-red text-center">
          Error loading campus buildings. Please try again.
        </div>
      </div>
    )
  }

  if (buildings.length === 0) {
    return (
      <div>
        {filterRow}
        <div className="p-5 text-center">
          <i className="bi bi-building text-text3 text-2xl mb-2 block" />
          <p className="text-[13px] font-medium text-text2">No buildings found</p>
        </div>
      </div>
    )
  }

  const heading = usingNearby ? "Nearest Buildings" : "Campus Buildings"

  if (isDesktop) {
    return (
      <div>
        {filterRow}
        <div className="flex flex-col gap-4 p-4">
          {displayed.map((building) => (
            <CampusBuildingCard key={building.building_id} building={building} />
          ))}
          {buildings.length > TOP_N && (
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="w-full py-2 rounded-[10px] border border-black/10 text-[12px] font-semibold text-maroon bg-maroon-light hover:bg-maroon/10 transition-colors"
            >
              {showAll ? "Show less" : `All ${buildings.length} buildings`}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {filterRow}
      <div className="px-3.5 py-2.5 flex items-center gap-2">
        <span className="font-display text-sm font-bold text-text1 tracking-tight">{heading}</span>
        <button
          onClick={() => setShowAll((prev) => !prev)}
          className={clsx(
            "ml-auto text-[11px] font-semibold rounded-full px-2.5 py-0.5 transition-colors",
            showAll ? "bg-maroon text-white" : "bg-bg2 text-text2 hover:bg-maroon/10 hover:text-maroon"
          )}
        >
          {showAll ? `Top ${TOP_N}` : `All ${buildings.length}`}
        </button>
      </div>

      <div className="flex gap-2.5 px-3.5 pb-4 overflow-x-auto scrollbar-none">
        {displayed.map((building) => (
          <div key={building.building_id} className="flex-shrink-0 w-[340px]">
            <CampusBuildingCard building={building} />
          </div>
        ))}
      </div>
    </div>
  )
}
