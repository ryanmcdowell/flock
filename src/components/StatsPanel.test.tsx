import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import StatsPanel from './StatsPanel'
import { useAppStore } from '../store'
import type { CheckIn } from '../types'

const ci = (id: string, city: string, vid: string, ts: number): CheckIn => ({
  id, venue_id: vid, venue_name: 'P', venue_address: null, venue_city: city,
  venue_country: null, venue_category: null, lat: null, lng: null,
  checked_in_at: ts, note: null, swarm_url: null,
})

describe('StatsPanel', () => {
  beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

  it('shows total check-in count', () => {
    useAppStore.setState({ checkins: [ci('1','SF','v1',1000), ci('2','NYC','v2',2000)] })
    render(<StatsPanel />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows top city', () => {
    useAppStore.setState({ checkins: [ci('1','SF','v1',1000), ci('2','SF','v2',2000), ci('3','NYC','v3',3000)] })
    render(<StatsPanel />)
    expect(screen.getByText('SF')).toBeInTheDocument()
  })
})
