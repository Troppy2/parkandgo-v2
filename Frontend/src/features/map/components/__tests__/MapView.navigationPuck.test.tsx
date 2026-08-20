import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { enableMockGeolocation, disableMockGeolocation, setMockLocation, UMN_TEST_LOCATIONS } from '../../../../lib/testing/mockGeolocation'

// The live marker has two forms: the idle dot while the user is browsing, and
// the navigation puck once Start is pressed. These tests pin the swap, because
// a marker that fails to swap looks identical to one that swapped correctly in
// every unit test of the builders themselves.

vi.mock('../../../../store/authStore', () => ({
  useAuthStore: () => ({ isGuest: true, user: null }),
}))

vi.mock('../../../../store/uiStore', () => ({
  useUIStore: vi.fn(),
}))

vi.mock('../../../../store/navStore', () => ({
  useNavStore: vi.fn(),
}))

vi.mock('../../../../features/events/hooks/useEvents', () => ({
  useEvents: () => ({ data: undefined }),
}))

vi.mock('../../../../features/campus/hooks/useCampusBuildings', () => ({
  useNearbyBuildings: () => ({ data: undefined }),
}))

const { capturedElements, removedElements, getBearingMock } = vi.hoisted(() => ({
  capturedElements: [] as HTMLElement[],
  removedElements: [] as HTMLElement[],
  getBearingMock: vi.fn(() => 0),
}))

vi.mock('../RouteLayer', () => ({ default: vi.fn(() => null) }))

vi.mock('maplibre-gl', () => {
  class MockMap {
    flyTo = vi.fn()
    zoomIn = vi.fn()
    zoomOut = vi.fn()
    remove = vi.fn()
    setStyle = vi.fn()
    setPitch = vi.fn()
    setBearing = vi.fn()
    getBearing = getBearingMock
    getPitch = vi.fn(() => 0)
    once = vi.fn()
    on = vi.fn()
    off = vi.fn()
    easeTo = vi.fn()
    isMoving = vi.fn(() => false)
    setPadding = vi.fn()
    getContainer = vi.fn(() => document.createElement('div'))
    getStyle = vi.fn(() => ({ layers: [] }))
    addLayer = vi.fn()
    addSource = vi.fn()
    getSource = vi.fn(() => null)
    getLayer = vi.fn(() => null)
    removeLayer = vi.fn()
    removeSource = vi.fn()
    isStyleLoaded = vi.fn(() => true)
  }

  class MockMarker {
    _element: HTMLElement | undefined
    constructor(options?: { element?: HTMLElement; anchor?: string }) {
      this._element = options?.element
      if (options?.element) capturedElements.push(options.element)
    }
    setLngLat = vi.fn(() => this)
    setPopup = vi.fn(() => this)
    addTo = vi.fn(() => this)
    remove = vi.fn(() => {
      if (this._element) removedElements.push(this._element)
    })
    getElement = vi.fn(() => this._element)
  }

  class MockPopup {
    setHTML = vi.fn(() => this)
  }

  return {
    default: { Map: MockMap, Marker: MockMarker, Popup: MockPopup },
  }
})

import { useNavStore } from '../../../../store/navStore'
import { useUIStore } from '../../../../store/uiStore'
import MapView from '../MapView'

type NavState = ReturnType<typeof useNavStore.getState>

const uiState = {
  activeTab: 'spots',
  setActiveTab: vi.fn(),
  mapInstance: null,
  setMapInstance: vi.fn(),
  verifiedOnly: false,
  directionsOnly: false,
  mapStyle: 'standard',
  toasts: [],
  showToast: vi.fn(),
  removeToast: vi.fn(),
  settingsOpen: false,
  setSettingsOpen: vi.fn(),
  suggestSpotOpen: false,
  setSuggestSpotOpen: vi.fn(),
  isOffline: false,
  setOffline: vi.fn(),
  darkMode: false,
  setDarkMode: vi.fn(),
  dataConsent: false,
  setDataConsent: vi.fn(),
  ttsEnabled: false,
  setTTSEnabled: vi.fn(),
  campusRoutingEnabled: true,
  appMode: 'parking' as const,
  setCampusRoutingEnabled: vi.fn(),
  locationEnabled: false,
  setLocationEnabled: vi.fn(),
} as unknown as ReturnType<typeof useUIStore.getState>

