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
