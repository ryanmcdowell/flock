import { useMemo } from 'react'
import { useAppStore } from '../store'
import type { CheckIn, Filters } from '../types'

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
  if (filters.dateRange.start !== null) {
    result = result.filter(c => c.checked_in_at >= filters.dateRange.start!)
  }
  if (filters.dateRange.end !== null) {
    result = result.filter(c => c.checked_in_at <= filters.dateRange.end!)
  }
  return result
}

export function useFilteredCheckins(): CheckIn[] {
  const checkins = useAppStore(s => s.checkins)
  const query = useAppStore(s => s.searchQuery)
  const filters = useAppStore(s => s.filters)
  return useMemo(() => filterCheckins(checkins, query, filters), [checkins, query, filters])
}
