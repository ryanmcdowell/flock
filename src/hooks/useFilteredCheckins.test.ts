import { describe, it, expect } from 'vitest'
import { filterCheckins } from './useFilteredCheckins'
import { ALL_CATS } from '../categories'
import type { CheckIn, Filters } from '../types'

const ci = (id: string, name: string, city: string, ts: number, note: string | null = null, category: string | null = null): CheckIn => ({
  id, venue_id: null, venue_name: name, venue_address: null, venue_city: city,
  venue_country: null, venue_category: category, lat: null, lng: null,
  checked_in_at: ts, note: note ?? null, swarm_url: null,
})

const NO_FILTERS: Filters = { datePreset: 'all', city: null, cats: new Set(ALL_CATS) }

describe('filterCheckins', () => {
  const checkins = [
    ci('1', 'Blue Bottle', 'San Francisco', 1000, null, 'Coffee Shop'),
    ci('2', 'Tartine', 'San Francisco', 2000, 'great croissants', 'Bakery'),
    ci('3', 'Russ & Daughters', 'New York', 3000, null, 'Deli'),
  ]

  it('filters by search query on venue name', () => {
    expect(filterCheckins(checkins, 'blue', NO_FILTERS).map(c => c.id)).toEqual(['1'])
  })

  it('filters by search query on note', () => {
    expect(filterCheckins(checkins, 'croissant', NO_FILTERS).map(c => c.id)).toEqual(['2'])
  })

  it('filters by city', () => {
    const result = filterCheckins(checkins, '', { ...NO_FILTERS, city: 'New York' })
    expect(result.map(c => c.id)).toEqual(['3'])
  })

  it('filters by category', () => {
    const result = filterCheckins(checkins, '', { ...NO_FILTERS, cats: new Set(['coffee']) })
    expect(result.map(c => c.id)).toEqual(['1'])
  })

  it('returns all when no filters', () => {
    expect(filterCheckins(checkins, '', NO_FILTERS)).toHaveLength(3)
  })
})
