import { useMemo } from 'react'
import { useAppStore } from '../store'
import { mapCategory } from '../categories'
import type { CheckIn, Filters, DatePreset } from '../types'

export function presetCutoff(preset: DatePreset, now = Date.now()): number | null {
  switch (preset) {
    case 'all':
      return null
    case '30d':
      return Math.floor(now / 1000) - 30 * 86400
    case '90d':
      return Math.floor(now / 1000) - 90 * 86400
    case '365d':
      return Math.floor(now / 1000) - 365 * 86400
    case 'thisYear': {
      const d = new Date(now)
      d.setMonth(0, 1)
      d.setHours(0, 0, 0, 0)
      return Math.floor(d.getTime() / 1000)
    }
  }
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
