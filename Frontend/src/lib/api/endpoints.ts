export const ENDPOINTS = {
  AUTH: {
    GOOGLE:  "/auth/google",
    ME:      "/auth/me",
    REFRESH: "/auth/refresh",
  },
  PARKING: {
    BASE:   "/parking/",
    SEARCH: "/parking/search",
    FILTER: "/parking/filter",
    DETAIL: (id: number) => `/parking/${id}`,
  },
  RECOMMENDATIONS: {
    BASE: "/recommendations/",
  },
  USERS: {
    ME:     "/users/me",
    SAVED:  (spotId?: number) => spotId !== undefined ? `/users/me/saved/${spotId}` : "/users/me/saved",
    RENAME: (spotId: number) => `/users/me/saved/${spotId}`,
  },
  EVENTS: {
    LIST:   "/events/",
    DETAIL: (id: number) => `/events/${id}`,
  },
  ADMIN: {
    STATS: "/admin/stats",
    UNVERIFIED: "/admin/spots/unverified",
    VERIFY_SPOT: (id: number) => `/admin/spots/${id}/verify`,
    DELETE_SPOT: (id: number) => `/admin/spots/${id}`,
    SYNC_EVENTS: "/admin/events/sync",
    CONFIG: "/admin/config",
    CONFIG_KEY: (key: string) => `/admin/config/${key}`,
  },
} as const
