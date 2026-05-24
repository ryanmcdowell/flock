import { useMemo } from 'react'
import { useAppStore } from '../store'

interface Props { onClose: () => void }

const now = () => Math.floor(Date.now() / 1000)

const PRESETS: { label: string; getRange: () => { start: number | null; end: number | null } }[] = [
  { label: 'Last 30 days', getRange: () => ({ start: now() - 30 * 86400, end: now() }) },
  { label: 'Last year',    getRange: () => ({ start: now() - 365 * 86400, end: now() }) },
  { label: 'All time',     getRange: () => ({ start: null, end: null }) },
]

export default function FilterPanel({ onClose }: Props) {
  const { checkins, filters, setFilters, clearFilters } = useAppStore()

  const cities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of checkins) {
      if (c.venue_city) counts.set(c.venue_city, (counts.get(c.venue_city) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,20).map(([city]) => city)
  }, [checkins])

  function applyPreset(getRange: () => { start: number | null; end: number | null }) {
    const range = getRange()
    if (range.start === null && range.end === null) {
      clearFilters()
    } else {
      setFilters({ ...filters, dateRange: range })
    }
    onClose()
  }

  function applyCity(city: string) {
    setFilters({ ...filters, city: filters.city === city ? null : city })
    onClose()
  }

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, marginTop: '4px',
      background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)',
      borderRadius: '8px', padding: '12px', minWidth: '220px', zIndex: 200,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: '8px' }}>
        Date range
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p.getRange)}
            style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', cursor: 'pointer',
              border: '1px solid var(--color-border, #e5e7eb)',
              background: 'var(--color-surface, #fff)' }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: '8px' }}>
        City
      </div>
      <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {cities.map(city => (
          <button key={city} onClick={() => applyCity(city)}
            style={{ textAlign: 'left', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer',
              border: 'none', background: filters.city === city ? '#FEF3C7' : 'transparent',
              color: filters.city === city ? '#92400E' : 'inherit' }}>
            {city}
          </button>
        ))}
      </div>
    </div>
  )
}
