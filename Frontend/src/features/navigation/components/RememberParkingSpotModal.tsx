import { useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useAuthStore } from "../../../store/authStore"
import { useNavStore } from "../../../store/navStore"
import { useUIStore } from "../../../store/uiStore"
import { createPrivateSpot } from "../../profile/services/privateSpotsApi"
import { privateSpotToParkingSpot } from "../../profile/utils/privateSpotMappers"
import { scheduleParkingReminder } from "../services/parkingReminderScheduler"
import { logContextEvent } from "../services/navigationApi"

export default function RememberParkingSpotModal() {
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const showToast = useUIStore((s) => s.showToast)
  const currentUserLocation = useNavStore((s) => s.currentUserLocation)
  const promptOpen = useNavStore((s) => s.arrivalRememberPromptOpen)
  const promptSpot = useNavStore((s) => s.arrivalRememberSpot)
  const setRememberedSpot = useNavStore((s) => s.setRememberedSpot)
  const dismissPrompt = useNavStore((s) => s.dismissRememberSpotPrompt)

  const saveMutation = useMutation({
    mutationFn: async ({
      latitude,
      longitude,
      source,
    }: {
      latitude: number
      longitude: number
      source: "gps" | "manual"
    }) =>
      createPrivateSpot({
        name: `Parked near ${promptSpot!.spot_name}`,
        latitude,
        longitude,
        notes: source === "gps"
          ? "Saved from arrival prompt via GPS"
          : "Saved from arrival prompt manually",
        is_default: true,
      }),
    onSuccess: async (privateSpot, variables) => {
      setRememberedSpot(privateSpotToParkingSpot(privateSpot))
      void queryClient.invalidateQueries({ queryKey: ["private-spots"] })
      dismissPrompt()

      void logContextEvent("remember_parking_spot_saved", {
        spot_id: promptSpot?.spot_id,
        saved_private_spot_id: privateSpot.private_spot_id,
        source: variables.source,
      }).catch(() => undefined)

      const reminderStatus = await scheduleParkingReminder(privateSpot.name)
      if (reminderStatus === "scheduled") {
        showToast("Spot saved. We will remind you in 2 hours.", "success")
      } else if (reminderStatus === "denied") {
        showToast("Spot saved. Enable notifications to get the 2-hour reminder.", "error")
      } else {
        showToast("Spot saved. Notifications are not supported on this device.", "error")
      }
    },
    onError: () => {
      showToast("Could not save your parking spot", "error")
    },
  })

  useEffect(() => {
    if (!promptOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissPrompt()
    }
    document.addEventListener("keydown", onEscape)
    return () => document.removeEventListener("keydown", onEscape)
  }, [promptOpen, dismissPrompt])

  if (!promptOpen || !promptSpot) return null

  const handleRemember = async () => {
    if (!isAuthenticated) {
      showToast("Sign in to save remembered spots", "error")
      dismissPrompt()
      return
    }

    const latFromLiveGps = currentUserLocation?.coords[1]
    const lngFromLiveGps = currentUserLocation?.coords[0]
    const latitude = latFromLiveGps ?? promptSpot.latitude
    const longitude = lngFromLiveGps ?? promptSpot.longitude

    if (latitude == null || longitude == null) {
      showToast("Could not save parking spot coordinates", "error")
      dismissPrompt()
      return
    }

    await saveMutation.mutateAsync({
      latitude,
      longitude,
      source: currentUserLocation ? "gps" : "manual",
    })
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      onClick={dismissPrompt}
    >
      <div
        className="w-full max-w-[360px] rounded-[18px] bg-[var(--color-modal-surface)] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 h-8 w-8 shrink-0 rounded-[10px] bg-maroon-light flex items-center justify-center">
            <i className="bi bi-pin-map-fill text-maroon text-[14px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-text1">Remember this parking spot?</div>
            <div className="mt-1 text-[12px] text-text2">
              You just arrived at {promptSpot.spot_name}. Save it to My Spots and get a reminder in 2 hours.
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={dismissPrompt}
            className="flex-1 rounded-[10px] border border-black/15 py-2.5 text-[12px] font-semibold text-text1"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleRemember}
            disabled={saveMutation.isPending}
            className="flex-1 rounded-[10px] bg-maroon py-2.5 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? "Saving..." : "Yes, remember it"}
          </button>
        </div>
      </div>
    </div>
  )
}
