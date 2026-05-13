/**
 * Integration test for RecommendationList.
 * Mocks the useRecommendations hook to simulate loading, data, and error states.
 * Verifies: skeleton during load → cards render after data → empty state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import RecommendationList from '../RecommendationList'
import { useAuthStore } from '../../../../store/authStore'
import { useUIStore } from '../../../../store/uiStore'
import { useRecommendationStore } from '../../../../store/recommendationStore'
import { useNavStore } from '../../../../store/navStore'
import type { RecommendationResponse } from '../../../../types/recommendation.types'

// Mock the hook - this avoids needing to mock axios/network
vi.mock('../../hooks/useRecommendations', () => ({
  useRecommendations: vi.fn(),
}))

// Import the mocked hook so we can control its return value per test
import { useRecommendations } from '../../hooks/useRecommendations'
const mockUseRecommendations = vi.mocked(useRecommendations)

const fakeRec: RecommendationResponse = {
  spot: {
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
  },
  score: 72.5,
  score_breakdown: {
    cost: 20,
    distance: 22.5,
    travel_time: 15,
    preferences: 15,
    major: 10,
    verified: 5,
    event: 0,
  },
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RecommendationList integration', () => {
  beforeEach(() => {
    // Authenticate the user so the list doesn't show the "sign in" message
    useAuthStore.setState({ isAuthenticated: true, user: { user_id: 1, first_name: 'Test', last_name: 'User', is_admin: false } as never })
    useUIStore.setState({
      ...useUIStore.getState(),
      verifiedOnly: false,
      directionsOnly: false,
      isOffline: false,
    })
    useRecommendationStore.setState({ cachedRecommendations: [] })
    useNavStore.setState(useNavStore.getInitialState())
  })

  it('shows sign-in prompt when not authenticated', () => {
    useAuthStore.setState({ isAuthenticated: false, user: null })
    mockUseRecommendations.mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })
    expect(screen.getByText(/sign in for personalized/i)).toBeInTheDocument()
  })

  it('shows loading skeleton while data is fetching', () => {
    mockUseRecommendations.mockReturnValue({ data: undefined, isLoading: true, isError: false } as never)

    const { container } = render(<RecommendationList />, { wrapper: Wrapper })
    // LoadingSkeleton should render animated placeholder elements
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error state on API failure', () => {
    mockUseRecommendations.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never)

    render(<RecommendationList />, { wrapper: Wrapper })
    expect(screen.getByText(/error loading recommendations/i)).toBeInTheDocument()
  })

  it('renders recommendation cards when data loads', () => {
    mockUseRecommendations.mockReturnValue({ data: [fakeRec], isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })
    expect(screen.getByText('Oak Street Ramp')).toBeInTheDocument()
  })

  it('shows empty state when no spots found', () => {
    mockUseRecommendations.mockReturnValue({ data: [], isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })
    expect(screen.getByText(/no spots found nearby/i)).toBeInTheDocument()
  })

  it('renders correct price label for a $2.50 spot', () => {
    mockUseRecommendations.mockReturnValue({ data: [fakeRec], isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })
    expect(screen.getByText('$2.50/hr')).toBeInTheDocument()
  })

  it('renders "Free" label for zero-cost spot', () => {
    const freeRec = { ...fakeRec, spot: { ...fakeRec.spot, cost: 0 } }
    mockUseRecommendations.mockReturnValue({ data: [freeRec], isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('pins the remembered parking spot at the top when available', () => {
    useNavStore.setState({
      rememberedSpot: {
        ...fakeRec.spot,
        spot_id: 999,
        spot_name: 'Remembered Spot',
      },
    })
    mockUseRecommendations.mockReturnValue({ data: [fakeRec], isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })

    expect(screen.getByText(/remembered parking spot/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /navigate to remembered spot/i })).toBeInTheDocument()
  })

  it('filters out spots without directions when enabled in settings', () => {
    const brokenRec = {
      ...fakeRec,
      spot: {
        ...fakeRec.spot,
        spot_id: 2,
        spot_name: 'Broken Spot',
        latitude: null,
        longitude: null,
      },
    }

    useUIStore.setState({
      ...useUIStore.getState(),
      directionsOnly: true,
    })
    mockUseRecommendations.mockReturnValue({ data: [fakeRec, brokenRec], isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })

    expect(screen.getByText('Oak Street Ramp')).toBeInTheDocument()
    expect(screen.queryByText('Broken Spot')).not.toBeInTheDocument()
    expect(screen.getByText('Directions')).toBeInTheDocument()
  })

  // ── Offline fallback behaviour ────────────────────────────────────────────

  it('shows cached data when offline even if the query has not errored yet', () => {
    // Simulate offline + no query error (TanStack may serve stale in-memory data)
    useUIStore.setState({ ...useUIStore.getState(), isOffline: true })
    useRecommendationStore.setState({ cachedRecommendations: [fakeRec] })
    // Query returns undefined (pending/stale) - no error
    mockUseRecommendations.mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })

    expect(screen.getByText('Oak Street Ramp')).toBeInTheDocument()
  })

  it('shows the offline notice banner when offline with cached data', () => {
    useUIStore.setState({ ...useUIStore.getState(), isOffline: true })
    useRecommendationStore.setState({ cachedRecommendations: [fakeRec] })
    mockUseRecommendations.mockReturnValue({ data: undefined, isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })

    expect(screen.getByText(/you're offline/i)).toBeInTheDocument()
  })

  it('shows cached data when online but the query fails', () => {
    useUIStore.setState({ ...useUIStore.getState(), isOffline: false })
    useRecommendationStore.setState({ cachedRecommendations: [fakeRec] })
    mockUseRecommendations.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never)

    render(<RecommendationList />, { wrapper: Wrapper })

    expect(screen.getByText('Oak Street Ramp')).toBeInTheDocument()
  })

  it('shows the error state when online, query fails, and no cache exists', () => {
    useUIStore.setState({ ...useUIStore.getState(), isOffline: false })
    useRecommendationStore.setState({ cachedRecommendations: [] })
    mockUseRecommendations.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never)

    render(<RecommendationList />, { wrapper: Wrapper })

    expect(screen.getByText(/error loading recommendations/i)).toBeInTheDocument()
  })

  it('does not show the offline notice when online even with cached data', () => {
    useUIStore.setState({ ...useUIStore.getState(), isOffline: false })
    useRecommendationStore.setState({ cachedRecommendations: [fakeRec] })
    mockUseRecommendations.mockReturnValue({ data: [fakeRec], isLoading: false, isError: false } as never)

    render(<RecommendationList />, { wrapper: Wrapper })

    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument()
  })
})
