import { useEffect, useState } from "react"
import { useUIStore, type MapStyle } from "../../../store/uiStore"
import { useAuthStore } from "../../../store/authStore"
import { useMediaQuery } from "../../../hooks/useMediaQuery"
import UserProfile from "./UserProfile"
import SavedSpotsList from "./SavedSpotsList"
import Preferences from "./Preferences"

function PrivacyPolicyModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[18px] w-full max-w-[360px] max-h-[70vh] overflow-y-auto p-5 shadow-xl"
        style={{ scrollbarWidth: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[16px] font-bold text-text1">Privacy Policy</span>
          <button onClick={onClose} className="w-7 h-7 bg-black/7 rounded-full flex items-center justify-center text-text2">
            <i className="bi bi-x-lg text-[11px]" />
          </button>
        </div>
        <p className="text-[12px] text-text2 leading-relaxed mb-3">
          Park &amp; Go collects your location data only while the app is in use to provide parking recommendations near UMN campuses.
        </p>
        <p className="text-[12px] text-text2 leading-relaxed mb-3">
          We use Google OAuth to authenticate your identity. We store your name, email, and parking preferences to personalize recommendations. We do not sell your data to third parties.
        </p>
        <p className="text-[12px] text-text2 leading-relaxed">
          Your saved spots and preferences are stored securely and can be deleted at any time by signing out or contacting us at parkandgo@umn.edu.
        </p>
      </div>
    </div>
  )
}

export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen, mapStyle, setMapStyle } = useUIStore()
  const { clearAuth } = useAuthStore()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [privacyOpen, setPrivacyOpen] = useState(false)

  // Body scroll lock + Escape key
  useEffect(() => {
    if (!settingsOpen) return
    document.body.style.overflow = "hidden"
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !privacyOpen) setSettingsOpen(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [settingsOpen, privacyOpen, setSettingsOpen])

  // Don't render at all when closed — saves memory
  if (!settingsOpen) return null

  const handleSignOut = () => {
    clearAuth()
    setSettingsOpen(false)
  }

  // All the inner content in one place — reused by both layouts below
  const content = (
    <div>
      {/* Handle bar - mobile only */}
      {!isDesktop && (
        <div className="w-9 h-1 bg-[#d1d1d6] rounded-full mx-auto mt-3" />
      )}

      {/* Title bar — matches .set-tbar / .am-sm-hd */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/8">
        <span className="text-[17px] font-bold tracking-tight flex items-center gap-1.5">
          <i className="bi bi-gear text-text2 text-base" />
          Settings
        </span>
        <button
          onClick={() => setSettingsOpen(false)}
          className="w-7 h-7 bg-black/7 rounded-full flex items-center justify-center text-text2 text-[11px]"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      {/* Body */}
      <div>

        {/* Account + editable profile — Phase 17 component */}
        <UserProfile />

        {/* Saved spots list — Phase 17 component */}
        <SavedSpotsList />

        {/* Preferences toggles — Phase 17 component */}
        <Preferences />

        {/* Map Style picker — the main new thing in Phase 19 */}
        <div className="px-5 pt-3 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text3 mb-3">
            Map Style
          </div>

          {/* Three style options in a row — icon + label + active ring */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "standard", label: "Standard", icon: "bi-map" },
              { value: "satellite", label: "Satellite", icon: "bi-globe" },
              { value: "3d",        label: "3D View",  icon: "bi-buildings" },
            ].map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setMapStyle(value as MapStyle)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-[12px] border-[1.5px] transition-colors ${
                  mapStyle === value
                    ? "border-maroon bg-maroon-light"
                    : "border-black/9 bg-white"
                }`}
              >
                <i className={`bi ${icon} text-xl ${
                  mapStyle === value ? "text-maroon" : "text-text2"
                }`} />
                <span className={`text-[11px] font-semibold ${
                  mapStyle === value ? "text-maroon" : "text-text2"
                }`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* App info row — version + build */}
        <div className="px-5 pt-2 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text3 mb-2">
            About
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="w-[30px] h-[30px] rounded-[8px] bg-maroon flex items-center justify-center flex-shrink-0">
              <i className="bi bi-p-square-fill text-white text-sm" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-text1">Park & Go</div>
              <div className="text-[11px] text-text2">Version 2.0 · UMN Campus</div>
              <button
                onClick={() => setPrivacyOpen(true)}
                className="text-[11px] text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors block mt-0.5"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>

        {/* Sign out — solid red with white text */}
        <button
          onClick={handleSignOut}
          style={{ width: "calc(100% - 40px)" }}
          className="flex items-center justify-center gap-2 bg-[#ff3b30] text-white rounded-[10px] py-2.5 mx-5 mb-4 mt-2 min-h-[44px] font-semibold transition-all duration-150 hover:bg-[#d93025] active:scale-[0.97]"
        >
          <i className="bi bi-box-arrow-right" />
          Sign Out
        </button>


      </div>
    </div>
  )

  return (
    <>
      {privacyOpen && <PrivacyPolicyModal onClose={() => setPrivacyOpen(false)} />}

      {isDesktop ? (
        // ── Desktop layout — centered modal overlay ──
        <div
          className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="backdrop-blur-xl border border-black/12 rounded-[18px] w-[380px] shadow-lg overflow-hidden max-h-[520px] overflow-y-auto"
            style={{ background: "rgba(232,232,237,0.97)", scrollbarWidth: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      ) : (
        // ── Mobile layout — bottom sheet ──
        <div
          className="fixed inset-0 bg-black/45 z-[100] flex items-end backdrop-blur-[1px]"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-h-[90vh] overflow-y-auto rounded-t-[24px] shadow-2xl pb-7"
            style={{ background: "#e8e8ed", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      )}
    </>
  )
}