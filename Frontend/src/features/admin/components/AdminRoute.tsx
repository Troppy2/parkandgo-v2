import { useEffect, useState, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { getMe } from "@/features/auth/services/authApi"

export default function AdminRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [isRecheckingAdmin, setIsRecheckingAdmin] = useState(false)
  const [hasRechecked, setHasRechecked] = useState(false)

  // If persisted user says non-admin, re-check /auth/me once before redirecting.
  // This avoids false redirects from stale localStorage user objects in production.
  useEffect(() => {
    if (!isAuthenticated || !user || user.is_admin || hasRechecked) return

    const storedToken = token ?? localStorage.getItem("access_token")
    if (!storedToken) {
      setHasRechecked(true)
      return
    }

    let mounted = true
    setIsRecheckingAdmin(true)
    const refreshToken = localStorage.getItem("refresh_token") ?? ""

    getMe()
      .then((fetchedUser) => {
        if (!mounted) return
        setAuth(fetchedUser, storedToken, refreshToken)
      })
      .catch(() => {
        if (!mounted) return
        clearAuth()
      })
      .finally(() => {
        if (!mounted) return
        setIsRecheckingAdmin(false)
        setHasRechecked(true)
      })

    return () => {
      mounted = false
    }
  }, [isAuthenticated, user, token, setAuth, clearAuth, hasRechecked])

  // On hard refresh, token can be present before /auth/me restores user.
  // Keep the admin route stable instead of redirecting too early.
  if ((isAuthenticated && !user) || isRecheckingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] text-text1 text-sm">
        Loading admin access...
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_admin) return <Navigate to="/" replace />

  return <>{children}</>
}
