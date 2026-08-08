import apiClient from "../lib/api/client"
import { ENDPOINTS } from "../lib/api/endpoints"

/**
 * Client for the server side preference store.
 *
 * The server is the authority for these values. Local state is a cache that
 * exists so the UI can paint before the network responds and so guests still
 * have working preferences. `data_consent` in particular is read only here:
 * it can only be changed through setDataConsent, which hits the dedicated
 * audited endpoint.
 */

export type MapStyle = "standard" | "satellite" | "3d"

export interface ServerPreferences {
  user_id: number
  data_consent: boolean
  map_style: MapStyle
  verified_only: boolean
  directions_only: boolean
  dark_mode: boolean
  tts_enabled: boolean
  selected_tts_voice: string | null
  campus_routing_enabled: boolean
}

/** Fields a client may PATCH. data_consent is deliberately absent. */
export type PreferencesPatch = Partial<
  Pick<
    ServerPreferences,
    | "map_style"
    | "verified_only"
    | "directions_only"
    | "dark_mode"
    | "tts_enabled"
    | "selected_tts_voice"
    | "campus_routing_enabled"
  >
>

export interface ConsentResult {
  user_id: number
  data_consent: boolean
  changed: boolean
}

export async function fetchPreferences(): Promise<ServerPreferences> {
  const { data } = await apiClient.get<ServerPreferences>(ENDPOINTS.USERS.PREFERENCES)
  return data
}

export async function updatePreferences(patch: PreferencesPatch): Promise<ServerPreferences> {
  const { data } = await apiClient.patch<ServerPreferences>(
    ENDPOINTS.USERS.PREFERENCES,
    patch
  )
  return data
}

export async function setDataConsent(granted: boolean): Promise<ConsentResult> {
  const { data } = await apiClient.put<ConsentResult>(ENDPOINTS.USERS.CONSENT, {
    granted,
    client_platform: "web",
  })
  return data
}
