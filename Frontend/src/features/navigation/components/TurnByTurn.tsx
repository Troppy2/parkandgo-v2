import { useNavStore } from "../../../store/navStore"

export default function TurnByTurn() {
  const { isNavigating, destination, endNavigation, route, currentStepIndex } = useNavStore()

  if (!isNavigating || !destination) return null

  const currentStep = route?.steps[currentStepIndex]

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-maroon px-3.5 pt-10 pb-3.5 flex items-start gap-2.5">

      {/* Direction icon */}
      <div className="w-[38px] h-[38px] bg-white/18 rounded-[10px] flex items-center justify-center flex-shrink-0">
        <i className={`bi ${currentStep?.icon ?? "bi-arrow-up-circle-fill"} text-white text-xl`} />
      </div>

      {/* Instruction + distance */}
      <div className="flex-1">
        <div className="text-white font-bold text-base">
          {currentStep?.instruction ?? `Heading to ${destination.spot_name}`}
        </div>
        <div className="text-white/72 text-xs mt-0.5">
          {currentStep ? `In ${currentStep.distance}` : "Calculating route..."}
        </div>
      </div>

      {/* End button */}
      <button
        className="bg-white/20 border border-white/30 text-white rounded-full px-3 py-1.5 text-xs font-semibold"
        onClick={endNavigation}
      >
        End
      </button>

    </div>
  )
}
