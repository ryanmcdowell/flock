import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import TimelinePanel from './TimelinePanel'
import { useAppStore } from '../store'
import type { CheckIn } from '../types'

const ci = (id: string, name: string, city: string, ts: number): CheckIn => ({
  id, venue_id: null, venue_name: name, venue_address: null, venue_city: city,
  venue_country: null, venue_category: 'Cafe', lat: 37.7, lng: -122.4,
  checked_in_at: ts, note: 'nice', swarm_url: null,
})

describe('TimelinePanel', () => {
  beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

  it('renders venue names', () => {
    useAppStore.setState({ checkins: [ci('1', 'Blue Bottle', 'SF', 1_700_000_000)] })
    render(<TimelinePanel />)
    expect(screen.getByText('Blue Bottle')).toBeInTheDocument()
  })

  it('selects checkin on row click', () => {
    useAppStore.setState({ checkins: [ci('1', 'Tartine', 'SF', 1_700_000_000)] })
    render(<TimelinePanel />)
    fireEvent.click(screen.getByText('Tartine'))
    expect(useAppStore.getState().selectedCheckinId).toBe('1')
  })
})
