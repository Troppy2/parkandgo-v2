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
  REVIEWS: {
    BASE: "/reviews/",
    BY_SPOT: (spotId: number) => `/reviews/${spotId}`,
    SUMMARY: (spotId: number) => `/reviews/${spotId}/summary`,
  },
  HISTORY: {
    BASE: "/history/",
    ME: "/history/me",
    DETAIL: (id: number) => `/history/${id}`,
  },
  USERS: {
    ME:    "/users/me",
    SAVED: (spotId?: number) => spotId !== undefined ? `/users/me/saved/${spotId}` : "/users/me/saved",
    SAVED_BUILDINGS: (buildingId?: number) =>
      buildingId !== undefined ? `/users/me/saved-buildings/${buildingId}` : "/users/me/saved-buildings",
    PREFERENCES: "/users/me/preferences",
    CONSENT: "/users/me/preferences/consent",
  },
  CAMPUS_BUILDINGS: {
    LIST:   "/campus-buildings/",
    SEARCH: "/campus-buildings/search",
    NEARBY: "/campus-buildings/nearby",
    DETAIL: (id: number) => `/campus-buildings/${id}`,
  },
  PRIVATE_SPOTS: {
    BASE: "/private-spots/",
    BY_ID: (spotId: number) => `/private-spots/${spotId}`,
  },
  EVENTS: {
    LIST:   "/events/",
    DETAIL: (id: number) => `/events/${id}`,
  },
  LOGGING: {
    CONTEXT: "/logging/context",
  },
  ADMIN: {
    STATS: "/admin/stats",
    ALL_SPOTS: "/admin/spots/",
    UNVERIFIED: "/admin/spots/unverified",
    VERIFY_SPOT: (id: number) => `/admin/spots/${id}/verify`,
    UPDATE_SPOT: (id: number) => `/admin/spots/${id}`,
    DELETE_SPOT: (id: number) => `/admin/spots/${id}`,
    SYNC_EVENTS: "/admin/events/sync",
    CONFIG: "/admin/config",
    CONFIG_KEY: (key: string) => `/admin/config/${key}`,
  }
} as const
