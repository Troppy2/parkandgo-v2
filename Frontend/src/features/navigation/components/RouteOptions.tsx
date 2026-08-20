import clsx from "clsx"

import { useNavStore } from "../../../store/navStore"

/**
 * The routes the router offered, as a row of cards.
 *
 * Only rendered when there is a real choice. One option is not a decision, and
 * a single card saying "Best route" is a label pretending to be a control.
 * That case is common on foot: the OSRM pedestrian profile usually returns one
 * route, because most walking detours come out the same length.
 *
 * Ordered as OSRM returned them, best first, and never re-sorted. The first
 * card is marked "Fastest" rather than the list being rearranged, so a card
 * does not move out from under a thumb when the trip is re-routed.
 */
export default function RouteOptions() {
  const routeOptions = useNavStore((s) => s.routeOptions)
  const selectedRouteIndex = useNavStore((s) => s.selectedRouteIndex)
  const selectRoute = useNavStore((s) => s.selectRoute)

  if (routeOptions.length < 2) return null

  const fastest = Math.min(...routeOptions.map((option) => option.totalDurationSeconds))

  return (
    <div
      className="flex gap-2 px-3.5 pb-2.5 overflow-x-auto"
      role="radiogroup"
      aria-label="Route options"
    >
      {routeOptions.map((option, index) => {
        const selected = index === selectedRouteIndex
        const minutes = Math.max(1, Math.round(option.totalDurationSeconds / 60))
        const miles = option.totalDistanceMeters / 1609.34
        // Against the best time rather than against the selected one, so the
        // labels do not all change meaning when the selection moves.
        const deltaMinutes = Math.round((option.totalDurationSeconds - fastest) / 60)

        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => selectRoute(index)}
            className={clsx(
              "flex-1 min-w-[96px] min-h-[44px] rounded-[10px] border-[1.5px] px-2.5 py-2 text-left transition-colors",
              selected
                ? "border-maroon bg-maroon-light"
                : "border-black/12 bg-white hover:border-maroon"
            )}
          >
            <div
              className={clsx(
                "text-[15px] font-black leading-none",
                selected ? "text-maroon" : "text-text1"
              )}
            >
              {minutes}
              <span className="text-[10px] font-normal text-text2 ml-0.5">min</span>
            </div>
            <div className="text-[11px] text-text2 mt-1">
              {miles.toFixed(1)} mi
              {deltaMinutes > 0 && ` · +${deltaMinutes} min`}
            </div>
            {deltaMinutes === 0 && (
              <div className="text-[10px] font-semibold uppercase tracking-[0.4px] text-maroon mt-0.5">
                Fastest
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
