import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"

export default function AdminRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_admin) return <Navigate to="/" replace />

  return <>{children}</>
}
