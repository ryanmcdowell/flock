import { useMemo } from 'react'
import { useAppStore } from '../store'
import { mapCategory } from '../categories'
import type { CheckIn, Filters, DatePreset } from '../types'

const PRESET_DAYS: Record<DatePreset, number | null> = {
  'all': null,
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

export function presetCutoff(preset: DatePreset, now = Date.now()): number | null {
  const days = PRESET_DAYS[preset]
  if (days == null) return null
  return Math.floor(now / 1000) - days * 86400
}

export function filterCheckins(checkins: CheckIn[], query: string, filters: Filters): CheckIn[] {
  let result = checkins
  if (query) {
    const q = query.toLowerCase()
    result = result.filter(c =>
      c.venue_name.toLowerCase().includes(q) ||
      c.venue_city?.toLowerCase().includes(q) ||
      c.note?.toLowerCase().includes(q)
    )
  }
  if (filters.city) {
    result = result.filter(c => c.venue_city === filters.city)
  }
  const cutoff = presetCutoff(filters.datePreset)
  if (cutoff !== null) {
    result = result.filter(c => c.checked_in_at >= cutoff)
  }
  if (filters.cats.size < 6) {
    result = result.filter(c => filters.cats.has(mapCategory(c.venue_category)))
  }
  return result
}

export function useFilteredCheckins(): CheckIn[] {
  const checkins = useAppStore(s => s.checkins)
  const query = useAppStore(s => s.searchQuery)
  const filters = useAppStore(s => s.filters)
  return useMemo(() => filterCheckins(checkins, query, filters), [checkins, query, filters])
}
