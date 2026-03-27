/**
 * NavigationDiagnostic.tsx
 * 
 * Temporary debug component to diagnose why stats don't populate.
 * Add to root App.tsx during testing:
 * 
 * import NavigationDiagnostic from './components/NavigationDiagnostic'
 * ...
 * <NavigationDiagnostic />
 */

import { useEffect, useState } from 'react'
import { useNavStore } from '../store/navStore'

export default function NavigationDiagnostic() {
  const [diagnostics, setDiagnostics] = useState<string[]>([])

  useEffect(() => {
    const logs: string[] = []

    // Check 1: Browser supports geolocation
    if (navigator.geolocation) {
      logs.push('✓ Geolocation API supported')
    } else {
      logs.push('✗ Geolocation API NOT supported')
    }

    // Check 2: Try to get position (will show if permission denied)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        logs.push(`✓ Geolocation permission granted`)
        logs.push(`  Latitude: ${pos.coords.latitude}`)
        logs.push(`  Longitude: ${pos.coords.longitude}`)
        logs.push(`  Accuracy: ${pos.coords.accuracy}m`)
        setDiagnostics([...logs])
      },
      (err) => {
        const errorMsg = `✗ Geolocation permission denied or unavailable (Code: ${err.code})`
        logs.push(errorMsg)
        logs.push(`  Message: ${err.message}`)
        setDiagnostics([...logs])
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )

    // Check 3: Monitor navigation state changes
    const unsubscribe = useNavStore.subscribe((state) => {
      const msg = `[NAV STATE] Started: ${state.hasStartedNavigation}, Distance: ${state.distanceRemainingMiles}, ETA: ${state.etaMinutes}`
      console.log(msg)
    })

    return unsubscribe
  }, [])

  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white text-xs p-3 rounded max-w-sm max-h-[300px] overflow-auto z-[9999] font-mono">
      <div className="font-bold mb-2">Navigation Diagnostic</div>
      {diagnostics.length === 0 ? (
        <div>Checking permissions...</div>
      ) : (
        <div>
          {diagnostics.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-white/30 text-xs">
        <div>Current State:</div>
        <DisplayNavState />
      </div>
    </div>
  )
}

function DisplayNavState() {
  const state = useNavStore()

  return (
    <div className="text-[9px] text-green-400">
      <div>Navigating: {state.isNavigating ? 'YES' : 'NO'}</div>
      <div>Started: {state.hasStartedNavigation ? 'YES' : 'NO'}</div>
      <div>Distance: {state.distanceRemainingMiles?.toFixed(2) ?? 'null'} mi</div>
      <div>ETA: {state.etaMinutes ?? 'null'} min</div>
      <div>Arrival: {state.arrivalTime ?? 'null'}</div>
    </div>
  )
}
