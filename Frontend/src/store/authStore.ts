import { create } from "zustand"
import type { User } from "../types/user.types"

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isGuest: boolean

  setAuth: (user: User, token: string, refreshToken: string) => void
  setGuest: () => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initialize token from localStorage so refresh doesn't log user out
  user: null,
  token: localStorage.getItem("access_token"),
  isAuthenticated: !!localStorage.getItem("access_token"),
  isGuest: false,

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem("access_token", token)
    localStorage.setItem("refresh_token", refreshToken)
    set({ user, token, isAuthenticated: true, isGuest: false })
  },

  setGuest: () => {
    set({ user: null, token: null, isAuthenticated: false, isGuest: true })
  },

  clearAuth: () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    set({ user: null, token: null, isAuthenticated: false, isGuest: false })
  },
}))
