import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuthStore } from "../../../store/authStore"

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isGuest = useAuthStore((s) => s.isGuest)

  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}