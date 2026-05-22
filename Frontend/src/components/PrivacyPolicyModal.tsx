import { useEffect } from "react"

interface PrivacyPolicyModalProps {
  onClose: () => void
}

export default function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-modal-surface,#ffffff)] rounded-[18px] w-full max-w-[360px] max-h-[70vh] overflow-y-auto p-5 shadow-xl"
        style={{ scrollbarWidth: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[16px] font-bold text-text1">Privacy Policy</span>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-black/7 rounded-full flex items-center justify-center text-text2"
            aria-label="Close privacy policy"
          >
            <i className="bi bi-x-lg text-[11px]" />
          </button>
        </div>
        <div className="space-y-3 text-[12px] text-text2 leading-relaxed">
          <p>
            Park &amp; Go uses your location only while the app is in use so we can show nearby parking options, routes, estimated walk times, and related campus information.
          </p>
          <p>
            If you sign in with Google, we may store your name, email address, profile photo, saved spots, preferences, and app activity needed to personalize the experience. We do not sell your personal information.
          </p>
          <p>
            Parking information, pricing, availability, routes, and event details may be incomplete or out of date. Always follow posted signs, campus rules, local laws, payment requirements, and your own judgment before parking or walking anywhere.
          </p>
          <p>
            Park &amp; Go is not responsible for tickets, towing, fees, theft, damage, injuries, accidents, missed events, or any other loss that may happen while you park, travel to, leave from, or use a parking location suggested by the app.
          </p>
          <p>
            You can request help, ask questions, or request deletion of your data by contacting jamesinah34@gmail.com.
          </p>
        </div>
      </div>
    </div>
  )
}
