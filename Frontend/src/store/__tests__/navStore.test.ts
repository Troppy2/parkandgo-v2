import { describe, it, expect, beforeEach } from 'vitest'
import { useNavStore } from '../navStore'
import type { ParkingSpot } from '../../types/parking.types'

const fakeSpot: ParkingSpot = {
  spot_id: 1,
  spot_name: 'Oak Street Ramp',
  campus_location: 'East Bank',
  parking_type: 'Parking Garage',
  cost: 2.5,
  walk_time: '5 min walk',
  near_buildings: 'Keller Hall',
  address: '100 Oak St SE',
  latitude: 44.974,
  longitude: -93.228,
  is_verified: true,
  submitted_by: null,
  created_at: null,
}

describe('navStore', () => {
  beforeEach(() => {
    useNavStore.setState(useNavStore.getInitialState())
  })

  it('starts with no navigation', () => {
    const state = useNavStore.getState()
    expect(state.isNavigating).toBe(false)
    expect(state.destination).toBeNull()
    expect(state.navOverlayVisible).toBe(false)
  })

  it('startNavigation sets destination in pre-start state', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    const state = useNavStore.getState()
    expect(state.isNavigating).toBe(true)
    expect(state.hasStartedNavigation).toBe(false)
    expect(state.navOverlayVisible).toBe(true)
    expect(state.destination?.spot_id).toBe(1)
  })

  it('beginNavigation flips into active turn-by-turn state', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().beginNavigation()
    const state = useNavStore.getState()
    expect(state.hasStartedNavigation).toBe(true)
  })

  it('endNavigation resets all navigation state', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().beginNavigation()
    useNavStore.getState().endNavigation()
    const state = useNavStore.getState()
    expect(state.isNavigating).toBe(false)
    expect(state.hasStartedNavigation).toBe(false)
    expect(state.destination).toBeNull()
    expect(state.etaMinutes).toBeNull()
    expect(state.route).toBeNull()
  })

  it('updateStats calculates arrival time', () => {
    useNavStore.getState().updateStats(1.5, 10)
    const state = useNavStore.getState()
    expect(state.distanceRemainingMiles).toBe(1.5)
    expect(state.etaMinutes).toBe(10)
    expect(state.arrivalTime).toBeTruthy()
  })

  it('setTravelMode changes the mode', () => {
    useNavStore.getState().setTravelMode('driving')
    expect(useNavStore.getState().travelMode).toBe('driving')
  })

  it('setNavOverlayVisible toggles overlay', () => {
    useNavStore.getState().setNavOverlayVisible(true)
    expect(useNavStore.getState().navOverlayVisible).toBe(true)
    useNavStore.getState().setNavOverlayVisible(false)
    expect(useNavStore.getState().navOverlayVisible).toBe(false)
  })
})
