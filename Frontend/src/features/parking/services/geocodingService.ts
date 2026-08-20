interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export interface GeocodeResult {
  lat: number
  lon: number
  displayName: string
}

/**
 * Geocode a free-text address string using the Nominatim OpenStreetMap API.
 * Results are biased toward the UMN campus area via a soft viewbox but not bounded
 * (bounded=0) so addresses outside it still resolve.
 * Rate limit: 1 request/second - fine for manual button clicks.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (!address.trim()) {
    throw new Error("Address is required")
  }

  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    // Soft viewbox biased toward UMN East Bank (west, south, east, north)
    viewbox: "-93.30,44.95,-93.18,45.01",
    bounded: "0",
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        // Nominatim usage policy requires identifying the app
        "Accept-Language": "en",
        "User-Agent": "ParkAndGo/2.0 (university parking app)",
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Geocoding request failed: ${response.status}`)
  }

  const results: NominatimResult[] = await response.json()

  if (!results.length) {
    throw new Error("No location found for that address")
  }

  return {
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  }
}

// Nominatim asks for no more than one request a second, and a search box that
// fires per keystroke would blow past that on its own. The picker debounces
// harder than it does for our own endpoints and waits for a third character:
// two letters cannot identify a street anyway, and every request here leaves
// our infrastructure.
export const ADDRESS_SEARCH_DEBOUNCE_MS = 700
export const ADDRESS_SEARCH_MIN_LENGTH = 3

/**
 * Address suggestions for a partial query, best first.
 *
 * The list-shaped sibling of geocodeAddress. That one answers "where exactly is
 * this address", so returning a single result and throwing on a miss is right
 * for it. A picker asks "what might they mean", where no matches is an ordinary
 * answer and an exception would be a bug.
 */
export async function searchAddresses(
  query: string,
  limit = 4,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < ADDRESS_SEARCH_MIN_LENGTH) return []

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: String(limit),
    // Same soft bias toward campus the single-result path uses, so a bare
    // street number lands near the university rather than across the country.
    viewbox: "-93.30,44.95,-93.18,45.01",
    bounded: "0",
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "ParkAndGo/2.0 (university parking app)",
      },
    }
  )

  // A geocoder being unavailable must not take the buildings and spots down
  // with it: the picker still has two sources that work.
  if (!response.ok) return []

  const results: NominatimResult[] = await response.json()

  return results.map((result) => ({
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    displayName: result.display_name,
  }))
}
