import { useEffect } from "react"
import { useNavStore } from "../../../store/navStore"
import { fetchRoute } from "./services/routingApi"

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3959
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const SPEED_MPH = { walking: 3, driving: 25, cycling: 10 }

export default function ETAIndicator() {
  const {
    isNavigating,
    destination,
    travelMode,
    updateStats,
    setRoute,
    route,
    currentStepIndex,
    advanceStep,
  } = useNavStore()

  // Effect 1: fetch the OSRM route when navigation starts
  useEffect(() => {
    if (!isNavigating || !destination) return
    if (!destination.latitude || !destination.longitude) return

    navigator.geolocation.getCurrentPosition((pos) => {
      fetchRoute(
        pos.coords.longitude, pos.coords.latitude,
        destination.longitude!, destination.latitude!,
        travelMode
      ).then((result) => {
        if (result) {
          setRoute(result)
          const miles = result.totalDistanceMeters / 1609.34
          const speed = SPEED_MPH[travelMode]
          updateStats(miles, Math.round((miles / speed) * 60))
        }
      })
    })
  }, [isNavigating, destination, travelMode])

  // Effect 2: watch location — update ETA stats + auto-advance steps
  useEffect(() => {
    if (!isNavigating || !destination) return
    if (!destination.latitude || !destination.longitude) return

    const watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude } = pos.coords

      const distMiles = haversineDistance(
        latitude, longitude,
        destination.latitude!, destination.longitude!
      )
      const speed = SPEED_MPH[travelMode]
      updateStats(distMiles, Math.round((distMiles / speed) * 60))

      // Auto-advance: if user is within 80ft of the next step's turn point, advance
      const nextStep = route?.steps[currentStepIndex + 1]
      if (nextStep) {
        const [stepLng, stepLat] = nextStep.location
        const distToStep = haversineDistance(latitude, longitude, stepLat, stepLng)
        if (distToStep < 0.015) {
          advanceStep()
        }
      }
    })

    return () => navigator.geolocation.clearWatch(watchId)
  }, [isNavigating, destination, travelMode, route, currentStepIndex])

  return null
}
