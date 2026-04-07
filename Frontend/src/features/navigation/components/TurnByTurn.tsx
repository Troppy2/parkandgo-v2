import { useNavStore } from "../../../store/navStore";
import { useUIStore } from "../../../store/uiStore";
import { useNavigationTTS } from "../hooks/useNavigationTTS";
import { logContextEvent } from "../services/navigationApi";

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
    setNavOverlayVisible,
  } = useNavStore();
  const ttsEnabled = useUIStore((s) => s.ttsEnabled);
  const selectedTTSVoice = useUIStore((s) => s.selectedTTSVoice);
  const currentStep = route?.steps[currentStepIndex];
  const destinationSpotId = destination?.spot_id;

  // Must be called unconditionally — before any early return — to satisfy Rules of Hooks.
  // The `enabled` flag gates actual TTS behavior when conditions aren't met.
  useNavigationTTS({
    enabled: ttsEnabled && routeStatus === "ready" && hasStartedNavigation,
    text: currentStep?.instruction ?? null,
    preferredVoiceName: selectedTTSVoice,
  });

  if (!isNavigating || !hasStartedNavigation || !destination || !navOverlayVisible) return null;
  
  // Show "End" button only when actively navigating (not during errors or loading)
  const isActivelyNavigating = routeStatus === "ready" && hasStartedNavigation;
  const hasNavigationHistory = currentStepIndex > 0 || routeStatus !== "idle";

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

        {/* "Back" button - hide during active navigation, show to hide the overlay */}
        {!isActivelyNavigating && hasNavigationHistory && (
          <button
            onClick={() => {
              setNavOverlayVisible(false)
              if (destinationSpotId != null) {
                void logContextEvent("navigation_overlay_hidden", {
                  spot_id: destinationSpotId,
                  route_status: routeStatus,
                }).catch(() => undefined)
              }
            }}
            className="bg-white/20 border border-white/30 text-white rounded-full px-3 py-1.5 text-[12px] font-semibold flex-shrink-0 flex items-center gap-1 hover:bg-white/30 transition-colors"
          >
            <i className="bi bi-arrow-left text-base leading-none" />
            Back
          </button>
        )}

        {/* "End" button - show only during active navigation */}
        {isActivelyNavigating && (
          <button
            onClick={() => {
              if (destinationSpotId != null) {
                void logContextEvent("navigation_end", {
                  spot_id: destinationSpotId,
                  route_status: routeStatus,
                  current_step_index: currentStepIndex,
                }).catch(() => undefined)
              }
              endNavigation()
            }}
            className="bg-white/20 border border-white/30 text-white rounded-full px-3 py-1.5 text-[12px] font-semibold flex-shrink-0 flex items-center gap-1 hover:bg-white/30 transition-colors"
          >
            <i className="bi bi-x text-base leading-none" />
            End
          </button>
        )}
      </div>
    </>
  );
}
