/**
 * RouteLayer tests
 *
 * Two bugs covered:
 *  1. Route does not update as user moves (static route.coordinates always drawn)
 *  2. Route slice trims already-traversed waypoints as user advances
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { RouteResult } from '../../../navigation/components/services/routingApi'
import type { ParkingSpot } from '../../../../types/parking.types'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../../store/navStore', () => ({
  useNavStore: vi.fn(),
}))

vi.mock('maplibre-gl', () => ({}))

// ── Import under test (after mocks) ────────────────────────────────────────

import { useNavStore } from '../../../../store/navStore'
import RouteLayer from '../RouteLayer'

// ── Helpers ────────────────────────────────────────────────────────────────

const DESTINATION: ParkingSpot = {
  spot_id: 1,
  spot_name: 'Oak Street Ramp',
  campus_location: 'East Bank',
  parking_type: 'Parking Garage',
  cost: 2.0,
  walk_time: '5 min walk',
  near_buildings: 'Coffman Union',
  address: '123 Oak St',
  latitude: 44.9739,
  longitude: -93.2312,
  is_verified: true,
  submitted_by: null,
  created_at: null,
}

type NavSlice = {
  isNavigating: boolean
  destination: ParkingSpot | null
  route: RouteResult | null
  routeStatus: 'idle' | 'loading' | 'ready' | 'error'
  travelMode: 'walking' | 'driving' | 'cycling'
}

function setNavState(overrides: Partial<NavSlice> = {}) {
  const state: NavSlice = {
    isNavigating: true,
    destination: DESTINATION,
    route: null,
    routeStatus: 'ready',
    travelMode: 'walking',
    ...overrides,
  }
  // RouteLayer calls useNavStore() with NO selector — mock must return state directly
  vi.mocked(useNavStore).mockReturnValue(state as ReturnType<typeof useNavStore>)
}

/** Builds a mock map that captures GeoJSON written to its source */
function makeMockMap(hasExistingSource = false) {
  const setData = vi.fn()
  const addSource = vi.fn()
  const addLayer = vi.fn()

  const map = {
    isStyleLoaded: vi.fn(() => true),
    getSource: vi.fn(() => (hasExistingSource ? { setData } : null)),
    addSource,
    addLayer,
    getLayer: vi.fn(() => null),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    once: vi.fn(),
  } as unknown as import('maplibre-gl').Map

  return { map, setData, addSource, addLayer }
}

/** Pull coordinates from the most recent addSource or setData call */
function getLastCoords(mock: ReturnType<typeof vi.fn>): [number, number][] {
  const lastArg = mock.mock.calls[mock.mock.calls.length - 1]
  // addSource: (id, { type, data }) — data is GeoJSON Feature
  // setData:   (GeoJSON Feature)
  const raw = lastArg.length === 2 ? (lastArg[1] as { data: GeoJSON.Feature<GeoJSON.LineString> }).data : (lastArg[0] as GeoJSON.Feature<GeoJSON.LineString>)
  return raw.geometry.coordinates as [number, number][]
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  setNavState()
})

describe('RouteLayer — route drawing', () => {
  it('does not draw any route while a live route request is still loading', () => {
    setNavState({ route: null, routeStatus: 'loading' })
    const { map, addSource, addLayer } = makeMockMap(false)

    render(<RouteLayer map={map} userLocation={[-93.228, 44.974]} />)

    expect(addSource).not.toHaveBeenCalled()
    expect(addLayer).not.toHaveBeenCalled()
    expect((map.removeLayer as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(0)
  })

  it('draws a straight line from userLocation to destination when no route is loaded', () => {
    setNavState({ route: null })
    const { map, addSource } = makeMockMap(false)

    render(<RouteLayer map={map} userLocation={[-93.228, 44.974]} />)

    expect(addSource).toHaveBeenCalledOnce()
    const coords = getLastCoords(addSource)

    expect(coords[0]).toEqual([-93.228, 44.974])
    expect(coords[coords.length - 1]).toEqual([-93.2312, 44.9739])
    expect(coords).toHaveLength(2)
  })

  it('starts drawn route at user current location even when a pre-fetched route exists', () => {
    // Route was fetched when user was at coord[0]; user has since moved.
    const fetchedRoute: RouteResult = {
      coordinates: [
        [-93.2300, 44.9720], // stale origin at fetch time
        [-93.2310, 44.9730],
        [-93.2312, 44.9739],
      ],
      steps: [],
      totalDistanceMeters: 160.9,
      totalDurationSeconds: 120,
    }

    setNavState({ route: fetchedRoute })
    const userLocation: [number, number] = [-93.2305, 44.9726] // user has moved
    const { map, addSource } = makeMockMap(false)

    render(<RouteLayer map={map} userLocation={userLocation} />)

    expect(addSource).toHaveBeenCalledOnce()
    const coords = getLastCoords(addSource)

    // BUG (pre-fix): coords[0] === stale origin [-93.2300, 44.9720]
    // EXPECTED: coords[0] === user's current live position
    expect(coords[0]).toEqual(userLocation)
  })

  it('trims already-traversed waypoints as user advances along the route', () => {
    // Route: A → B → C → D (destination)
    const routeCoords: [number, number][] = [
      [-93.2300, 44.9720], // A — start (already passed)
      [-93.2305, 44.9725], // B — already passed
      [-93.2310, 44.9730], // C — closest to user
      [-93.2312, 44.9739], // D — destination
    ]

    setNavState({
      route: {
        coordinates: routeCoords,
        steps: [],
        totalDistanceMeters: 241.4,
        totalDurationSeconds: 180,
      },
    })

    // User is near waypoint C (index 2)
    const userLocation: [number, number] = [-93.2310, 44.9731]
    const { map, addSource } = makeMockMap(false)

    render(<RouteLayer map={map} userLocation={userLocation} />)

    const coords = getLastCoords(addSource)

    // Route must start at user's current position
    expect(coords[0]).toEqual(userLocation)

    // Already-traversed waypoints A and B must NOT appear in the rendered line
    const hasA = coords.some((c) => c[0] === routeCoords[0][0] && c[1] === routeCoords[0][1])
    const hasB = coords.some((c) => c[0] === routeCoords[1][0] && c[1] === routeCoords[1][1])
    expect(hasA).toBe(false)
    expect(hasB).toBe(false)

    // Destination must still appear at the end
    expect(coords[coords.length - 1]).toEqual([-93.2312, 44.9739])
  })

  it('updates drawn route when userLocation prop changes (re-render)', () => {
    const fetchedRoute: RouteResult = {
      coordinates: [
        [-93.2300, 44.9720],
        [-93.2306, 44.9728],
        [-93.2312, 44.9739],
      ],
      steps: [],
      totalDistanceMeters: 160.9,
      totalDurationSeconds: 120,
    }

    setNavState({ route: fetchedRoute })
    const { map, setData } = makeMockMap(true) // existing source → setData path

    const locationA: [number, number] = [-93.2300, 44.9720]
    const locationB: [number, number] = [-93.2306, 44.9728] // user advanced

    const { rerender } = render(<RouteLayer map={map} userLocation={locationA} />)
    rerender(<RouteLayer map={map} userLocation={locationB} />)

    // setData must have been called after the re-render
    expect(setData.mock.calls.length).toBeGreaterThanOrEqual(2)

    // The last drawn line must start at locationB
    const coords = getLastCoords(setData)
    expect(coords[0]).toEqual(locationB)
  })
})
