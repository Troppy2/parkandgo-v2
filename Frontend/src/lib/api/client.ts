/* Axios client with JWT token management */

import axios from "axios"
import { useAuthStore } from "@/store/authStore"

const apiUrl = import.meta.env.VITE_API_URL
const resolvedApiUrl = apiUrl?.trim()

// Guard production builds against a missing API URL. In dev and test (vitest)
// we fall back to localhost so the app and the test suite can boot without a
// .env file present.
if (import.meta.env.PROD && !resolvedApiUrl) {
  throw new Error("VITE_API_URL is not set. Configure it before building for production.")
}

const baseURL = resolvedApiUrl || "http://localhost:8000/api"

// This client instance is used for all API calls. Interceptors handle token attachment and refresh.
const client = axios.create({
  baseURL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
})

/* Request interceptor - attach JWT token if it exists */
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const dataConsent = localStorage.getItem("parkandgo-data-consent")
  if (dataConsent !== null) {
    config.headers["X-Data-Consent"] = dataConsent
  }
  return config
})

/* Response interceptor - refresh token on 401 */
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem("refresh_token")

      if (refreshToken) {
        try {
          const res = await axios.post(
            `${baseURL}/auth/refresh`,
            { refresh_token: refreshToken }
          )
          localStorage.setItem("access_token", res.data.access_token)
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`
          return client(originalRequest)
        } catch {
          useAuthStore.getState().clearAuth()
        }
      }
    }

    return Promise.reject(error)
  }
)

export default client
