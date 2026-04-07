import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuthStore } from "../../../store/authStore"

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isReady = useAuthStore((s) => s.isReady)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isGuest = useAuthStore((s) => s.isGuest)

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-[#7A0019]">
        <div className="text-sm font-medium">Loading account...</div>
      </div>
    )
  }

  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}