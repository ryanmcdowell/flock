import { invoke } from '@tauri-apps/api/core'
import { useMemo } from 'react'
import { useAppStore } from '../store'
import { ALL_CATS, CAT_STYLE, mapCategory, type CatKey } from '../categories'
import { presetCutoff } from '../hooks/useFilteredCheckins'
import type { DatePreset } from '../types'

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: '365d', label: 'Last year' },
  { key: 'all', label: 'All time' },
]

export default function Sidebar() {
  const checkins = useAppStore(s => s.checkins)
  const filters = useAppStore(s => s.filters)
  const setFilters = useAppStore(s => s.setFilters)
  const clearFilters = useAppStore(s => s.clearFilters)

  const cities = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of checkins) {
      if (c.venue_city) m.set(c.venue_city, (m.get(c.venue_city) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([city, count]) => ({ city, count }))
  }, [checkins])

  const stats = useMemo(() => {
    const byCity: Record<string, number> = {}
    const byCat: Partial<Record<CatKey, number>> = {}
    const byPreset: Record<DatePreset, number> = { '30d': 0, '90d': 0, '365d': 0, 'all': 0 }
    const now = Date.now()
    const cutoffs: Record<DatePreset, number | null> = {
      '30d': presetCutoff('30d', now),
      '90d': presetCutoff('90d', now),
      '365d': presetCutoff('365d', now),
      'all': null,
    }
    for (const c of checkins) {
      if (c.venue_city) byCity[c.venue_city] = (byCity[c.venue_city] ?? 0) + 1
      const cat = mapCategory(c.venue_category)
      byCat[cat] = (byCat[cat] ?? 0) + 1
      byPreset.all += 1
      if (cutoffs['30d']! <= c.checked_in_at) byPreset['30d'] += 1
      if (cutoffs['90d']! <= c.checked_in_at) byPreset['90d'] += 1
      if (cutoffs['365d']! <= c.checked_in_at) byPreset['365d'] += 1
    }
    return { byCity, byCat, byPreset }
  }, [checkins])

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

  function handleSignOut() {
    invoke('sign_out').then(() => {
      useAppStore.getState().setCheckins([])
      useAppStore.getState().setAppView('connect')
    }).catch(console.error)
  }

  return (
    <aside style={{
      width: 240, flexShrink: 0, padding: '28px 22px 20px',
      background: 'var(--surface)', borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', gap: 28, overflowY: 'auto',
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
          count={checkins.length}
          selected={filters.city === null}
          onClick={() => setCity(null)}
        />
        {cities.map(({ city, count }) => (
          <RadioItem
            key={city}
            label={city}
            count={count}
            selected={filters.city === city}
            onClick={() => setCity(city)}
          />
        ))}
      </SideSection>

      <SideSection label="Category">
        {ALL_CATS.map(key => {
          const c = CAT_STYLE[key]
          const on = filters.cats.has(key)
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 0', borderBottom: '1px solid var(--line-2)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, fontFamily: 'var(--sans)', fontWeight: 400, color: on ? 'var(--ink)' : 'var(--ink-3)' }}>
                {c.label}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginRight: 8 }}>{stats.byCat[key] ?? 0}</span>
              <MiniSwitch on={on} color={c.dot} onChange={() => toggleCat(key)} />
            </div>
          )
        })}
      </SideSection>

      <div style={{ flex: 1 }} />
      <button onClick={clearFilters} style={{
        fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}>Reset filters</button>

      <Account onSignOut={handleSignOut} />
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

function Account({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)',
        color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, fontFamily: 'var(--sans)', letterSpacing: 0.5,
      }}>SW</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Connected
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'oklch(0.62 0.12 140)' }}>foursquare · OAuth</div>
      </div>
      <button onClick={onSignOut} style={{
        background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 2, fontSize: 13,
      }} title="Sign out">⏻</button>
    </div>
  )
}
