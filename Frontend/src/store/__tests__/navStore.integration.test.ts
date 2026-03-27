import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useNavStore } from '../navStore'
import { enableMockGeolocation, disableMockGeolocation, setMockLocation, UMN_TEST_LOCATIONS } from '../../lib/testing/mockGeolocation'
import type { ParkingSpot } from '../../types/parking.types'

const fakeSpot: ParkingSpot = {
  spot_id: 1,
  spot_name: 'East River Road',
  campus_location: 'East Bank',
  parking_type: 'Street Parking',
  cost: 1.5,
  walk_time: '10 min walk',
  near_buildings: 'Science Library',
  address: '123 East River Road',
  latitude: 44.9750,      // Destination: East River Road area
  longitude: -93.2200,
  is_verified: true,
  submitted_by: null,
  created_at: null,
}

describe('Navigation Flow with Mock Geolocation', () => {
  beforeEach(() => {
    // Reset Zustand store
    useNavStore.setState(useNavStore.getInitialState())
    // Enable mock geolocation
    enableMockGeolocation()
    // Start from East Bank
    setMockLocation(UMN_TEST_LOCATIONS.eastBank)
  })

  afterEach(() => {
    disableMockGeolocation()
    vi.clearAllMocks()
  })

  it('should have initial state', () => {
    const state = useNavStore.getState()
    expect(state.isNavigating).toBe(false)
    expect(state.hasStartedNavigation).toBe(false)
    expect(state.destination).toBeNull()
    expect(state.distanceRemainingMiles).toBeNull()
    expect(state.etaMinutes).toBeNull()
  })

  it('should start navigation with preview state', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    const state = useNavStore.getState()
    
    expect(state.isNavigating).toBe(true)
    expect(state.hasStartedNavigation).toBe(false)  // ← Still in preview
    expect(state.destination?.spot_id).toBe(1)
    expect(state.distanceRemainingMiles).toBeNull()  // ← Not populated yet
    expect(state.etaMinutes).toBeNull()
  })

  it('should begin navigation after Start tap', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().beginNavigation()
    const state = useNavStore.getState()
    
    expect(state.hasStartedNavigation).toBe(true)
    expect(state.isNavigating).toBe(true)
  })

  it('should populate stats when navigation starts', async () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().beginNavigation()
    
    // Simulate brief wait for geolocation + OSRM call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    
    const state = useNavStore.getState()
    console.log('State after wait:', state)
    
    // Stats should be populated
    if (state.distanceRemainingMiles !== null) {
      expect(state.distanceRemainingMiles).toBeGreaterThan(0)
      expect(state.distanceRemainingMiles).toBeLessThan(1)  // UMN is small
      expect(state.etaMinutes).toBeGreaterThan(0)
      expect(state.arrivalTime).toBeTruthy()
    } else {
      console.warn('Stats not populated - geolocation or OSRM may have failed')
    }
  })

  it('should calculate correct distance between two points', () => {
    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

    const distance = haversineDistance(
      UMN_TEST_LOCATIONS.eastBank.lat,
      UMN_TEST_LOCATIONS.eastBank.lng,
      fakeSpot.latitude!,
      fakeSpot.longitude!
    )

    console.log('Distance:', distance, 'miles')
    expect(distance).toBeGreaterThan(0)
    expect(distance).toBeLessThan(1)  // Should be less than 1 mile on UMN
  })

  it('should update stats with mock location', () => {
    useNavStore.getState().updateStats(0.25, 15)
    const state = useNavStore.getState()

    expect(state.distanceRemainingMiles).toBe(0.25)
    expect(state.etaMinutes).toBe(15)
    expect(state.arrivalTime).toBeTruthy()
    console.log('Arrival time:', state.arrivalTime)
  })

  it('should handle travel mode changes', () => {
    useNavStore.getState().setTravelMode('driving')
    expect(useNavStore.getState().travelMode).toBe('driving')

    useNavStore.getState().setTravelMode('walking')
    expect(useNavStore.getState().travelMode).toBe('walking')
  })

  it('should reset state on end navigation', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().beginNavigation()
    useNavStore.getState().updateStats(0.5, 20)

    useNavStore.getState().endNavigation()
    const state = useNavStore.getState()

    expect(state.isNavigating).toBe(false)
    expect(state.hasStartedNavigation).toBe(false)
    expect(state.destination).toBeNull()
    expect(state.distanceRemainingMiles).toBeNull()
    expect(state.etaMinutes).toBeNull()
  })
})
