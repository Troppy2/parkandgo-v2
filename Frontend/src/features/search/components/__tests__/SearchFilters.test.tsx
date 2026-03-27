import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchFilters from '../SearchFilters'
import type { SpotFilters } from '../../../../types/parking.types'

const emptyFilters: SpotFilters = {}

describe('SearchFilters', () => {
  it('renders parking type and campus chips', () => {
    render(
      <SearchFilters filters={emptyFilters} onChange={vi.fn()} isOpen={true} />
    )
    expect(screen.getByText('Parking Garage')).toBeInTheDocument()
    expect(screen.getByText('Surface Lot')).toBeInTheDocument()
    expect(screen.getByText('Street Parking')).toBeInTheDocument()
    expect(screen.getByText('East Bank')).toBeInTheDocument()
    expect(screen.getByText('West Bank')).toBeInTheDocument()
    expect(screen.getByText('St. Paul')).toBeInTheDocument()
  })

  it('calls onChange when a parking type chip is clicked', () => {
    const onChange = vi.fn()
    render(
      <SearchFilters filters={emptyFilters} onChange={onChange} isOpen={true} />
    )
    fireEvent.click(screen.getByText('Parking Garage'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ parking_type: 'Parking Garage' })
    )
  })

  it('toggles off a selected parking type', () => {
    const onChange = vi.fn()
    const activeFilters: SpotFilters = { parking_type: 'Parking Garage' }
    render(
      <SearchFilters filters={activeFilters} onChange={onChange} isOpen={true} />
    )
    fireEvent.click(screen.getByText('Parking Garage'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ parking_type: undefined })
    )
  })

  it('calls onChange when a campus chip is clicked', () => {
    const onChange = vi.fn()
    render(
      <SearchFilters filters={emptyFilters} onChange={onChange} isOpen={true} />
    )
    fireEvent.click(screen.getByText('East Bank'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ campus_location: 'East Bank' })
    )
  })

  it('shows Reset Filters button when filters are active', () => {
    const onChange = vi.fn()
    const activeFilters: SpotFilters = { parking_type: 'Surface Lot' }
    render(
      <SearchFilters filters={activeFilters} onChange={onChange} isOpen={true} />
    )
    expect(screen.getByText('Reset Filters')).toBeInTheDocument()
  })

  it('does not show Reset Filters when no filters active', () => {
    render(
      <SearchFilters filters={emptyFilters} onChange={vi.fn()} isOpen={true} />
    )
    expect(screen.queryByText('Reset Filters')).not.toBeInTheDocument()
  })

  it('reset clears all filters', () => {
    const onChange = vi.fn()
    const activeFilters: SpotFilters = { parking_type: 'Surface Lot', campus_location: 'East Bank' }
    render(
      <SearchFilters filters={activeFilters} onChange={onChange} isOpen={true} />
    )
    fireEvent.click(screen.getByText('Reset Filters'))
    expect(onChange).toHaveBeenCalledWith({
      parking_type: undefined,
      campus_location: undefined,
      max_cost: undefined,
      verified_only: undefined,
    })
  })

  it('displays "Any" when cost slider is at max', () => {
    render(
      <SearchFilters filters={emptyFilters} onChange={vi.fn()} isOpen={true} sliderMax={20} />
    )
    expect(screen.getByText('Any')).toBeInTheDocument()
  })
})
