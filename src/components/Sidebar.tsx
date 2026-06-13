import { useMemo, useState } from 'react'
import { useAppStore } from '../store'
import { ALL_CATS, CAT_STYLE, mapCategory, type CatKey } from '../categories'
import { presetCutoff } from '../hooks/useFilteredCheckins'
import type { DatePreset } from '../types'

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'thisYear', label: 'This year' },
  { key: '365d', label: 'Last year' },
  { key: 'all', label: 'All time' },
]

const CITY_INITIAL_LIMIT = 10

export default function Sidebar() {
  const checkins = useAppStore(s => s.checkins)
  const filters = useAppStore(s => s.filters)
  const setFilters = useAppStore(s => s.setFilters)
  const clearFilters = useAppStore(s => s.clearFilters)
  const [showAllCities, setShowAllCities] = useState(false)

  // Period counts use the full history (so a user can see what each preset would
  // yield), but Place and Category counts are scoped to the active date preset
  // so users only see cities/categories that exist within the chosen window.
  const dateScoped = useMemo(() => {
    const cutoff = presetCutoff(filters.datePreset)
    if (cutoff == null) return checkins
    return checkins.filter(c => c.checked_in_at >= cutoff)
  }, [checkins, filters.datePreset])

  const cities = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of dateScoped) {
      if (c.venue_city) m.set(c.venue_city, (m.get(c.venue_city) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([city, count]) => ({ city, count }))
  }, [dateScoped])

  const stats = useMemo(() => {
    const byCat: Partial<Record<CatKey, number>> = {}
    const byPreset: Record<DatePreset, number> = { '30d': 0, '90d': 0, 'thisYear': 0, '365d': 0, 'all': 0 }
    const now = Date.now()
    const presetKeys = (Object.keys(byPreset) as DatePreset[]).filter(k => k !== 'all')
    const cutoffs = Object.fromEntries(
      presetKeys.map(k => [k, presetCutoff(k, now)!]),
    ) as Record<Exclude<DatePreset, 'all'>, number>
    // Period counts scan the full set (we need to know what each window would show)
    for (const c of checkins) {
      byPreset.all += 1
      for (const k of presetKeys) {
        if (cutoffs[k as Exclude<DatePreset, 'all'>] <= c.checked_in_at) byPreset[k] += 1
      }
    }
    // Category counts are scoped to the active period
    for (const c of dateScoped) {
      const cat = mapCategory(c.venue_category)
      byCat[cat] = (byCat[cat] ?? 0) + 1
    }
    return { byCat, byPreset }
  }, [checkins, dateScoped])

  const activePresetLabel = DATE_PRESETS.find(p => p.key === filters.datePreset)?.label ?? 'this period'
  const categoriesInScope = ALL_CATS.filter(k => (stats.byCat[k] ?? 0) > 0)

  function setDatePreset(p: DatePreset) {
    setFilters({ ...filters, datePreset: p })
  }
  function setCity(city: string | null) {
    setFilters({ ...filters, city })
  }
  function toggleCat(k: CatKey) {
    const next = new Set(filters.cats)
    if (next.has(k)) next.delete(k); else next.add(k)
    setFilters({ ...filters, cats: next })
  }

  const visibleCities = showAllCities ? cities : cities.slice(0, CITY_INITIAL_LIMIT)
  const hasMoreCities = cities.length > CITY_INITIAL_LIMIT

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'var(--surface)', borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', height: '100%',
      overflowY: 'auto', padding: '28px 22px 28px', gap: 28,
    }}>
      <SideSection label="Period">
        {DATE_PRESETS.map(p => (
          <RadioItem
            key={p.key}
            label={p.label}
            count={stats.byPreset[p.key]}
            selected={filters.datePreset === p.key}
            onClick={() => setDatePreset(p.key)}
          />
        ))}
      </SideSection>

      <SideSection label="Place">
        <RadioItem
          label="All cities"
          count={dateScoped.length}
          selected={filters.city === null}
          onClick={() => setCity(null)}
        />
        {cities.length === 0 ? (
          <EmptyHint>No cities in {activePresetLabel.toLowerCase()}.</EmptyHint>
        ) : (
          <>
            {visibleCities.map(({ city, count }) => (
              <RadioItem
                key={city}
                label={city}
                count={count}
                selected={filters.city === city}
                onClick={() => setCity(city)}
              />
            ))}
            {hasMoreCities && (
              <button
                onClick={() => setShowAllCities(v => !v)}
                style={{
                  fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 500,
                  color: 'var(--accent)', background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left', padding: '8px 0 4px',
                }}
              >
                {showAllCities ? `Show top ${CITY_INITIAL_LIMIT}` : `Show all ${cities.length} cities`}
              </button>
            )}
          </>
        )}
      </SideSection>

      <SideSection label="Category">
        {categoriesInScope.length === 0 ? (
          <EmptyHint>No check-ins in {activePresetLabel.toLowerCase()}.</EmptyHint>
        ) : (
          ALL_CATS.map(key => {
            const c = CAT_STYLE[key]
            const on = filters.cats.has(key)
            const count = stats.byCat[key] ?? 0
            const muted = count === 0
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 0', borderBottom: '1px solid var(--line-2)',
                opacity: muted ? 0.45 : 1,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, fontFamily: 'var(--sans)', fontWeight: 400, color: on ? 'var(--ink)' : 'var(--ink-3)' }}>
                  {c.label}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginRight: 8 }}>{count}</span>
                <MiniSwitch on={on} color={c.dot} onChange={() => toggleCat(key)} />
              </div>
            )
          })
        )}
      </SideSection>

      <button onClick={clearFilters} style={{
        fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left', padding: 0, marginTop: -10,
      }}>Reset filters</button>
    </aside>
  )
}

function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontWeight: 500,
        paddingBottom: 8, borderBottom: '1px solid var(--line-2)', marginBottom: 6,
      }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  )
}

function RadioItem({ label, selected, onClick, count }: { label: string; selected: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 0', background: 'transparent', border: 'none',
      cursor: 'pointer', textAlign: 'left', width: '100%',
      borderBottom: '1px solid var(--line-2)',
    }}>
      <span style={{
        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
        border: selected ? '4px solid var(--accent)' : '1.5px solid var(--line)',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        transition: 'all 120ms ease',
      }} />
      <span style={{
        flex: 1, fontSize: 12.5, fontFamily: 'var(--sans)',
        fontWeight: selected ? 600 : 400,
        color: selected ? 'var(--ink)' : 'var(--ink-2)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</span>
      {count != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>{count}</span>}
    </button>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--ink-3)',
      lineHeight: 1.5, padding: '8px 0 2px',
    }}>
      {children}
    </div>
  )
}

function MiniSwitch({ on, color, onChange }: { on: boolean; color: string; onChange: () => void }) {
  return (
    <button onClick={onChange} type="button" style={{
      width: 30, height: 17, borderRadius: 999, padding: 0,
      background: on ? color : 'var(--line)',
      border: 'none', position: 'relative', cursor: 'pointer',
      transition: 'background 140ms ease', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 15 : 2,
        width: 13, height: 13, borderRadius: '50%', background: 'white',
        boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
        transition: 'left 150ms ease',
      }} />
    </button>
  )
}

