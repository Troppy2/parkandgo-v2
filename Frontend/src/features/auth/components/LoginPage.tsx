import { useState } from "react"
import { loginWithGoogle } from "../services/authApi"
import { useAuthStore } from "../../../store/authStore"

// Tell TypeScript that window.google exists (GIS SDK injected via script tag)
interface GoogleTokenClient {
  requestAccessToken: () => void
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: { access_token: string }) => void
  }) => GoogleTokenClient
}

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: GoogleAccountsOAuth2
      }
    }
  }
}

export default function LoginPage() {
  const setAuth = useAuthStore((state) => state.setAuth)
  const setGuest = useAuthStore((state) => state.setGuest)
  const [loginError, setLoginError] = useState<string | null>(null)

  const handleGuestContinue = () => {
    setGuest()
    window.location.href = '/'
  }

  const handleGoogleLogin = () => {
    if (!window.google?.accounts?.oauth2) {
      setLoginError("Google sign-in isn't ready yet - please wait a moment and try again.")
      return
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: "email profile",
      callback: async (response: { access_token: string }) => {
        try {
          const result = await loginWithGoogle(response.access_token)
          setAuth(result.user, result.access_token, result.refresh_token)
          window.location.href = '/'
        } catch (error: unknown) {
          console.error("Login failed", error)
          if (error && typeof error === "object" && "code" in error) {
            const code = (error as { code: string }).code
            // ERR_NETWORK = CORS block or server unreachable
            // ECONNABORTED = axios request timeout
            if (code === "ERR_NETWORK" || code === "ECONNABORTED") {
              setLoginError("Couldn't reach the server. It may be starting up - please wait 30 seconds and try again.")
              return
            }
          }
          if (error && typeof error === "object" && "response" in error) {
            const res = (error as { response: { status: number; data?: { detail?: string } } }).response
            setLoginError(`Server error ${res.status}: ${res.data?.detail ?? "Unknown error"}`)
          } else {
            setLoginError("Sign-in failed. Please try again.")
          }
        }
      },
    })
    client.requestAccessToken()
  }

  return (
    <div className="flex flex-col min-h-screen font-inter">

      {/* Main two-panel layout */}
      <div className="flex flex-col lg:flex-row flex-1">

        {/* Left - marketing panel */}
        <section className="lg:w-3/5 bg-[#7A0019] px-10 py-16 flex flex-col justify-center">
          <h1 className="text-6xl font-bold text-white leading-tight mb-4">
            <span className="block">Stop guessing.</span>
            <span className="block">Start parking.</span>
          </h1>
          <p className="text-xl text-white/75 mb-10 max-w-lg leading-relaxed">
            Park &amp; Go finds the best spot near your classes - ranked by cost, walk time, and what's happening on campus today.
          </p>

          {/* Feature cards */}
          <div className="flex flex-col gap-4 max-w-lg mb-12">
            <div className="flex flex-col gap-1 bg-white/10 border border-white/20 rounded-2xl px-5 py-4 cursor-pointer transition-all duration-200 hover:bg-white/15 hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <i className="bi bi-bar-chart-fill text-yellow-400 text-lg"></i>
                <h3 className="text-base font-bold text-white">Smart Rankings</h3>
              </div>
              <p className="text-sm text-white/75 leading-snug">Every spot is scored on cost, travel time, your major, and live event proximity - not just distance.</p>
            </div>
            <div className="flex flex-col gap-1 bg-white/10 border border-white/20 rounded-2xl px-5 py-4 cursor-pointer transition-all duration-200 hover:bg-white/15 hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <i className="bi bi-calendar-event-fill text-yellow-400 text-lg"></i>
                <h3 className="text-base font-bold text-white">Event-Aware</h3>
              </div>
              <p className="text-sm text-white/75 leading-snug">UMN's event calendar syncs daily. Spots near a packed arena or stadium are automatically deprioritized.</p>
            </div>
            <div className="flex flex-col gap-1 bg-white/10 border border-white/20 rounded-2xl px-5 py-4 cursor-pointer transition-all duration-200 hover:bg-white/15 hover:-translate-y-1">
              <div className="flex items-center gap-2">
                <i className="bi bi-person-check-fill text-yellow-400 text-lg"></i>
                <h3 className="text-base font-bold text-white">Personalized</h3>
              </div>
              <p className="text-sm text-white/75 leading-snug">Sign in once and your parking type preference and campus side are baked into every recommendation.</p>
            </div>
          </div>

          {/* How it works */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">How it works</h2>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <div className="inline-flex w-7 h-7 rounded-full bg-white/20 items-center justify-center text-sm font-bold text-white mb-2">1</div>
                <p className="text-sm text-white/75 leading-snug"><strong className="text-white">Open the app</strong> - the map loads with ranked spots based on your location.</p>
              </div>
              <div className="flex-1">
                <div className="inline-flex w-7 h-7 rounded-full bg-white/20 items-center justify-center text-sm font-bold text-white mb-2">2</div>
                <p className="text-sm text-white/75 leading-snug"><strong className="text-white">Pick a spot</strong> - see the score breakdown: cost, travel time, your preferences.</p>
              </div>
              <div className="flex-1">
                <div className="inline-flex w-7 h-7 rounded-full bg-white/20 items-center justify-center text-sm font-bold text-white mb-2">3</div>
                <p className="text-sm text-white/75 leading-snug"><strong className="text-white">Navigate</strong> - turn-by-turn directions take you straight there.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right - sign-in panel */}
        <section className="lg:w-2/5 bg-gray-50 flex items-center justify-center px-8 py-16">
          <div className="bg-white rounded-2xl shadow-lg px-8 py-10 w-full max-w-sm flex flex-col">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome to Park &amp; Go</h2>
            <p className="text-sm text-gray-500 mb-8">University of Minnesota parking, ranked for you.</p>

            <button
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-3 w-full bg-white border border-gray-300 text-gray-800 font-semibold py-2.5 px-4 rounded-lg min-h-[44px] text-sm hover:bg-gray-50 transition-colors duration-200 shadow-sm mb-4"
            >
              <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>

            {loginError && <p className="text-red-500 text-sm mb-3">{loginError}</p>}

            <p className="text-xs text-gray-400 leading-snug pb-4 border-b border-gray-100 mb-4">
              Guest mode shows recommendations without saving your preferences.
            </p>

            <button
              onClick={handleGuestContinue}
              className="w-full text-gray-400 text-sm font-medium min-h-[44px] hover:text-gray-600 transition-colors duration-200"
            >
              Continue as Guest &rarr;
            </button>
          </div>
        </section>

      </div>
      {/* Footer */}
      <footer className="w-full bg-white border-t border-gray-200 px-10 py-5 flex flex-col lg:flex-row justify-between items-center gap-2 text-sm text-gray-500">
        <span>Built for UMN students &middot; v2.0</span>
        <span>Privacy Policy</span>
        <span>Open source &middot; <a href="https://github.com/Troppy2/parkandgo-v2" className="hover:text-gray-900 transition-colors duration-200">GitHub</a></span>
      </footer>
    </div>
  )
}