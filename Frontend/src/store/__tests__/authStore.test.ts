import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../authStore'
import type { User } from '../../types/user.types'

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,
    })
  })

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })

  it('setAuth stores user and token', () => {
    const fakeUser = { user_id: 1, email: 'test@umn.edu' } as User
    useAuthStore.getState().setAuth(fakeUser, 'tok123', 'ref456')

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user?.user_id).toBe(1)
    expect(state.token).toBe('tok123')
    expect(state.isGuest).toBe(false)
    expect(localStorage.getItem('access_token')).toBe('tok123')
    expect(localStorage.getItem('refresh_token')).toBe('ref456')
  })

  it('setGuest sets guest mode without token', () => {
    useAuthStore.getState().setGuest()
    const state = useAuthStore.getState()
    expect(state.isGuest).toBe(true)
    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBeNull()
  })

  it('clearAuth removes user and localStorage tokens', () => {
    const fakeUser = { user_id: 1, email: 'test@umn.edu' } as User
    useAuthStore.getState().setAuth(fakeUser, 'tok123', 'ref456')
    useAuthStore.getState().clearAuth()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
