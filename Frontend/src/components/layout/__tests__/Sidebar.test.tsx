import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Sidebar from '../Sidebar'
import { useAuthStore } from '../../../store/authStore'
import { useUIStore } from '../../../store/uiStore'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('../../../store/uiStore', () => ({
  useUIStore: vi.fn(),
}))

vi.mock('../../../features/search/hooks/useDebouncedSearch', () => ({
  useDebouncedSearch: () => ({ data: [], isLoading: false }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('../../../features/search/components/SearchBar', () => ({
  default: () => <div data-testid="search-bar" />,
}))

vi.mock('../../../features/events/components/EventList', () => ({
  default: () => <div data-testid="event-list" />,
}))

vi.mock('../../../features/search/components/SearchResults', () => ({
  default: () => <div data-testid="search-results" />,
}))

// ── Typed mock helpers ─────────────────────────────────────────────────────

const mockAuthStore = vi.mocked(useAuthStore)
const mockUIStore = vi.mocked(useUIStore)

// Minimal store shapes needed for these tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySelector = (s: any) => any

function setupStores({
  isGuest = true,
  activeTab = 'spots' as 'spots' | 'events',
  verifiedOnly = false,
  directionsOnly = false,
} = {}) {
  const authState = { user: null, isGuest }
  const uiState = {
    activeTab,
    setActiveTab: vi.fn(),
    mapInstance: null,
    verifiedOnly,
    directionsOnly,
  }
  mockAuthStore.mockImplementation((sel: AnySelector) => sel(authState))
  mockUIStore.mockImplementation((sel: AnySelector) => sel(uiState))
}

// ── Default render helper ──────────────────────────────────────────────────

function renderSidebar() {
  return render(
    <Sidebar
      isCollapsed={false}
      onToggleCollapse={vi.fn()}
      onSettingsClick={vi.fn()}
      onSuggestSpotClick={vi.fn()}
    >
      <div data-testid="children" />
    </Sidebar>
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Sidebar filter collapse', () => {
  beforeEach(() => {
    setupStores()
  })

  it('renders a toggle button for the filter section on the spots tab', () => {
    renderSidebar()
    expect(
      screen.getByRole('button', { name: /toggle filters/i })
    ).toBeInTheDocument()
  })

  it('has filters expanded (aria-expanded=true) by default', () => {
    renderSidebar()
    const btn = screen.getByRole('button', { name: /toggle filters/i })
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })

  it('collapses the filter section on first click (aria-expanded=false)', () => {
    renderSidebar()
    const btn = screen.getByRole('button', { name: /toggle filters/i })
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('re-expands the filter section on second click (aria-expanded=true)', () => {
    renderSidebar()
    const btn = screen.getByRole('button', { name: /toggle filters/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })

  it('does NOT render the filter toggle on the events tab', () => {
    setupStores({ activeTab: 'events' })
    renderSidebar()
    expect(
      screen.queryByRole('button', { name: /toggle filters/i })
    ).not.toBeInTheDocument()
  })
})
