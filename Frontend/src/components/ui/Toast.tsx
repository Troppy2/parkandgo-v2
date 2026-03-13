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

  return (
    <div
      className={clsx(
        "flex items-center gap-3 px-4 py-3 rounded-xl shadow-md",
        "text-sm font-medium text-white",
        "animate-slide-up pointer-events-auto",
        type === "success" ? "bg-green" : "bg-red",
      )}
    >
      <i className={`bi ${type === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} />
      <span>{message}</span>
      <button
        onClick={() => removeToast(id)}
        className="ml-auto opacity-70 hover:opacity-100"
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
    <div className="fixed left-1/2 -translate-x-1/2 bottom-4 flex flex-col items-center gap-3 w-full max-w-sm px-4 pointer-events-none z-50">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} />
      ))}
    </div>
  )
}
