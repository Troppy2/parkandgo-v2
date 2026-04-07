import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../uiStore'

describe('uiStore — offline state', () => {
  beforeEach(() => {
    useUIStore.setState({ isOffline: false })
  })

  it('starts online (isOffline = false)', () => {
    expect(useUIStore.getState().isOffline).toBe(false)
  })

  it('setOffline(true) marks the store as offline', () => {
    useUIStore.getState().setOffline(true)
    expect(useUIStore.getState().isOffline).toBe(true)
  })

  it('setOffline(false) marks the store as online again', () => {
    useUIStore.getState().setOffline(true)
    useUIStore.getState().setOffline(false)
    expect(useUIStore.getState().isOffline).toBe(false)
  })

  it('isOffline is not persisted to localStorage', () => {
    useUIStore.getState().setOffline(true)
    const stored = JSON.parse(localStorage.getItem('parkandgo-ui') ?? '{}')
    expect(stored?.state?.isOffline).toBeUndefined()
  })
})
