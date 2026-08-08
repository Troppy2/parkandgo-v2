import { useState } from "react"

import { useNavStore } from "../../../store/navStore"
import { useUIStore } from "../../../store/uiStore"
import { createParkingHistory, logContextEvent } from "../services/navigationApi"
import { formatEta } from "../utils/formatEta"
import { formatParkingCost } from "../../../lib/parking/formatters"

const START_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 12000,
  maximumAge: 30000,
} as const

export default function RouteDisplay() {
  const {
    isNavigating,
    hasStartedNavigation,
    destination,
    distanceRemainingMiles,
    etaMinutes,
    arrivalTime,
    travelMode,
    setTravelMode,
    beginNavigation,
    endNavigation,
    currentUserLocation,
    setCurrentUserLocation,
    setRouteError,
  } = useNavStore()
  const campusRoutingEnabled = useUIStore((s) => s.campusRoutingEnabled)
  const appMode = useUIStore((s) => s.appMode)
  // Campus Mode routes to buildings, and you cannot drive across a sidewalk.
  // Reuses the existing walking lock rather than adding a parallel mechanism.
  const walkingOnly = !campusRoutingEnabled || appMode === "campus"

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  if (!isNavigating || !destination) return null

  const writeNavigationHistory = async () => {
    try {
      await createParkingHistory({
        spot_id: destination.spot_id,
        start_time: new Date().toISOString(),
      })
    } catch {
      // Keep navigation non-blocking if history logging fails.
    }
  }

  const logNavigationStart = (source: "cached_location" | "gps" | "manual_fallback") => {
    void logContextEvent("navigation_start", {
      spot_id: destination.spot_id,
      travel_mode: walkingOnly ? "walking" : travelMode,
      campus_routing_enabled: campusRoutingEnabled,
      source,
    }).catch(() => undefined)
  }

  const startNavigationFlow = (source: "cached_location" | "gps" | "manual_fallback") => {
    beginNavigation()
    void writeNavigationHistory()
    logNavigationStart(source)
  }

  const handleStart = () => {
    if (isStarting || hasStartedNavigation) return

    if (currentUserLocation) {
      startNavigationFlow("cached_location")
      return
    }

    if (!navigator.geolocation) {
      startNavigationFlow("manual_fallback")
      setRouteError("Geolocation is unavailable on this device.")
      return
    }

    setIsStarting(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentUserLocation({
          coords: [pos.coords.longitude, pos.coords.latitude],
          heading: pos.coords.heading ?? 0,
        })
        startNavigationFlow("gps")
        setIsStarting(false)
      },
      () => {
        startNavigationFlow("manual_fallback")
        setRouteError("We couldn't get your location. Move somewhere with GPS access and retry.")
        setIsStarting(false)
      },
      START_GEOLOCATION_OPTIONS
    )
  }

  const distanceValue = distanceRemainingMiles
    ? distanceRemainingMiles < 0.1
      ? `${Math.round(distanceRemainingMiles * 5280)}`
      : distanceRemainingMiles.toFixed(1)
    : "--"
  const distanceUnit = distanceRemainingMiles && distanceRemainingMiles < 0.1 ? "ft" : "mi"

  const formattedCost = formatParkingCost(destination.cost)
  const priceLabel = formattedCost === "N/A" || formattedCost === "Free"
    ? formattedCost
    : `${formattedCost} / hr`

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[22px] shadow-[0_-4px_20px_rgba(0,0,0,0.12)] overflow-hidden pb-safe">
      <div className="grid grid-cols-3 gap-2 p-4 pb-0">
        <div className="bg-[#f2f2f7] rounded-[10px] p-2.5 text-center">
          <div className="text-[9px] text-text3 uppercase tracking-[0.5px] mb-0.5">Distance</div>
          <div className="text-[18px] font-black leading-none text-maroon">
            {distanceValue}
            <span className="text-[10px] font-normal text-text2 ml-0.5">{distanceUnit}</span>
          </div>
        </div>

        {(() => {
          const eta = etaMinutes != null ? formatEta(etaMinutes) : null
          return (
            <div className="bg-[#f2f2f7] rounded-[10px] p-2.5 text-center">
              <div className="text-[9px] text-text3 uppercase tracking-[0.5px] mb-0.5">ETA</div>
              <div className="text-[18px] font-black leading-none text-text1">
                {eta ? (
                  <>
                    {eta.primary}
                    {eta.secondary && (
                      <span className="text-[10px] font-normal text-text2 ml-0.5">{eta.secondary}</span>
                    )}
                  </>
                ) : (
                  <>
                    {"--"}
                    <span className="text-[10px] font-normal text-text2 ml-0.5">min</span>
                  </>
                )}
              </div>
            </div>
          )
        })()}

        <div className="bg-[#f2f2f7] rounded-[10px] p-2.5 text-center">
          <div className="text-[9px] text-text3 uppercase tracking-[0.5px] mb-0.5">Arrive</div>
          <div className="text-[13px] font-black leading-none text-text2">{arrivalTime ?? "--"}</div>
        </div>
      </div>

      <div className="flex gap-2 px-3.5 py-2.5 flex-wrap">
        {walkingOnly && (
          <div className="w-full rounded-[10px] bg-maroon-light px-3 py-2 text-[11px] text-maroon">
            {appMode === "campus"
              ? "Campus Mode uses walking directions."
              : "Campus routing is off. Walking is used for campus directions."}
          </div>
        )}
        {(["driving", "walking"] as const).map((mode) => {
          const icon = { driving: "bi-car-front-fill", walking: "bi-person-walking" }[mode]
          const label = { driving: "Driving", walking: "Walking" }[mode]
          const active = (walkingOnly ? "walking" : travelMode) === mode
          const disabled = walkingOnly && mode !== "walking"
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  setTravelMode(mode)
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border-[1.5px] text-xs font-medium transition-colors ${
                active
                  ? "bg-maroon border-maroon text-white"
                  : "bg-white border-black/9 text-text1"
              }`}
            >
              <i className={`bi ${icon} text-sm`} />
              {label}
            </button>
          )
        })}
      </div>

      {!hasStartedNavigation && (
        <div className="px-3.5 pb-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              void logContextEvent("navigation_cancelled", {
                spot_id: destination.spot_id,
                reason: "pre_navigation",
              }).catch(() => undefined)
              endNavigation()
            }}
            className="flex-1 bg-white border border-black/15 text-text1 rounded-full py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={isStarting}
            className="flex-[1.6] bg-maroon text-white rounded-full py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <i className={`bi ${isStarting ? "bi-arrow-repeat animate-spin" : "bi-play-fill"} text-base`} />
            {isStarting ? "Starting..." : "Start"}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setDetailsOpen(!detailsOpen)}
        className="w-full border-t border-black/9 flex items-center justify-center gap-1 py-2.5"
      >
        <span className="text-[12px] font-semibold text-maroon">see details</span>
        <i className={`bi bi-chevron-${detailsOpen ? "up" : "down"} text-[11px] text-maroon`} />
      </button>

      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          detailsOpen ? "max-h-[200px]" : "max-h-0"
        }`}
      >
        <div className="px-3.5 pt-2.5 pb-4 border-t border-black/9">
          <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-text3 mb-2">Trip Details</div>
          {[
            { k: "Destination", v: destination.spot_name, maroon: false },
            // Cost and type are parking concepts. A campus building destination
            // has neither, so these rows are dropped rather than shown as "--".
            ...(destination.cost !== null
              ? [{ k: "Parking Cost", v: priceLabel, maroon: true }]
              : []),
            { k: "Campus", v: destination.campus_location ?? "--", maroon: false },
            ...(destination.parking_type !== null
              ? [{ k: "Parking Type", v: destination.parking_type, maroon: false }]
              : []),
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
