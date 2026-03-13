/* Axios client with JWT token management */

import axios from "axios"

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
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
            `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/auth/refresh`,
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
