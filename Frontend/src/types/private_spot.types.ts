export interface PrivateSpot {
  private_spot_id: number
  user_id: number
  name: string
  latitude: number
  longitude: number
  notes: string | null
  is_default: boolean
  created_at: string | null
  updated_at: string | null
}

export interface PrivateSpotCreate {
  name: string
  latitude: number
  longitude: number
  notes?: string | null
  is_default?: boolean
}

export interface PrivateSpotUpdate {
  name?: string
  latitude?: number
  longitude?: number
  notes?: string | null
  is_default?: boolean
}
