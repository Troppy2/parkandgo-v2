import apiClient from "../../../lib/api/client"
import { ENDPOINTS } from "../../../lib/api/endpoints"
import type { User } from "../../../types/user.types"

// Shape of what POST /auth/google returns
interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export async function loginWithGoogle(googleAccessToken: string): Promise<LoginResponse> {
  const response = await apiClient.post(ENDPOINTS.AUTH.GOOGLE, { access_token: googleAccessToken })
  return response.data
}

export async function getMe(): Promise<User> {
  const response = await apiClient.get(ENDPOINTS.AUTH.ME)
  return response.data
}

export async function refreshToken(token: string): Promise<{ access_token: string }> {
  const response = await apiClient.post(ENDPOINTS.AUTH.REFRESH, { refresh_token: token })
  return response.data
}