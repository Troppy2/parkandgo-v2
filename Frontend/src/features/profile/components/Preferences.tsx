import { useState, useEffect } from "react"
import clsx from "clsx"
import { useUIStore } from "../../../store/uiStore"

export default function Preferences() {
    const {
        verifiedOnly,
        setVerifiedOnly,
        directionsOnly,
        setDirectionsOnly,
        darkMode,
        setDarkMode,
        showToast,
    } = useUIStore()

    // ── Notification permission state ──
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        if (typeof Notification === "undefined") return false
        return Notification.permission === "granted"
    })

    const handleNotificationsToggle = async () => {
        if (typeof Notification === "undefined") return
        if (notificationsEnabled) {
            // Can't revoke programmatically — inform user
            setNotificationsEnabled(false)
            showToast("To fully disable, revoke in browser site settings", "error")
            return
        }
        if (Notification.permission === "denied") {
            showToast("Notifications blocked — enable in browser site settings", "error")
            return
        }
        const result = await Notification.requestPermission()
        setNotificationsEnabled(result === "granted")
    }

    // ── Location permission state ──
    const [locationEnabled, setLocationEnabled] = useState(false)

    useEffect(() => {
        if (!navigator.permissions) return
        navigator.permissions.query({ name: "geolocation" }).then((status) => {
            setLocationEnabled(status.state === "granted")
            status.onchange = () => setLocationEnabled(status.state === "granted")
        })
    }, [])

    const handleLocationToggle = () => {
        if (locationEnabled) {
            setLocationEnabled(false)
            showToast("To fully revoke, use browser site settings", "error")
            return
        }
        // Always call with timeout — avoids UI freeze if browser hangs on permission prompt
        navigator.geolocation.getCurrentPosition(
            () => setLocationEnabled(true),
            () => showToast("Location access denied — check browser site settings", "error"),
            { timeout: 8000, maximumAge: 60000 }
        )
    }

    return (
        <div className="px-5 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text2 mb-2">
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
                    onClick={handleNotificationsToggle}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        notificationsEnabled ? "bg-maroon" : "bg-[var(--color-toggle-off)]"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                        notificationsEnabled ? "translate-x-5" : "translate-x-0"
                    )} />
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
                    onClick={handleLocationToggle}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        locationEnabled ? "bg-maroon" : "bg-[var(--color-toggle-off)]"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                        locationEnabled ? "translate-x-5" : "translate-x-0"
                    )} />
                </button>
            </div>

            {/* Dark Mode */}
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
                        darkMode ? "bg-maroon" : "bg-[var(--color-toggle-off)]"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                        darkMode ? "translate-x-5" : "translate-x-0"
                    )} />
                </button>
            </div>

            {/* Verified Spots Only */}
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
                        verifiedOnly ? "bg-maroon" : "bg-[var(--color-toggle-off)]"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                        verifiedOnly ? "translate-x-5" : "translate-x-0"
                    )} />
                </button>
            </div>

            {/* Spots With Directions Only */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-maroon-light flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-sign-turn-right-fill text-maroon text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Spots With Directions Only</div>
                    <div className="text-[11px] text-text2 mt-0.5">Hide spots that cannot start navigation</div>
                </div>
                <button
                    type="button"
                    onClick={() => setDirectionsOnly(!directionsOnly)}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        directionsOnly ? "bg-maroon" : "bg-[var(--color-toggle-off)]"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                        directionsOnly ? "translate-x-5" : "translate-x-0"
                    )} />
                </button>
            </div>
        </div>
    )
}
