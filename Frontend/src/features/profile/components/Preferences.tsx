import { useState, useEffect } from "react"
import clsx from "clsx"
import { useUIStore } from "../../../store/uiStore"
import { useNavStore } from "../../../store/navStore"
import { logContextEvent } from "../../navigation/services/navigationApi"

export default function Preferences() {
    const {
        verifiedOnly,
        setVerifiedOnly,
        directionsOnly,
        setDirectionsOnly,
        darkMode,
        setDarkMode,
        dataConsent,
        setDataConsent,
        ttsEnabled,
        setTTSEnabled,
        selectedTTSVoice,
        setSelectedTTSVoice,
        campusRoutingEnabled,
        setCampusRoutingEnabled,
        showToast,
    } = useUIStore()
    const travelMode = useNavStore((s) => s.travelMode)
    const setTravelMode = useNavStore((s) => s.setTravelMode)

    // ── Notification permission state ──
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        if (typeof Notification === "undefined") return false
        return Notification.permission === "granted"
    })

    const handleNotificationsToggle = async () => {
        if (typeof Notification === "undefined") return
        if (notificationsEnabled) {
            // Can't revoke programmatically - inform user
            setNotificationsEnabled(false)
            showToast("To fully disable, revoke in browser site settings", "error")
            return
        }
        if (Notification.permission === "denied") {
            showToast("Notifications blocked - enable in browser site settings", "error")
            return
        }
        const result = await Notification.requestPermission()
        setNotificationsEnabled(result === "granted")
    }

    // ── Location permission state ──
    const [locationEnabled, setLocationEnabled] = useState(false)
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

    useEffect(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return

        const updateVoices = () => {
            const voices = window.speechSynthesis
                .getVoices()
                .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
                .sort((a, b) => a.name.localeCompare(b.name))
            setAvailableVoices(voices)
        }

        updateVoices()
        window.speechSynthesis.addEventListener("voiceschanged", updateVoices)
        return () => window.speechSynthesis.removeEventListener("voiceschanged", updateVoices)
    }, [])

    useEffect(() => {
        if (!selectedTTSVoice || availableVoices.length === 0) return
        const stillAvailable = availableVoices.some((voice) => voice.name === selectedTTSVoice)
        if (!stillAvailable) {
            setSelectedTTSVoice(null)
            showToast("Selected voice is not available on this device. Using default voice.", "error")
        }
    }, [availableVoices, selectedTTSVoice, setSelectedTTSVoice, showToast])

    useEffect(() => {
        if (!navigator.permissions) return
        navigator.permissions.query({ name: "geolocation" }).then((status) => {
            setLocationEnabled(status.state === "granted")
            status.onchange = () => setLocationEnabled(status.state === "granted")
        })
    }, [])

    useEffect(() => {
        localStorage.setItem("parkandgo-data-consent", dataConsent ? "true" : "false")
    }, [dataConsent])

    const handleTTSToggle = () => {
        const next = !ttsEnabled
        setTTSEnabled(next)
        void logContextEvent("user_action", {
            setting: "tts_navigation",
            enabled: next,
        }).catch(() => undefined)
    }

    const handleCampusRoutingToggle = () => {
        const next = !campusRoutingEnabled
        setCampusRoutingEnabled(next)

        if (!next && travelMode !== "walking") {
            setTravelMode("walking")
        }

        void logContextEvent("user_action", {
            setting: "campus_routing",
            enabled: next,
        }).catch(() => undefined)
    }

    const handleLocationToggle = () => {
        if (locationEnabled) {
            setLocationEnabled(false)
            showToast("To fully revoke, use browser site settings", "error")
            return
        }
        // Always call with timeout - avoids UI freeze if browser hangs on permission prompt
        navigator.geolocation.getCurrentPosition(
            () => setLocationEnabled(true),
            () => showToast("Location access denied - check browser site settings", "error"),
            { timeout: 8000, maximumAge: 60000 }
        )
    }

    const handleConsentToggle = () => {
        const next = !dataConsent
        setDataConsent(next)
        localStorage.setItem("parkandgo-data-consent", next ? "true" : "false")
        void logContextEvent("user_action", {
            setting: "data_consent",
            enabled: next,
        }).catch(() => undefined)
        showToast(next ? "Data consent enabled" : "Data consent disabled", "success")
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

            {ttsEnabled && (
                <div className="py-2.5 border-b border-black/5">
                    <label htmlFor="tts-voice" className="block text-[11px] font-semibold text-text2 mb-1.5">
                        Navigation Voice
                    </label>
                    <select
                        id="tts-voice"
                        value={selectedTTSVoice ?? ""}
                        onChange={(event) => setSelectedTTSVoice(event.target.value || null)}
                        disabled={availableVoices.length === 0}
                        className="w-full bg-white border border-black/12 rounded-[10px] px-3 py-2 text-[12px] text-text1 outline-none focus:border-maroon disabled:opacity-60"
                    >
                        <option value="">System default</option>
                        {availableVoices.map((voice) => (
                            <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                                {voice.name} ({voice.lang})
                            </option>
                        ))}
                    </select>
                    {availableVoices.length === 0 && (
                        <p className="text-[10px] text-text3 mt-1">Voice list is still loading for this browser.</p>
                    )}
                </div>
            )}

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

            {/* Data Consent */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[rgba(255,149,0,0.12)] flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-shield-check text-[var(--color-gold-dark)] text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Data Consent</div>
                    <div className="text-[11px] text-text2 mt-0.5">Allow analytics and history logging</div>
                </div>
                <button
                    type="button"
                    onClick={handleConsentToggle}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        dataConsent ? "bg-maroon" : "bg-[var(--color-toggle-off)]"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                        dataConsent ? "translate-x-5" : "translate-x-0"
                    )} />
                </button>
            </div>

            {/* TTS Navigation */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-[rgba(0,122,255,0.12)] flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-volume-up-fill text-blue text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Voice Navigation</div>
                    <div className="text-[11px] text-text2 mt-0.5">Speak turn-by-turn instructions</div>
                </div>
                <button
                    type="button"
                    onClick={handleTTSToggle}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        ttsEnabled ? "bg-maroon" : "bg-[var(--color-toggle-off)]"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                        ttsEnabled ? "translate-x-5" : "translate-x-0"
                    )} />
                </button>
            </div>

            {/* Campus-specific Routing */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-maroon-light flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-signpost-2-fill text-maroon text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Campus Routing</div>
                    <div className="text-[11px] text-text2 mt-0.5">Prioritize campus-safe routing logic</div>
                </div>
                <button
                    type="button"
                    onClick={handleCampusRoutingToggle}
                    className={clsx(
                        "w-11 h-6 rounded-full transition-colors flex items-center px-0.5",
                        campusRoutingEnabled ? "bg-maroon" : "bg-[var(--color-toggle-off)]"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                        campusRoutingEnabled ? "translate-x-5" : "translate-x-0"
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
