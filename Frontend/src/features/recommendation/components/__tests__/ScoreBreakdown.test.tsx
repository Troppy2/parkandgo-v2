import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScoreBreakdown from '../ScoreBreakdown'
import type { ScoreBreakdown as ScoreBreakdownType } from '../../../../types/recommendation.types'

const fullBreakdown: ScoreBreakdownType = {
  cost: 40,
  distance: 25,
  travel_time: 15,
  preferences: 15,
  major: 10,
  verified: 10,
  event: 15,
}

const partialBreakdown: ScoreBreakdownType = {
  cost: 20,
  distance: 12.5,
  travel_time: 10,
  preferences: 0,
  major: 0,
  verified: 10,
  event: 0,
}

describe('ScoreBreakdown', () => {
  it('renders all scoring category labels including travel time', () => {
    render(<ScoreBreakdown breakdown={fullBreakdown} />)
    expect(screen.getByText('Cost savings')).toBeInTheDocument()
    expect(screen.getByText('Distance to campus')).toBeInTheDocument()
    expect(screen.getByText('Travel time to spot')).toBeInTheDocument()
    expect(screen.getByText('Matches your preferences')).toBeInTheDocument()
    expect(screen.getByText('Near your major')).toBeInTheDocument()
    expect(screen.getByText('Community verified')).toBeInTheDocument()
    expect(screen.getByText('Near your event')).toBeInTheDocument()
  })

  it('shows correct point values with max', () => {
    render(<ScoreBreakdown breakdown={partialBreakdown} />)
    // Cost: 20 / 40 pts
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getAllByText('/ 40 pts').length).toBe(1)
  })

  it('calculates bar widths correctly at 100% for full scores', () => {
    const { container } = render(<ScoreBreakdown breakdown={fullBreakdown} />)
    // All bars should be 100% width when score equals max
    const bars = container.querySelectorAll('[style*="width"]')
    bars.forEach((bar) => {
      expect((bar as HTMLElement).style.width).toBe('100%')
    })
  })

  it('calculates bar width proportionally for partial scores', () => {
    const { container } = render(
      <ScoreBreakdown breakdown={{ ...fullBreakdown, cost: 20 }} />
    )
    // Cost bar: 20/40 = 50%
    const bars = container.querySelectorAll('[style*="width"]')
    expect((bars[0] as HTMLElement).style.width).toBe('50%')
  })

  it('clamps bar width at 0% when score is 0', () => {
    const zeroBreakdown: ScoreBreakdownType = {
      cost: 0, distance: 0, travel_time: 0, preferences: 0, major: 0, verified: 0, event: 0,
    }
    const { container } = render(<ScoreBreakdown breakdown={zeroBreakdown} />)
    const bars = container.querySelectorAll('[style*="width"]')
    bars.forEach((bar) => {
      expect((bar as HTMLElement).style.width).toBe('0%')
    })
  })
})
