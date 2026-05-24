import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './index'
import { act } from '@testing-library/react'

describe('useAppStore', () => {
  beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

  it('sets search query', () => {
    act(() => useAppStore.getState().setSearchQuery('coffee'))
    expect(useAppStore.getState().searchQuery).toBe('coffee')
  })

  it('sets selected checkin', () => {
    act(() => useAppStore.getState().setSelectedCheckinId('abc123'))
    expect(useAppStore.getState().selectedCheckinId).toBe('abc123')
  })

  it('clears filters', () => {
    act(() => {
      useAppStore.getState().setFilters({ dateRange: { start: 100, end: 200 }, city: 'SF' })
      useAppStore.getState().clearFilters()
    })
    const { filters } = useAppStore.getState()
    expect(filters.city).toBeNull()
    expect(filters.dateRange.start).toBeNull()
  })
})
