import { useState } from "react"
import clsx from "clsx"
import { useUIStore } from "../../../store/uiStore"

export default function Preferences() {
    const { verifiedOnly, setVerifiedOnly, darkMode, setDarkMode } = useUIStore()
    // Notifications toggle is UI-only — real push notifications are a Phase 20+ concern
    const [notificationsEnabled, setNotificationsEnabled] = useState(false)
    const [locationEnabled, setLocationEnabled] = useState(false)

    return (
        <div className="px-5 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text3 mb-2">
                Preferences
            </div>

            {/* Notifications */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[rgba(0,122,255,0.1)] flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-bell-fill text-blue text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Notifications</div>
                    <div className="text-[11px] text-text2 mt-0.5">Spot availability alerts</div>
                </div>
                <button
                    type="button"
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        notificationsEnabled ? "bg-maroon" : "bg-border2"
                    )}
                >
                    <div
                        className={clsx(
                            "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                            notificationsEnabled ? "translate-x-5" : "translate-x-0"
                        )}
                    />
                </button>
            </div>

            {/* Location Access */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[rgba(52,199,89,0.1)] flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-geo-alt-fill text-green text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Location Access</div>
                    <div className="text-[11px] text-text2 mt-0.5">Used for distance and navigation</div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setLocationEnabled(!locationEnabled)
                        navigator.geolocation.getCurrentPosition(() => {})
                    }}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        locationEnabled ? "bg-maroon" : "bg-border2"
                    )}
                >
                    <div
                        className={clsx(
                            "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                            locationEnabled ? "translate-x-5" : "translate-x-0"
                        )}
                    />
                </button>
            </div>

            {/* Dark Mode Row */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-maroon-light flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-moon-fill text-maroon text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Dark Mode</div>
                </div>
                <button
                    type="button"
                    onClick={() => setDarkMode(!darkMode)}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        darkMode ? "bg-maroon" : "bg-border2"
                    )}
                >
                    <div
                        className={clsx(
                            "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                            darkMode ? "translate-x-5" : "translate-x-0"
                        )}
                    />
                </button>
            </div>

            {/* Verified Parking spots row */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-gold-light flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-patch-check-fill text-gold-dark text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Verified Spots Only</div>
                </div>
                <button
                    type="button"
                    onClick={() => setVerifiedOnly(!verifiedOnly)}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        verifiedOnly ? "bg-maroon" : "bg-border2"
                    )}
                >
                    <div
                        className={clsx(
                            "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                            verifiedOnly ? "translate-x-5" : "translate-x-0"
                        )}
                    />
                </button>
            </div>

        </div>
    )
}
