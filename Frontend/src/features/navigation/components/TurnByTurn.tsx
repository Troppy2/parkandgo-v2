import { useNavStore } from "../../../store/navStore"

export default function TurnByTurn() {
  const {
    isNavigating,
    navOverlayVisible,
    destination,
    endNavigation,
    setNavOverlayVisible,
    route,
    currentStepIndex,
  } = useNavStore()

  if (!isNavigating || !destination || !navOverlayVisible) return null

  const currentStep = route?.steps[currentStepIndex]

  return (
    <>
      {/* Maroon top bar — .nav-top */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-maroon px-3.5 pt-10 pb-3.5 flex items-start gap-2.5">

        {/* Direction icon — .nav-dir-ico */}
        <div className="w-[38px] h-[38px] bg-white/[0.18] rounded-[10px] flex items-center justify-center flex-shrink-0">
          <i className={`bi ${currentStep?.icon ?? "bi-arrow-return-right"} text-white text-xl`} />
        </div>

        {/* Instruction + sub-label — .nav-dir-main / .nav-dir-sub */}
        <div className="flex-1">
          <div className="text-white font-bold text-base leading-snug">
            {currentStep?.instruction ?? `Heading to ${destination.spot_name}`}
          </div>
          <div className="text-white/[0.72] text-[12px] mt-0.5">
            {currentStep ? `In ${currentStep.distance}` : "Calculating route…"}
          </div>
        </div>

        {/* Back/Cancel — returns to spot list without ending navigation */}
        <button
          onClick={() => setNavOverlayVisible(false)}
          className="bg-white/20 border border-white/30 text-white rounded-full px-3 py-1.5 text-[12px] font-semibold flex-shrink-0 flex items-center gap-1"
        >
          <i className="bi bi-arrow-left text-base leading-none" />
          Back
        </button>

        {/* End button — ends navigation entirely */}
        <button
          onClick={endNavigation}
          className="bg-white/20 border border-white/30 text-white rounded-full px-3 py-1.5 text-[12px] font-semibold flex-shrink-0 flex items-center gap-1"
        >
          <i className="bi bi-x text-base leading-none" />
          End
        </button>

      </div>

      {/* Street name overlay — .nav-street (dark band just below the top bar) */}
      <div className="fixed left-0 right-0 z-40 bg-black/[0.52] backdrop-blur-sm px-3.5 py-1.5 flex items-center justify-between" style={{ top: "100px" }}>
        <span className="text-[13px] font-semibold text-white truncate">
          {destination.address ?? destination.spot_name}
        </span>
        <span className="text-[11px] font-bold text-white bg-white/15 rounded px-2 py-0.5 flex-shrink-0 ml-2">
          {destination.parking_type ?? "Parking"}
        </span>
      </div>
    </>
  )
}
