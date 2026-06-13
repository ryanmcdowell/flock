import { useAppStore } from '../store'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'
import { ALL_CATS } from '../categories'
import type { DatePreset } from '../types'

const PRESET_LABEL: Record<DatePreset, string> = {
  'all': 'All time',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  'thisYear': 'This year',
  '365d': 'Last year',
}

export default function FilterBar() {
  const checkins = useAppStore(s => s.checkins)
  const filtered = useFilteredCheckins()
  const filters = useAppStore(s => s.filters)
  const setFilters = useAppStore(s => s.setFilters)
  const query = useAppStore(s => s.searchQuery)
  const setSearchQuery = useAppStore(s => s.setSearchQuery)

  const chips: { key: string; label: string; value: string; onRemove: () => void }[] = []
  if (filters.datePreset !== 'all') {
    chips.push({
      key: 'date', label: 'Period', value: PRESET_LABEL[filters.datePreset],
      onRemove: () => setFilters({ ...filters, datePreset: 'all' }),
    })
  }
  if (filters.city) {
    chips.push({
      key: 'city', label: 'City', value: filters.city,
      onRemove: () => setFilters({ ...filters, city: null }),
    })
  }
  if (filters.cats.size < ALL_CATS.length) {
    chips.push({
      key: 'cats', label: 'Categories', value: `${filters.cats.size} active`,
      onRemove: () => setFilters({ ...filters, cats: new Set(ALL_CATS) }),
    })
  }
  if (query) {
    chips.push({
      key: 'q', label: 'Search', value: `“${query}”`,
      onRemove: () => setSearchQuery(''),
    })
  }

  if (chips.length === 0 && filtered.length === checkins.length) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '8px 22px', borderBottom: '1px solid var(--line-2)',
      background: 'var(--surface)', minHeight: 40, flexShrink: 0,
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
        {filtered.length} / {checkins.length}
      </span>
      {chips.map(chip => (
        <button key={chip.key} onClick={chip.onRemove} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px 2px 9px', borderRadius: 999,
          background: 'transparent', border: '1px solid var(--line)',
          fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--sans)', cursor: 'pointer',
        }}>
          <span style={{ color: 'var(--ink-3)' }}>{chip.label}:</span>
          <span>{chip.value}</span>
          <span style={{ color: 'var(--ink-3)', marginLeft: 1 }}>×</span>
        </button>
      ))}
    </div>
  )
}
