/* Axios client with JWT token management */

import axios from "axios"

const apiUrl = import.meta.env.VITE_API_URL
const resolvedApiUrl = apiUrl || (import.meta.env.DEV ? "http://localhost:8000/api" : "")

if (!resolvedApiUrl) {
  throw new Error("VITE_API_URL is not set. Configure it before building for production.")
}

const client = axios.create({
  baseURL: resolvedApiUrl,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
})

/* Request interceptor — attach JWT token if it exists */
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/* Response interceptor — refresh token on 401 */
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
            `${resolvedApiUrl}/auth/refresh`,
            { refresh_token: refreshToken }
          )
          localStorage.setItem("access_token", res.data.access_token)
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`
          return client(originalRequest)
        } catch {
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
        }
      }
    }

    return Promise.reject(error)
  }
)

export default client
