import { useState } from "react"
import { useNavStore } from "../../../store/navStore"

export default function RouteDisplay() {
  const {
    isNavigating,
    navOverlayVisible,
    destination,
    distanceRemainingMiles,
    etaMinutes,
    arrivalTime,
    travelMode,
    setTravelMode,
  } = useNavStore()

  const [detailsOpen, setDetailsOpen] = useState(false)

  if (!isNavigating || !destination || !navOverlayVisible) return null

  // Format distance: show feet when < 0.1 mi, otherwise X.X mi
  const distanceValue = distanceRemainingMiles
    ? distanceRemainingMiles < 0.1
      ? `${Math.round(distanceRemainingMiles * 5280)}`
      : distanceRemainingMiles.toFixed(1)
    : "--"
  const distanceUnit = distanceRemainingMiles && distanceRemainingMiles < 0.1 ? "ft" : "mi"

  // Price display
  const priceLabel = destination.cost === null || destination.cost === undefined
    ? "N/A"
    : destination.cost === 0
      ? "Free"
      : `$${destination.cost.toFixed(2)} / hr`

  return (
    // Fixed bottom panel — .nav-bottom
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[22px] shadow-[0_-4px_20px_rgba(0,0,0,0.12)] overflow-hidden">

      {/* Stats grid — .nav-stats */}
      <div className="grid grid-cols-3 gap-2 p-4 pb-0">

        {/* Distance — maroon value */}
        <div className="bg-[#f2f2f7] rounded-[10px] p-2.5 text-center">
          <div className="text-[9px] text-text3 uppercase tracking-[0.5px] mb-0.5">Distance</div>
          <div className="text-[18px] font-black leading-none text-maroon">
            {distanceValue}
            <span className="text-[10px] font-normal text-text2 ml-0.5">{distanceUnit}</span>
          </div>
        </div>

        {/* ETA */}
        <div className="bg-[#f2f2f7] rounded-[10px] p-2.5 text-center">
          <div className="text-[9px] text-text3 uppercase tracking-[0.5px] mb-0.5">ETA</div>
          <div className="text-[18px] font-black leading-none text-text1">
            {etaMinutes ?? "--"}
            <span className="text-[10px] font-normal text-text2 ml-0.5">min</span>
          </div>
        </div>

        {/* Arrival time */}
        <div className="bg-[#f2f2f7] rounded-[10px] p-2.5 text-center">
          <div className="text-[9px] text-text3 uppercase tracking-[0.5px] mb-0.5">Arrive</div>
          <div className="text-[13px] font-black leading-none text-text2">
            {arrivalTime ?? "--"}
          </div>
        </div>

      </div>

      {/* Travel mode pills — .nav-modes: only Driving + Walking per demo */}
      <div className="flex gap-2 px-3.5 py-2.5">
        {(["driving", "walking"] as const).map((mode) => {
          const icon = { driving: "bi-car-front-fill", walking: "bi-person-walking" }[mode]
          const label = { driving: "Driving", walking: "Walking" }[mode]
          const active = travelMode === mode
          return (
            <button
              key={mode}
              onClick={() => setTravelMode(mode)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border-[1.5px] text-xs font-medium transition-colors ${
                active
                  ? "bg-maroon border-maroon text-white"
                  : "bg-white border-black/9 text-text2"
              }`}
            >
              <i className={`bi ${icon} text-sm`} />
              {label}
            </button>
          )
        })}
      </div>

      {/* "see details" toggle row — .nav-see-row */}
      <button
        onClick={() => setDetailsOpen(!detailsOpen)}
        className="w-full border-t border-black/9 flex items-center justify-center gap-1 py-2.5"
      >
        <span className="text-[12px] font-semibold text-maroon">see details</span>
        <i className={`bi bi-chevron-${detailsOpen ? "up" : "down"} text-[11px] text-maroon`} />
      </button>

      {/* Collapsible trip details — .nav-det-exp */}
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          detailsOpen ? "max-h-[200px]" : "max-h-0"
        }`}
      >
        <div className="px-3.5 pt-2.5 pb-4 border-t border-black/9">
          <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-text3 mb-2">
            Trip Details
          </div>
          {[
            { k: "Destination",   v: destination.spot_name,                    maroon: false },
            { k: "Parking Cost",  v: priceLabel,                               maroon: true  },
            { k: "Campus",        v: destination.campus_location ?? "--",       maroon: false },
            { k: "Parking Type",  v: destination.parking_type ?? "--",          maroon: false },
          ].map(({ k, v, maroon }) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-black/5 last:border-b-0">
              <span className="text-[12px] text-text2">{k}</span>
              <span className={`text-[12px] font-semibold ${maroon ? "text-maroon" : "text-text1"}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
