import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { User } from "../types/user.types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isReady: boolean;
  setReady: (ready: boolean) => void;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  setGuest: () => void;
  clearAuth: () => void;
}

type PersistedAuthSlice = Pick<AuthState, "user" | "token" | "isAuthenticated" | "isGuest">

const AUTH_STORAGE_VERSION = 2

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,
      isReady: false,

      setReady: (ready) => set({ isReady: ready }),

      setAuth: (user, token, refreshToken) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", refreshToken);
        set({
          user,
          token,
          isAuthenticated: true,
          isGuest: false,
          isReady: true,
        });
      },

      setGuest: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isGuest: true,
          isReady: true,
        });
      },

      clearAuth: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isGuest: false,
          isReady: true,
        });
      },
    }),
    {
      name: "auth-storage",
      version: AUTH_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
      }),
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<PersistedAuthSlice>

        const token = typeof state.token === "string" && state.token ? state.token : null
        const isGuest = Boolean(state.isGuest)
        const isAuthenticated = Boolean(state.isAuthenticated && token)

        if (!isAuthenticated) {
          return {
            user: null,
            token: null,
            isAuthenticated: false,
            isGuest,
          } satisfies PersistedAuthSlice
        }

        return {
          user: state.user ?? null,
          token,
          isAuthenticated: true,
          isGuest: false,
        } satisfies PersistedAuthSlice
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Failed to hydrate auth state:", error)
        }
        if (state) {
          const localToken = localStorage.getItem("access_token")
          const effectiveToken = state.token ?? localToken

          if (state.isGuest) {
            localStorage.removeItem("access_token")
            localStorage.removeItem("refresh_token")
          } else if (state.isAuthenticated) {
            if (!effectiveToken) {
              state.clearAuth()
              return
            }
            if (!localToken) {
              localStorage.setItem("access_token", effectiveToken)
            }
            if (state.token !== effectiveToken) {
              useAuthStore.setState({ token: effectiveToken })
            }
          }

          state.setReady(true)
        } else {
          // Storage was corrupt or missing - still unblock the app.
          useAuthStore.setState({ isReady: true })
        }
      },
    }
  )
);
