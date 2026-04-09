import { useEffect, useState, type ReactNode } from "react"
import Providers from "./app/providers"
import AppRoutes from "./app/routes"
import { useAuthStore } from "./store/authStore"
import { useUIStore } from "./store/uiStore"
import { getMe } from "./features/auth/services/authApi"
import { checkHealthWithBackoff } from "./features/health/services/healthApi"

// Reads isOffline from global UI store — renders above both the splash and the main app.
function OfflineBanner() {
  const isOffline = useUIStore((state) => state.isOffline)
  if (!isOffline) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ backgroundColor: "var(--color-gold)", color: "var(--color-maroon)" }}
      className="text-sm font-medium px-4 py-2 text-center"
    >
      You're offline — some features may be unavailable
    </div>
  )
}

function AuthGate({ children }: { children: ReactNode }) {
  const isReady = useAuthStore((state) => state.isReady)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isGuest = useAuthStore((state) => state.isGuest)
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [isBootstrappingAuth, setIsBootstrappingAuth] = useState(true)

  // After hydration: reconcile auth from token if persisted state is incomplete or stale.
  // This prevents route guards (especially /admin) from depending on a manual reload.
  useEffect(() => {
    if (!isReady) return

    const storedToken = token ?? localStorage.getItem("access_token")
    if (!storedToken || isGuest) {
      setIsBootstrappingAuth(false)
      return
    }

    const needsUserRefresh =
      !isAuthenticated || !user || typeof user.is_admin !== "boolean"

    if (!needsUserRefresh) {
      setIsBootstrappingAuth(false)
      return
    }

    let mounted = true
    setIsBootstrappingAuth(true)
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
        setIsBootstrappingAuth(false)
      })

    return () => {
      mounted = false
    }
  }, [isReady, isAuthenticated, isGuest, user, token, setAuth, clearAuth])

  if (!isReady || isBootstrappingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-[#7A0019]">
        <div className="text-sm font-medium">Loading Park &amp; Go...</div>
      </div>
    )
  }

  return <>{children}</>
}

type StartupStatus = "checking" | "ready" | "failed"

// This component handles the initial health check with backoff and renders the appropriate UI states.
function App() {
  const [startupStatus, setStartupStatus] = useState<StartupStatus>("checking")
  const [retryNonce, setRetryNonce] = useState(0)
  const [attempt, setAttempt] = useState(1)
  const [maxAttempts] = useState(5)
  const [nextDelayMs, setNextDelayMs] = useState(0)
  const setOffline = useUIStore((state) => state.setOffline)
  const dataConsent = useUIStore((state) => state.dataConsent)

  useEffect(() => {
    localStorage.setItem("parkandgo-data-consent", dataConsent ? "true" : "false")
  }, [dataConsent])

  // Sync network status into global UI store so any component can read it.
  useEffect(() => {
    setOffline(!navigator.onLine)
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [setOffline])

  useEffect(() => {
    const controller = new AbortController()
    let mounted = true

    setStartupStatus("checking")
    setAttempt(1)
    setNextDelayMs(0)

    void checkHealthWithBackoff({
      maxAttempts,
      signal: controller.signal,
      onAttempt: (currentAttempt, delayMs) => {
        if (!mounted) return
        setAttempt(currentAttempt + 1)
        setNextDelayMs(delayMs)
      },
    })
      .then(() => {
        if (!mounted) return
        setStartupStatus("ready")
      })
      .catch(() => {
        if (!mounted) return
        setStartupStatus("failed")
      })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [maxAttempts, retryNonce])

  if (startupStatus !== "ready") {
    return (
      <>
        <OfflineBanner />
        <div className="min-h-screen flex items-center justify-center bg-white text-[#7A0019] p-6">
          <div className="max-w-sm text-center space-y-3">
            <h1 className="text-lg font-semibold">Connecting to server...</h1>

            {startupStatus === "checking" && (
              <p className="text-sm">
                Attempt {attempt}/{maxAttempts}
                {nextDelayMs > 0 ? ` · retrying in ${(nextDelayMs / 1000).toFixed(1)}s` : ""}
              </p>
            )}

            {startupStatus === "failed" && (
              <>
                <p className="text-sm">Could not reach backend after {maxAttempts} attempts.</p>
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-[#7A0019] text-white"
                  onClick={() => setRetryNonce((v) => v + 1)}
                >
                  Retry now
                </button>
              </>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <OfflineBanner />
      <Providers>
        <AuthGate>
          <AppRoutes />
        </AuthGate>
      </Providers>
    </>
  )
}

export default App
