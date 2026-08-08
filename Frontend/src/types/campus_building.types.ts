import type { CampusLocation } from "./parking.types"

/**
 * A UMN campus building, used as a walking destination in Campus Mode.
 *
 * Reference data seeded from OpenStreetMap, not user content. See
 * Backend/scripts/extract_campus_buildings.py for how it is produced.
 */
export interface CampusBuilding {
  building_id: number
  name: string
  /** Official UMN abbreviation where one exists, for example "CMU". */
  short_name: string | null
  campus_location: CampusLocation | null
  address: string | null
  latitude: number
  longitude: number
  /** OpenStreetMap element reference, for example "way/30056874". */
  osm_id: string | null
  created_at: string | null
  /**
   * Only populated by the nearby endpoint, which knows the user's position.
   * Null everywhere else, so "no distance available" stays distinguishable
   * from "zero miles away".
   */
  distance_miles: number | null
}

export interface SavedBuilding {
  id: number
  user_id: number
  building_id: number
  created_at: string | null
  building: CampusBuilding
}
