import { useState } from "react"
import { useNavigate } from "react-router-dom"
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
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const setGuest = useAuthStore((state) => state.setGuest)
  const [loginError, setLoginError] = useState<string | null>(null)

  const handleGuestContinue = () => {
    setGuest()
    navigate("/")
  }

  const handleGoogleLogin = () => {
    if (!window.google?.accounts?.oauth2) {
      setLoginError("Google sign-in isn't ready yet — please wait a moment and try again.")
      return
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: "email profile",
      callback: async (response: { access_token: string }) => {
        try {
          const result = await loginWithGoogle(response.access_token)
          setAuth(result.user, result.access_token, result.refresh_token)
          navigate("/")
        } catch (error: unknown) {
          console.error("Login failed", error)
          if (error && typeof error === "object" && "code" in error) {
            const code = (error as { code: string }).code
            // ERR_NETWORK = CORS block or server unreachable
            // ECONNABORTED = axios request timeout
            if (code === "ERR_NETWORK" || code === "ECONNABORTED") {
              setLoginError("Couldn't reach the server. It may be starting up — please wait 30 seconds and try again.")
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
    <div className="min-h-screen bg-green-gradient flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/95 rounded-[16px] shadow-lg p-10 flex flex-col items-center gap-6 backdrop-blur-sm">

        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[#7A0019] rounded-[16px] flex items-center justify-center shadow-md">
            <span className="text-[#FFCC33] font-bold text-3xl leading-none">P</span>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-[#7A0019]">Park</span>
              <span className="text-[#6b7280]"> &amp; </span>
              <span className="text-[#c9a200]">Go</span>
            </h1>
            <p className="text-[#6b7280] text-sm mt-1">UMN Campus Parking</p>
          </div>
          
        </div>

        {/* Error message */}
        {loginError && (
          <p className="w-full text-sm text-red bg-red/10 rounded-sm px-4 py-2 text-center">
            {loginError}
          </p>
        )}

        {/* Google sign-in button */}
        <button
          onClick={handleGoogleLogin}
          className="google-sign-in-btn w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-[#3c4043] font-medium text-sm py-3 px-5 rounded-sm border border-[#dadce0] shadow-sm transition-all duration-200 min-h-[44px] hover:-translate-y-[1px]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        {/* Guest skip button */}
        <button
          onClick={handleGuestContinue}
          className="guest-btn"
        >
          Continue as Guest
        </button>

      </div>
    </div>
  )
}
