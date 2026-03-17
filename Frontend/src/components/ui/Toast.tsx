import { useEffect } from "react"
import { useUIStore } from "../../store/uiStore"
import clsx from "clsx"

function ToastItem({
  message,
  type,
  id,
}: {
  message: string
  type: "success" | "error"
  id: string
}) {
  const removeToast = useUIStore((s) => s.removeToast)

  // Auto-dismiss after 4 seconds (minimum visibility requirement)
  useEffect(() => {
    const timer = setTimeout(() => removeToast(id), 4000)
    return () => clearTimeout(timer)
  }, [id, removeToast])

  return (
    <div
      className={clsx(
        "flex items-center gap-3 px-4 py-3 rounded-xl shadow-md",
        "text-[13px] font-medium text-white",
        "animate-slide-up pointer-events-auto",
      )}
      style={{ background: type === "success" ? "#10b981" : "#ff3b30" }}
    >
      <i className={`bi ${type === "success" ? "bi-check-circle-fill" : "bi-exclamation-circle"} flex-shrink-0`} />
      <span className="flex-1">{message}</span>
      <button
        onClick={() => removeToast(id)}
        className="ml-auto opacity-70 hover:opacity-100 flex-shrink-0"
      >
        <i className="bi bi-x" />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    // z-[200] ensures toasts appear above settings (z-[100]) and suggest modal (z-[110])
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 flex flex-col items-center gap-3 w-full max-w-sm px-4 pointer-events-none z-[200]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
    </div>
  )
}