// Held stable across calls on purpose. MapView keys its map/geolocation effect
// on setCurrentUserLocation, so handing it a fresh mock per state change would
// tear the map down and rebuild it, which is not what ending a trip does.
const navActions = {
  startNavigation: vi.fn(),
  beginNavigation: vi.fn(),
  endNavigation: vi.fn(),
  retryRoute: vi.fn(),
  setNavOverlayVisible: vi.fn(),
  updateStats: vi.fn(),
  setTravelMode: vi.fn(),
  origin: null,
  stops: [],
  setOrigin: vi.fn(),
  routeOptions: [],
  selectedRouteIndex: 0,
  setRouteOptions: vi.fn(),
  selectRoute: vi.fn(),
  setDestination: vi.fn(),
  addStop: vi.fn(),
  setStopPlace: vi.fn(),
  removeStop: vi.fn(),
  moveStop: vi.fn(),
  swapEndpoints: vi.fn(),
  setCurrentUserLocation: vi.fn(),
  setRoute: vi.fn(),
  setRouteError: vi.fn(),
  clearRouteNotice: vi.fn(),
  advanceStep: vi.fn(),
  setCurrentStepIndex: vi.fn(),
  setRememberedSpot: vi.fn(),
  promptRememberSpot: vi.fn(),
  dismissRememberSpotPrompt: vi.fn(),
}

function setupStores(overrides: Partial<NavState> = {}) {
  const navState = {
    isNavigating: false,
    hasStartedNavigation: false,
    navOverlayVisible: false,
    destination: null,
    currentUserLocation: {
      coords: [-93.2312, 44.9739] as [number, number],
      heading: 45,
    },
    distanceRemainingMiles: null,
    etaMinutes: null,
    arrivalTime: null,
    travelMode: 'walking',
    routeStatus: 'idle',
    routeError: null,
    routeNotice: null,
    routeRequestId: 0,
    route: null,
    currentStepIndex: 0,
    rememberedSpot: null,
    arrivalRememberPromptOpen: false,
    arrivalRememberSpot: null,
    ...navActions,
    ...overrides,
  } as NavState

  vi.mocked(useUIStore).mockImplementation((sel) => sel(uiState))
  vi.mocked(useNavStore).mockImplementation((sel) => sel(navState))
}

// Built fresh on every call. Reusing one element reference would let React
// bail out of the re-render entirely and the swap would never be exercised.
const mapTree = () => (
  <div>
    <div data-testid="map-container" style={{ width: '100%', height: '100vh' }} />
    <MapView />
  </div>
)

const found = (attr: string) =>
  capturedElements.find((e) => e.getAttribute(attr) === 'true')

describe('navigation puck', () => {
  beforeEach(() => {
    capturedElements.length = 0
    removedElements.length = 0
    getBearingMock.mockReturnValue(0)
    enableMockGeolocation()
    setMockLocation(UMN_TEST_LOCATIONS.eastBank)
  })

  afterEach(() => {
    cleanup()
    disableMockGeolocation()
  })

  it('shows the idle dot before Start', async () => {
    setupStores()
    render(mapTree())

    await waitFor(() => expect(found('data-user-location-marker')).toBeDefined())
    expect(found('data-navigation-puck')).toBeUndefined()
  })

  it('still shows the idle dot while a route is only being previewed', async () => {
    // Picking a destination sets isNavigating, but guidance has not begun until
    // the user taps Start, and the preview camera still frames the destination.
    setupStores({ isNavigating: true, hasStartedNavigation: false })
    render(mapTree())

    await waitFor(() => expect(found('data-user-location-marker')).toBeDefined())
    expect(found('data-navigation-puck')).toBeUndefined()
  })

  it('swaps in the puck once guidance starts', async () => {
    setupStores({ isNavigating: true, hasStartedNavigation: true })
    render(mapTree())

    await waitFor(() => expect(found('data-navigation-puck')).toBeDefined())
    expect(found('data-user-location-marker')).toBeUndefined()
  })

  it('rotates the puck to the heading through the shared transform hook', async () => {
    setupStores({ isNavigating: true, hasStartedNavigation: true })
    render(mapTree())

    await waitFor(() => {
      const svg = found('data-navigation-puck')?.querySelector(
        '[data-heading-transform="true"]',
      ) as SVGElement | null

      expect(svg?.style.transform).toBe('rotate(45deg)')
    })
  })

  // The guidance camera is course-up, so the map is already turned to the
  // direction of travel. Writing the raw heading on top of that would rotate the
  // puck twice and leave the chevron pointing at double the true course.
  it('rotates by the difference between heading and map bearing', async () => {
    getBearingMock.mockReturnValue(90)
    setupStores({ isNavigating: true, hasStartedNavigation: true })
    render(mapTree())

    await waitFor(() => {
      const svg = found('data-navigation-puck')?.querySelector(
        '[data-heading-transform="true"]',
      ) as SVGElement | null

      expect(svg?.style.transform).toBe('rotate(-45deg)')
    })
  })

  it('returns to the idle dot when navigation ends', async () => {
    setupStores({ isNavigating: true, hasStartedNavigation: true })
    const { rerender } = render(mapTree())

    await waitFor(() => expect(found('data-navigation-puck')).toBeDefined())
    const puck = found('data-navigation-puck')!

    setupStores({ isNavigating: false, hasStartedNavigation: false })
    rerender(mapTree())

    await waitFor(() => expect(found('data-user-location-marker')).toBeDefined())
    // The old marker has to be torn off the map, not just hidden behind the new
    // one, or two live markers drift apart as the user moves.
    expect(removedElements).toContain(puck)
  })
})
