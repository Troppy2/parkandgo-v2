import { useEffect, type ReactNode } from "react"

interface LegalModalProps {
  title: string
  lastUpdated: string
  onClose: () => void
  children: ReactNode
}

/**
 * Shared shell for the Privacy Policy and Terms of Service modals.
 *
 * Both documents are long enough that the reading affordances matter more than
 * the chrome, so the scroll container is the shared part: sticky header so the
 * close button never scrolls away, and a visible scrollbar, unlike the rest of
 * the app's modals. The previous version hid it, which is fine for a five line
 * notice and actively misleading for a document this long.
 */
export default function LegalModal({ title, lastUpdated, onClose, children }: LegalModalProps) {
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
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-[var(--color-modal-surface,#ffffff)] rounded-[18px] w-full max-w-[440px] max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--color-modal-surface,#ffffff)] px-5 pt-5 pb-3 border-b border-black/8">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-bold text-text1">{title}</span>
            <button
              onClick={onClose}
              className="w-7 h-7 bg-black/7 rounded-full flex items-center justify-center text-text2 shrink-0"
              aria-label={`Close ${title.toLowerCase()}`}
            >
              <i className="bi bi-x-lg text-[11px]" />
            </button>
          </div>
          <div className="text-[10px] text-text2 mt-1">Last updated {lastUpdated}</div>
        </div>

        <div className="px-5 py-4 space-y-4 text-[12px] text-text2 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

/** A titled block within a legal document. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[12px] font-bold text-text1">{heading}</h3>
      {children}
    </section>
  )
}
