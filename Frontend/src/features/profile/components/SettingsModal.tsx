import { useEffect, useState } from "react"
import { useUIStore, type MapStyle } from "../../../store/uiStore"
import type { AppMode } from "../../../services/preferences.service"
import { useAuthStore } from "../../../store/authStore"
import { useMediaQuery } from "../../../hooks/useMediaQuery"
import UserProfile from "./UserProfile"
import SavedSpotsList from "./SavedSpotsList"
import PrivateSpotsList from "./PrivateSpotsList"
import Preferences from "./Preferences"
import PrivacyPolicyModal from "../../../components/PrivacyPolicyModal"
import TermsOfServiceModal from "../../../components/TermsOfServiceModal"
import DeleteAccountModal from "./DeleteAccountModal"

export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen, mapStyle, setMapStyle, appMode, setAppMode } = useUIStore()
  const { clearAuth, isGuest } = useAuthStore()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isMinimizedForSpecialSpot, setIsMinimizedForSpecialSpot] = useState(false)

  // Body scroll lock + Escape key
  useEffect(() => {
    if (!settingsOpen) return
    document.body.style.overflow = "hidden"
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !privacyOpen && !termsOpen && !deleteOpen) setSettingsOpen(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [settingsOpen, privacyOpen, termsOpen, deleteOpen, setSettingsOpen])

  // Don't render at all when closed - saves memory
  if (!settingsOpen) return null

  const handleSignOut = () => {
    clearAuth()
    setSettingsOpen(false)
  }

  // All the inner content in one place - reused by both layouts below
  const content = (
    <div>
      {/* Handle bar - mobile only */}
      {!isDesktop && (
        <div className="w-9 h-1 bg-[var(--color-sheet-handle)] rounded-full mx-auto mt-3" />
      )}

      {/* Title bar - matches .set-tbar / .am-sm-hd */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/8">
        <span className="font-display text-[17px] font-bold tracking-tight flex items-center gap-1.5">
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

        {/* Account + editable profile - Phase 17 component */}
        <UserProfile />

        {/* Saved spots list - Phase 17 component */}
        <SavedSpotsList />

        {/* Personal/private parking spots for quick navigation */}
        <PrivateSpotsList onFormOpenChange={setIsMinimizedForSpecialSpot} />

        {/* Preferences toggles - Phase 17 component */}
        <Preferences />

        {/* App mode: parking spots vs campus buildings */}
        <div className="px-5 pt-3 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text2 mb-3">
            Mode
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              {
                value: "parking",
                label: "Parking Mode",
                icon: "bi-p-square-fill",
                hint: "Find a spot",
              },
              {
                value: "campus",
                label: "Campus Mode",
                icon: "bi-building",
                hint: "Walk to a building",
              },
            ].map(({ value, label, icon, hint }) => (
              <button
                key={value}
                onClick={() => setAppMode(value as AppMode)}
                aria-pressed={appMode === value}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-[12px] border-[1.5px] transition-colors ${
                  appMode === value
                    ? "border-maroon bg-maroon-light"
                    : "border-black/9 bg-white"
                }`}
              >
                <i className={`bi ${icon} text-xl ${
                  appMode === value ? "text-maroon" : "text-text2"
                }`} />
                <span className={`text-[11px] font-semibold ${
                  appMode === value ? "text-maroon" : "text-text2"
                }`}>
                  {label}
                </span>
                <span className="text-[10px] text-text3">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Map Style picker - the main new thing in Phase 19 */}
        <div className="px-5 pt-3 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text2 mb-3">
            Map Style
          </div>

          {/* Three style options in a row - icon + label + active ring */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "standard",  label: "Standard",  icon: "bi-map" },
              { value: "satellite", label: "Satellite", icon: "bi-globe" },
              { value: "3d",        label: "3D View",   icon: "bi-buildings" },
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

        {/* App info row - version + build */}
        <div className="px-5 pt-2 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text2 mb-2">
            About
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="w-[30px] h-[30px] rounded-[8px] bg-maroon flex items-center justify-center flex-shrink-0">
              <i className="bi bi-p-square-fill text-white text-sm" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-text1">Park & Go</div>
              <div className="text-[11px] text-text2">Version 2.0 · UMN Campus</div>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => setPrivacyOpen(true)}
                  className="text-[11px] text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors"
                >
                  Privacy Policy
                </button>
                <span className="text-[11px] text-text2">&middot;</span>
                <button
                  onClick={() => setTermsOpen(true)}
                  className="text-[11px] text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors"
                >
                  Terms of Service
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sign out - solid red with white text */}
        <button
          onClick={handleSignOut}
          style={{ width: "calc(100% - 40px)" }}
          className="flex items-center justify-center gap-2 bg-maroon text-white rounded-[10px] py-2.5 mx-5 mb-4 mt-2 min-h-[44px] font-semibold transition-all duration-150 hover:bg-maroon-hover active:bg-[var(--color-maroon-dark)] active:scale-[0.97]"
        >
          <i className="bi bi-box-arrow-right" />
          Sign Out
        </button>

        {!isGuest && (
          <button
            onClick={() => setDeleteOpen(true)}
            className="block mx-auto mb-4 text-[11px] text-text2 underline hover:text-maroon transition-colors"
          >
            Delete my account
          </button>
        )}


      </div>
    </div>
  )

  return (
    <>
      {privacyOpen && <PrivacyPolicyModal onClose={() => setPrivacyOpen(false)} />}
      {termsOpen && <TermsOfServiceModal onClose={() => setTermsOpen(false)} />}
      {deleteOpen && (
        <DeleteAccountModal
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            // The account is gone, so the stored tokens now name nobody.
            setDeleteOpen(false)
            clearAuth()
            setSettingsOpen(false)
          }}
        />
      )}

      {isDesktop ? (
        // ── Desktop layout - centered modal overlay ──
        <div
          className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className={`backdrop-blur-xl border border-black/12 rounded-[18px] w-[380px] shadow-lg overflow-hidden max-h-[520px] overflow-y-auto transition-all duration-200 ${
              isMinimizedForSpecialSpot ? "scale-[0.97] opacity-85 translate-y-4 pointer-events-none" : "scale-100 opacity-100 translate-y-0"
            }`}
            style={{ background: "var(--color-modal-surface)", scrollbarWidth: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      ) : (
        // ── Mobile layout - bottom sheet ──
        <div
          className="fixed inset-0 bg-black/45 z-[100] flex items-end backdrop-blur-[1px]"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className={`w-full max-h-[90vh] overflow-y-auto rounded-t-[24px] shadow-2xl pb-7 transition-all duration-200 ${
              isMinimizedForSpecialSpot ? "scale-[0.98] opacity-85 translate-y-8 pointer-events-none" : "scale-100 opacity-100 translate-y-0"
            }`}
            style={{ background: "var(--color-modal-surface)", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      )}
    </>
  )
}
