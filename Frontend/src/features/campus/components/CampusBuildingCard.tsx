import { useState } from "react"
import clsx from "clsx"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { CampusBuilding, SavedBuilding } from "../../../types/campus_building.types"
import { useNavStore } from "../../../store/navStore"
import { useUIStore } from "../../../store/uiStore"
import { useAuthStore } from "../../../store/authStore"
import { getSavedBuildings, saveBuilding, unsaveBuilding } from "../services/campusBuildingsApi"
import {
  buildingToParkingSpot,
  estimateWalkMinutes,
  formatBuildingDistance,
} from "../utils/buildingMappers"
import { logContextEvent } from "../../navigation/services/navigationApi"

/**
 * A campus building as a walking destination.
 *
 * Modelled on ParkingSpotCard and sharing its shell, but written as its own
 * component rather than a prop variant. The two overlap in layout and almost
 * nowhere else: a building has no price, no verification state, no safety
 * reviews, and no parking history to log. Forking keeps all of that out of the
 * campus path instead of threading conditionals through the parking card.
 */

interface CampusBuildingCardProps {
  building: CampusBuilding
}

export default function CampusBuildingCard({ building }: CampusBuildingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const startNavigation = useNavStore((s) => s.startNavigation)
  const setTravelMode = useNavStore((s) => s.setTravelMode)
  const showToast = useUIStore((s) => s.showToast)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const queryClient = useQueryClient()

  const distanceLabel = formatBuildingDistance(building.distance_miles)
  const walkLabel = estimateWalkMinutes(building.distance_miles)

  const { data: savedBuildings } = useQuery({
    queryKey: ["saved-buildings"],
    queryFn: getSavedBuildings,
    enabled: isAuthenticated,
  })

  const isSaved = savedBuildings?.some((s) => s.building_id === building.building_id) ?? false

  const handleWalkHere = () => {
    // Campus Mode is walking only. Setting the mode before starting navigation
    // means the first route request already asks for the foot profile, so no
    // driving route is fetched and then thrown away.
    setTravelMode("walking")
    startNavigation(buildingToParkingSpot(building))

    void logContextEvent("campus_building_navigate_click", {
      building_id: building.building_id,
      source: "campus_building_card",
    }).catch(() => undefined)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await unsaveBuilding(building.building_id)
      } else {
        await saveBuilding(building.building_id)
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["saved-buildings"] })
      const prev = queryClient.getQueryData<SavedBuilding[]>(["saved-buildings"])
      queryClient.setQueryData<SavedBuilding[]>(["saved-buildings"], (old = []) =>
        isSaved
          ? old.filter((s) => s.building_id !== building.building_id)
          : [
              ...old,
              // Placeholder row so the icon fills immediately. The real row,
              // with the server assigned id, arrives on the invalidate in
              // onSettled. Only building_id is read before then.
              {
                id: -building.building_id,
                user_id: -1,
                building_id: building.building_id,
                created_at: null,
                building,
              },
            ]
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["saved-buildings"], ctx?.prev)
      showToast(
        isAuthenticated ? "Failed to save building - please try again" : "Sign in to save buildings",
        "error"
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["saved-buildings"] }),
  })

  return (
    <div className="bg-white border border-black/9 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-black/6">
        <i className="bi bi-building text-maroon text-sm" />
        <span className="text-[11px] font-semibold text-text2">
          {building.campus_location ?? "Campus"}
        </span>
        {distanceLabel && (
          <span className="ml-auto text-[11px] font-semibold text-text2">{distanceLabel}</span>
        )}
      </div>

      <div className="p-3">
        <div className="font-display text-[15px] font-bold text-text1 mb-0.5 leading-snug tracking-tight">
          {building.name}
        </div>
        <div className="text-[11px] text-text2 mb-2.5">
          {building.short_name ? `${building.short_name} · ` : ""}
          {walkLabel ?? building.address ?? "Campus building"}
        </div>

        <div className="flex gap-1.5 items-center">
          <button
            className="text-[10px] text-maroon font-semibold underline-animate flex-shrink-0"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Hide details" : "See details"}
            <i className={`bi bi-chevron-${expanded ? "up" : "down"} ml-0.5 text-[9px]`} />
          </button>

          <button
            onClick={handleWalkHere}
            className="flex-1 bg-maroon text-white rounded-[10px] py-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 min-h-[44px] transition-all duration-150 hover:bg-maroon-hover hover:-translate-y-[1px] active:bg-[var(--color-maroon-dark)] active:scale-[0.97]"
          >
            <i className="bi bi-person-walking" />
            Walk Here
          </button>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            aria-label={isSaved ? "Remove bookmark" : "Bookmark building"}
            className={clsx(
              "w-[44px] h-[44px] rounded-[10px] border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-[0.97]",
              saveMutation.isPending && "opacity-50 cursor-not-allowed",
              isSaved
                ? "bg-maroon border-maroon"
                : "bg-[#e8e8ed] border-black/[0.15] hover:border-maroon hover:bg-[#d1d1d6] hover:-translate-y-[1px]"
            )}
          >
            <i
              className={clsx(
                "bi text-lg",
                saveMutation.isPending
                  ? "bi-hourglass-split text-text2"
                  : isSaved
                  ? "bi-bookmark-fill text-white"
                  : "bi-bookmark text-text2"
              )}
            />
          </button>
        </div>

        {expanded && (
          <div className="mt-2.5">
            <div className="rounded-[10px] border border-black/8 bg-bg2 p-2.5 text-[11px] text-text2 space-y-1.5">
              <div>
                <span className="font-semibold text-text1">Address:</span> {building.address ?? "N/A"}
              </div>
              <div>
                <span className="font-semibold text-text1">Walk time:</span> {walkLabel ?? "N/A"}
              </div>
              {building.short_name && (
                <div>
                  <span className="font-semibold text-text1">Abbreviation:</span> {building.short_name}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
