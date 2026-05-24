import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import FilterPanel from './FilterPanel'
import { useAppStore } from '../store'

describe('FilterPanel', () => {
  beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

  it('sets last 30 days preset', () => {
    render(<FilterPanel onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /last 30 days/i }))
    const { filters } = useAppStore.getState()
    expect(filters.dateRange.start).not.toBeNull()
    expect(filters.dateRange.end).not.toBeNull()
  })

  it('sets city filter', () => {
    useAppStore.setState({ checkins: [
      { id:'1', venue_id:null, venue_name:'A', venue_address:null, venue_city:'San Francisco',
        venue_country:null, venue_category:null, lat:null, lng:null, checked_in_at:1000, note:null, swarm_url:null }
    ]})
    render(<FilterPanel onClose={() => {}} />)
    fireEvent.click(screen.getByText('San Francisco'))
    expect(useAppStore.getState().filters.city).toBe('San Francisco')
  })

  it('clears all filters', () => {
    useAppStore.setState({ filters: { dateRange: { start: 1, end: 2 }, city: 'SF' } })
    render(<FilterPanel onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /all time/i }))
    const { filters } = useAppStore.getState()
    expect(filters.city).toBeNull()
    expect(filters.dateRange.start).toBeNull()
  })
})
