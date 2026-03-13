// Standard shape of an API error from FastAPI
export interface ApiError {
  detail: string
  status_code?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

// Four states: idle → loading → success | error
export type LoadingState = "idle" | "loading" | "success" | "error"
