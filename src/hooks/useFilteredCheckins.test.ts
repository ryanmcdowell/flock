import { describe, it, expect } from 'vitest'
import { filterCheckins } from './useFilteredCheckins'
import type { CheckIn } from '../types'

const ci = (id: string, name: string, city: string, ts: number, note?: string): CheckIn => ({
  id, venue_id: null, venue_name: name, venue_address: null, venue_city: city,
  venue_country: null, venue_category: null, lat: null, lng: null,
  checked_in_at: ts, note: note ?? null, swarm_url: null,
})

describe('filterCheckins', () => {
  const checkins = [
    ci('1', 'Blue Bottle', 'San Francisco', 1000),
    ci('2', 'Tartine', 'San Francisco', 2000, 'great croissants'),
    ci('3', 'Russ & Daughters', 'New York', 3000),
  ]

  it('filters by search query on venue name', () => {
    const result = filterCheckins(checkins, 'blue', { dateRange: { start: null, end: null }, city: null })
    expect(result.map(c => c.id)).toEqual(['1'])
  })

  it('filters by search query on note', () => {
    const result = filterCheckins(checkins, 'croissant', { dateRange: { start: null, end: null }, city: null })
    expect(result.map(c => c.id)).toEqual(['2'])
  })

  it('filters by city', () => {
    const result = filterCheckins(checkins, '', { dateRange: { start: null, end: null }, city: 'New York' })
    expect(result.map(c => c.id)).toEqual(['3'])
  })

  it('filters by date range', () => {
    const result = filterCheckins(checkins, '', { dateRange: { start: 1500, end: 2500 }, city: null })
    expect(result.map(c => c.id)).toEqual(['2'])
  })

  it('returns all when no filters', () => {
    expect(filterCheckins(checkins, '', { dateRange: { start: null, end: null }, city: null })).toHaveLength(3)
  })
})
