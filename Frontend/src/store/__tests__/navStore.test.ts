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

  // Start must reuse the route the preview already fetched and drew. Bumping
  // routeRequestId here discarded it, put the status back to "loading", and made
  // RouteLayer redraw the line, so it blinked out just as guidance began and the
  // trip cost a second OSRM request.
  it('beginNavigation keeps the route the preview already fetched', () => {
    const previewRoute = {
      coordinates: [
        [-93.2300, 44.9720],
        [-93.2312, 44.9739],
      ] as [number, number][],
      steps: [],
      totalDistanceMeters: 200,
      totalDurationSeconds: 150,
    }

    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().setRoute(previewRoute)
    const requestIdBeforeStart = useNavStore.getState().routeRequestId

    useNavStore.getState().beginNavigation()

    const state = useNavStore.getState()
    expect(state.route).toBe(previewRoute)
    expect(state.routeStatus).toBe('ready')
    expect(state.routeRequestId).toBe(requestIdBeforeStart)
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

  it('setCurrentStepIndex clamps to the route bounds', () => {
    useNavStore.getState().setRoute({
      coordinates: [
        [-93.228, 44.974],
        [-93.227, 44.975],
      ],
      steps: [
        {
          instruction: 'Head forward',
          distance: '0.1 mi',
          distanceMeters: 160,
          maneuverType: 'depart',
          maneuverModifier: 'straight',
          icon: 'bi-arrow-up-circle-fill',
          location: [-93.228, 44.974],
        },
        {
          instruction: 'You have arrived',
          distance: '0 ft',
          distanceMeters: 0,
          maneuverType: 'arrive',
          maneuverModifier: 'straight',
          icon: 'bi-p-circle-fill',
          location: [-93.227, 44.975],
        },
      ],
      totalDistanceMeters: 160,
      totalDurationSeconds: 120,
    })

    useNavStore.getState().setCurrentStepIndex(99)
    expect(useNavStore.getState().currentStepIndex).toBe(1)

    useNavStore.getState().setCurrentStepIndex(-3)
    expect(useNavStore.getState().currentStepIndex).toBe(0)
  })
  // ── Trip planner: origin, stops, and swap ──

  const otherSpot: ParkingSpot = {
    ...fakeSpot,
    spot_id: 2,
    spot_name: 'Church Street Garage',
    latitude: 44.9745,
    longitude: -93.2355,
  }

  const buildingLike: ParkingSpot = {
    ...fakeSpot,
    spot_id: 3,
    spot_name: 'Coffman Memorial Union',
    parking_type: null,
    cost: null,
    latitude: 44.9728,
    longitude: -93.2353,
  }

  // Guidance running, so route invalidation is expected. Set directly rather
  // than through beginNavigation so each case starts from a drawn route.
  function withLiveGuidance() {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.setState({
      hasStartedNavigation: true,
      routeStatus: 'ready',
      routeRequestId: 4,
    })
  }

  it('defaults to your location as the origin with no stops', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    const state = useNavStore.getState()
    expect(state.origin).toBeNull()
    expect(state.stops).toEqual([])
  })

  it('startNavigation clears a previous trip rather than inheriting it', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().setOrigin(otherSpot)
    useNavStore.getState().addStop(buildingLike)

    useNavStore.getState().startNavigation(otherSpot)

    const state = useNavStore.getState()
    expect(state.origin).toBeNull()
    expect(state.stops).toEqual([])
  })

  it('endNavigation clears the origin and stops', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().addStop(otherSpot)
    useNavStore.getState().endNavigation()

    const state = useNavStore.getState()
    expect(state.origin).toBeNull()
    expect(state.stops).toEqual([])
  })

  it('gives each stop an id of its own, even for the same place twice', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().addStop(otherSpot)
    useNavStore.getState().addStop(otherSpot)

    const { stops } = useNavStore.getState()
    expect(stops).toHaveLength(2)
    expect(stops[0].id).not.toBe(stops[1].id)
  })

  it('moveStop reorders and leaves an out of range move alone', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().addStop(otherSpot)
    useNavStore.getState().addStop(buildingLike)

    useNavStore.getState().moveStop(1, 0)
    expect(useNavStore.getState().stops.map((s) => s.place.spot_id)).toEqual([3, 2])

    useNavStore.getState().moveStop(0, -1)
    expect(useNavStore.getState().stops.map((s) => s.place.spot_id)).toEqual([3, 2])
  })

  it('removeStop drops only the stop asked for', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().addStop(otherSpot)
    useNavStore.getState().addStop(buildingLike)

    const [first] = useNavStore.getState().stops
    useNavStore.getState().removeStop(first.id)

    expect(useNavStore.getState().stops.map((s) => s.place.spot_id)).toEqual([3])
  })

  it('swapEndpoints reverses the trip, stops included', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().setOrigin(otherSpot)
    useNavStore.getState().addStop(buildingLike)
    useNavStore.getState().addStop(otherSpot)

    useNavStore.getState().swapEndpoints()

    const state = useNavStore.getState()
    expect(state.origin?.spot_id).toBe(1)
    expect(state.destination?.spot_id).toBe(2)
    expect(state.stops.map((s) => s.place.spot_id)).toEqual([2, 3])
  })

  // "Your location" is a moving target, so swapping it into the destination
  // slot has to pin it to where the user is at that moment.
  it('swapEndpoints resolves a live-location origin to a fixed point', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().setCurrentUserLocation({ coords: [-93.24, 44.97], heading: 0 })

    useNavStore.getState().swapEndpoints()

    const state = useNavStore.getState()
    expect(state.origin?.spot_id).toBe(1)
    expect(state.destination?.spot_name).toBe('Your location')
    expect(state.destination?.longitude).toBe(-93.24)
    expect(state.destination?.latitude).toBe(44.97)
  })

  it('swapEndpoints refuses when there is no location to resolve', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().swapEndpoints()

    const state = useNavStore.getState()
    expect(state.origin).toBeNull()
    expect(state.destination?.spot_id).toBe(1)
  })

  it('leaves the drawn route alone when a trip is edited before Start', () => {
    // Before Start the request key alone decides whether to refetch, and the
    // previous line should stay on screen until the new one lands.
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.setState({ routeStatus: 'ready', routeRequestId: 4 })

    useNavStore.getState().addStop(otherSpot)

    const state = useNavStore.getState()
    expect(state.routeStatus).toBe('ready')
    expect(state.routeRequestId).toBe(4)
  })

  it('throws the route away when a trip is edited during guidance', () => {
    withLiveGuidance()
    useNavStore.getState().addStop(otherSpot)

    const state = useNavStore.getState()
    expect(state.routeStatus).toBe('loading')
    expect(state.routeRequestId).toBe(5)
    expect(state.route).toBeNull()
  })

  it('invalidates the route for every kind of trip edit', () => {
    const edits: Array<[string, () => void]> = [
      ['setOrigin', () => useNavStore.getState().setOrigin(otherSpot)],
      ['setDestination', () => useNavStore.getState().setDestination(otherSpot)],
      ['addStop', () => useNavStore.getState().addStop(otherSpot)],
      ['removeStop', () => useNavStore.getState().removeStop(useNavStore.getState().stops[0].id)],
      [
        'setStopPlace',
        () => useNavStore.getState().setStopPlace(useNavStore.getState().stops[0].id, buildingLike),
      ],
      ['moveStop', () => useNavStore.getState().moveStop(0, 1)],
    ]

    for (const [name, edit] of edits) {
      useNavStore.setState(useNavStore.getInitialState())
      withLiveGuidance()
      useNavStore.getState().addStop(otherSpot)
      useNavStore.getState().addStop(buildingLike)
      const before = useNavStore.getState().routeRequestId
      useNavStore.setState({ routeStatus: 'ready' })

      edit()

      expect(useNavStore.getState().routeRequestId, name).toBe(before + 1)
      expect(useNavStore.getState().routeStatus, name).toBe('loading')
    }
  })

  it('setDestination retargets a trip without dropping its stops', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.getState().setOrigin(otherSpot)
    useNavStore.getState().addStop(buildingLike)

    useNavStore.getState().setDestination(buildingLike)

    const state = useNavStore.getState()
    expect(state.destination?.spot_id).toBe(3)
    expect(state.origin?.spot_id).toBe(2)
    expect(state.stops).toHaveLength(1)
  })
  // ── Route options ──

  const routeA = {
    coordinates: [[-93.2277, 44.974], [-93.22, 44.975]] as [number, number][],
    steps: [],
    totalDistanceMeters: 1600,
    totalDurationSeconds: 600,
    source: 'network' as const,
    notice: null,
  }
  const routeB = { ...routeA, totalDistanceMeters: 2100, totalDurationSeconds: 900 }

  it('selects the first option, the one the router ranked best', () => {
    useNavStore.getState().setRouteOptions([routeA, routeB])
    const state = useNavStore.getState()
    expect(state.route).toEqual(routeA)
    expect(state.selectedRouteIndex).toBe(0)
    expect(state.routeStatus).toBe('ready')
  })

  it('treats an empty option set as a failed route', () => {
    useNavStore.getState().setRouteOptions([])
    const state = useNavStore.getState()
    expect(state.route).toBeNull()
    expect(state.routeStatus).toBe('error')
  })

  it('selectRoute swaps the drawn route and its stats without refetching', () => {
    useNavStore.getState().setRouteOptions([routeA, routeB])
    const before = useNavStore.getState().routeRequestId

    useNavStore.getState().selectRoute(1)

    const state = useNavStore.getState()
    expect(state.route).toEqual(routeB)
    expect(state.etaMinutes).toBe(15)
    expect(state.routeRequestId).toBe(before)
  })

  it('selectRoute ignores an index that is not on offer', () => {
    useNavStore.getState().setRouteOptions([routeA, routeB])
    useNavStore.getState().selectRoute(7)
    expect(useNavStore.getState().selectedRouteIndex).toBe(0)
  })

  // Guidance follows the line that is drawn, so the step pointer has to return
  // to the top of the new turn list rather than keep an index into the old one.
  it('selectRoute resets the step pointer', () => {
    useNavStore.getState().setRouteOptions([routeA, routeB])
    useNavStore.setState({ currentStepIndex: 3 })

    useNavStore.getState().selectRoute(1)
    expect(useNavStore.getState().currentStepIndex).toBe(0)
  })

  it('clears the option set when a trip edit invalidates the route', () => {
    useNavStore.getState().startNavigation(fakeSpot)
    useNavStore.setState({ hasStartedNavigation: true })
    useNavStore.getState().setRouteOptions([routeA, routeB])

    useNavStore.getState().addStop(otherSpot)

    const state = useNavStore.getState()
    expect(state.routeOptions).toEqual([])
    expect(state.selectedRouteIndex).toBe(0)
  })

  it('endNavigation clears the option set', () => {
    useNavStore.getState().setRouteOptions([routeA, routeB])
    useNavStore.getState().endNavigation()
    expect(useNavStore.getState().routeOptions).toEqual([])
  })
})
