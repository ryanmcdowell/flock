import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './index'
import { act } from '@testing-library/react'
import { ALL_CATS } from '../categories'

describe('useAppStore', () => {
  beforeEach(() => useAppStore.setState((useAppStore as any).getInitialState()))

  it('sets search query', () => {
    act(() => useAppStore.getState().setSearchQuery('coffee'))
    expect(useAppStore.getState().searchQuery).toBe('coffee')
  })

  it('sets selected checkin', () => {
    act(() => useAppStore.getState().setSelectedCheckinId('abc123'))
    expect(useAppStore.getState().selectedCheckinId).toBe('abc123')
  })

  it('clears filters and search', () => {
    act(() => {
      useAppStore.getState().setFilters({
        datePreset: '30d', city: 'SF', cats: new Set(['coffee']),
      })
      useAppStore.getState().setSearchQuery('blue bottle')
      useAppStore.getState().clearFilters()
    })
    const { filters, searchQuery } = useAppStore.getState()
    expect(filters.city).toBeNull()
    expect(filters.datePreset).toBe('all')
    expect(filters.cats.size).toBe(ALL_CATS.length)
    expect(searchQuery).toBe('')
  })
})
