/* Hook for requesting user geolocation */

import { useEffect, useState } from "react"

type GeolocationState = {
  latitude: number | null
  longitude: number | null
  error: string | null
  loading: boolean
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: "Geolocation not supported", loading: false }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false,
        })
      },
      (error) => {
        setState((prev) => ({ ...prev, error: error.message, loading: false }))
      }
    )
  }, [])

  return state
}
