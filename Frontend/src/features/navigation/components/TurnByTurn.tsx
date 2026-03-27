import { useNavStore } from "../../../store/navStore";

export default function TurnByTurn() {
  const {
    isNavigating,
    hasStartedNavigation,
    navOverlayVisible,
    destination,
    endNavigation,
    retryRoute,
    route,
    routeError,
    routeNotice,
    routeStatus,
    currentStepIndex,
  } = useNavStore();

  if (!isNavigating || !hasStartedNavigation || !destination || !navOverlayVisible) return null;

  const currentStep = route?.steps[currentStepIndex];

  const title =
    routeStatus === "error"
      ? "Couldn't load turn-by-turn directions"
      : routeStatus === "loading"
        ? "Calculating your route"
        : currentStep?.instruction ?? `Heading to ${destination.spot_name}`;

  const subtitle =
    routeStatus === "error"
      ? routeError ?? "Retry to request directions again."
      : routeStatus === "loading"
        ? "Getting your location and live directions..."
        : currentStep
          ? `In ${currentStep.distance}`
          : "Waiting for the next maneuver...";

  const icon =
    routeStatus === "error"
      ? "bi-exclamation-triangle-fill"
      : routeStatus === "loading"
        ? "bi-arrow-repeat"
        : currentStep?.icon ?? "bi-arrow-return-right";

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-maroon px-3.5 pt-10 pb-3.5 flex items-start gap-2.5">
        <div className="w-[38px] h-[38px] bg-white/[0.18] rounded-[10px] flex items-center justify-center flex-shrink-0">
          <i
            className={`bi ${icon} text-white text-xl ${
              routeStatus === "loading" ? "animate-spin" : ""
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-base leading-snug">{title}</div>
          <div className="text-white/[0.72] text-[12px] mt-0.5">{subtitle}</div>
          {routeNotice && routeStatus === "ready" && (
            <div className="text-white/[0.82] text-[11px] mt-1 flex items-center gap-2">
              <span>{routeNotice}</span>
              <button
                onClick={retryRoute}
                className="underline underline-offset-2 font-semibold"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {routeStatus === "error" && (
          <button
            onClick={retryRoute}
            className="bg-gold/90 text-maroon rounded-full px-3 py-1.5 text-[12px] font-semibold flex-shrink-0"
          >
            Retry
          </button>
        )}

        <button
          onClick={endNavigation}
          className="bg-white/20 border border-white/30 text-white rounded-full px-3 py-1.5 text-[12px] font-semibold flex-shrink-0 flex items-center gap-1"
        >
          <i className="bi bi-arrow-left text-base leading-none" />
          Back
        </button>

        <button
          onClick={endNavigation}
          className="bg-white/20 border border-white/30 text-white rounded-full px-3 py-1.5 text-[12px] font-semibold flex-shrink-0 flex items-center gap-1"
        >
          <i className="bi bi-x text-base leading-none" />
          End
        </button>
      </div>
    </>
  );
}
