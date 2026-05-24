import { useAppStore } from '../store'

export default function FilterChips() {
  const { filters, clearFilters, setFilters } = useAppStore()
  const chips: { label: string; onRemove: () => void }[] = []

  if (filters.city) {
    chips.push({ label: filters.city, onRemove: () => setFilters({ ...filters, city: null }) })
  }
  if (filters.dateRange.start || filters.dateRange.end) {
    chips.push({ label: 'Date range', onRemove: () => setFilters({ ...filters, dateRange: { start: null, end: null } }) })
  }

  if (chips.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {chips.map((chip) => (
        <span key={chip.label} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 8px', borderRadius: '12px', fontSize: '12px',
          background: '#FEF3C7', color: '#92400E',
        }}>
          {chip.label}
          <button onClick={chip.onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '12px', lineHeight: 1 }}>×</button>
        </span>
      ))}
      <button onClick={clearFilters} style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
        Clear all
      </button>
    </div>
  )
}
