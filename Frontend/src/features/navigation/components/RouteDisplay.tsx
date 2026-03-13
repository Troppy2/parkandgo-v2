import { useNavStore } from "../../../store/navStore"

interface StatBoxProps {
  label: string
  value: string
  unit: string
  highlight?: boolean
}

function StatBox({ label, value, unit, highlight = false }: StatBoxProps) {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-3">
      <span className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</span>
      <span className={`text-2xl font-bold leading-none ${highlight ? "text-maroon" : "text-gray-900"}`}>
        {value}
      </span>
      {unit && <span className="text-xs text-gray-400 mt-1">{unit}</span>}
    </div>
  )
}

export default function RouteDisplay() {
  const {
    isNavigating,
    distanceRemainingMiles,
    etaMinutes,
    arrivalTime,
    travelMode,
    setTravelMode,
  } = useNavStore()

  if (!isNavigating) return null

  // Format distance for display
  const distanceDisplay = distanceRemainingMiles
    ? distanceRemainingMiles < 0.1
      ? `${Math.round(distanceRemainingMiles * 5280)}`  // show feet if very close
      : distanceRemainingMiles.toFixed(1)
    : "--"

  const distanceUnit = distanceRemainingMiles && distanceRemainingMiles < 0.1
    ? "feet"
    : "miles"

  return (
    // Fixed to bottom, white, rounded top corners
    // Matches .nav-bottom: rounded-t-[22px], shadow-lg
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[22px] shadow-lg overflow-hidden">

      {/* Three stat boxes */}
      <div className="grid grid-cols-3 gap-2 p-4 pb-0">
        <StatBox
          label="Distance"
          value={distanceDisplay}
          unit={distanceUnit}
          highlight={true}
        />
        <StatBox
          label="ETA"
          value={etaMinutes ? `${etaMinutes}` : "--"}
          unit="min"
        />
        <StatBox
          label="Arrival"
          value={arrivalTime ?? "--"}
          unit=""
        />
      </div>

      {/* Travel mode buttons */}
      <div className="grid grid-cols-3 gap-2 p-4">
        {(["walking", "driving", "cycling"] as const).map((mode) => {
          const icon = { walking: "bi-person-walking", driving: "bi-car-front-fill", cycling: "bi-bicycle" }[mode]
          const label = { walking: "Walking", driving: "Driving", cycling: "Cycling" }[mode]
          const active = travelMode === mode
          return (
            <button
              key={mode}
              onClick={() => setTravelMode(mode)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-[10px] border text-xs font-semibold ${
                active ? "bg-maroon border-maroon text-white" : "bg-white border-black/9 text-text2"
              }`}
            >
              <i className={`bi ${icon} text-base`} />
              {label}
            </button>
          )
        })}
      </div>

      <div className="border-t flex justify-center items-center gap-1 py-3 text-maroon cursor-pointer">
        <i className="bi bi-chevron-up" /> See spot details
      </div>

    </div>
  )
}