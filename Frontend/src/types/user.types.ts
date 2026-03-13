export interface User {
  user_id: number
  google_id: string | null
  email: string | null
  profile_pic: string | null
  first_name: string
  last_name: string
  prefered_name: string | null        
  preferred_parking_types: string | null
  major: string | null
  major_category: string | null
  grade_level: string | null
  graduation_year: number | null
  housing_type: string | null
  is_admin: boolean
  is_profile_complete: boolean        // backend computes this from profile fields
  created_at: string | null
}

export interface UserProfileUpdate {
  prefered_name?: string
  major?: string
  major_category?: string
  grade_level?: string
  graduation_year?: number
  housing_type?: string
  preferred_parking_types?: string
}
