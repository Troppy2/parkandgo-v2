import { useEffect, useState } from "react"
import { deleteAccount } from "../services/profileApi"

interface DeleteAccountModalProps {
  onClose: () => void
  onDeleted: () => void
}

const CONFIRM_WORD = "DELETE"

/**
 * Confirmation step for permanent account deletion.
 *
 * Typing the word is deliberate friction. This is the one destructive action in
 * the app that cannot be undone by any support request, since the rows are gone
 * rather than flagged, so a misplaced tap must not be able to reach it.
 *
 * What is and is not removed is spelled out here rather than left to the privacy
 * policy, because the two exceptions (submitted spots survive without an author,
 * analytics rows survive without a user id) are surprising if you meet them
 * afterwards instead of before.
 */
export default function DeleteAccountModal({ onClose, onDeleted }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose, isDeleting])

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !isDeleting

  const handleDelete = async () => {
    if (!canDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      await deleteAccount()
      onDeleted()
    } catch {
      setError("Could not delete your account. Please try again, or email us for help.")
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[130] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={() => { if (!isDeleting) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete account"
        className="bg-[var(--color-modal-surface,#ffffff)] rounded-[18px] w-full max-w-[380px] max-h-[80vh] overflow-y-auto p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill text-[15px] text-maroon" />
          <span className="text-[16px] font-bold text-text1">Delete account</span>
        </div>

        <div className="space-y-3 text-[12px] text-text2 leading-relaxed">
          <p className="text-text1 font-semibold">
            This is permanent and cannot be undone.
          </p>

          <div>
            <div className="font-semibold text-text1 mb-1">Deleted immediately</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Your account, name, email, and profile photo</li>
              <li>Saved spots and saved buildings</li>
              <li>Private spots, including their locations and notes</li>
              <li>Your parking history</li>
              <li>Your ratings and reviews</li>
              <li>Your preferences and consent history</li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-text1 mb-1">Kept, but no longer linked to you</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Parking spots you submitted, since other people rely on them. Your name is removed from them.</li>
              <li>Analytics events, if you turned those on. Only ids and counts remain, with nothing identifying you.</li>
            </ul>
          </div>

          <p>
            Type <span className="font-bold text-text1">{CONFIRM_WORD}</span> to confirm.
          </p>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isDeleting}
            autoFocus
            aria-label={`Type ${CONFIRM_WORD} to confirm account deletion`}
            className="w-full border border-black/15 rounded-[10px] px-3 py-2 text-[13px] text-text1 outline-none focus:border-maroon disabled:opacity-50"
            placeholder={CONFIRM_WORD}
          />

          {error && (
            <p role="alert" className="text-maroon font-medium">{error}</p>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 border border-black/15 text-text1 rounded-[10px] py-2.5 min-h-[44px] text-[13px] font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="flex-1 bg-maroon text-white rounded-[10px] py-2.5 min-h-[44px] text-[13px] font-semibold transition-all duration-150 hover:bg-maroon-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Delete forever"}
          </button>
        </div>
      </div>
    </div>
  )
}
