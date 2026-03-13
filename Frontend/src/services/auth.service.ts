/* Authentication service — JWT management */

import client from "@/lib/api/client"
import { ENDPOINTS } from "@/lib/api/endpoints"

export const authService = {
  googleLogin: (accessToken: string) =>
    client.post(ENDPOINTS.AUTH.GOOGLE, { access_token: accessToken }),

  getMe: () => client.get(ENDPOINTS.AUTH.ME),

  refreshToken: (refreshToken: string) =>
    client.post(ENDPOINTS.AUTH.REFRESH, { refresh_token: refreshToken }),

  logout: () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
  },
}
