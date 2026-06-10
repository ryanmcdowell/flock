import { invoke } from '@tauri-apps/api/core'
import { useMemo, useState } from 'react'
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

const CITY_INITIAL_LIMIT = 10

export default function Sidebar() {
  const checkins = useAppStore(s => s.checkins)
  const panelView = useAppStore(s => s.panelView)
  const filters = useAppStore(s => s.filters)
  const setFilters = useAppStore(s => s.setFilters)
  const clearFilters = useAppStore(s => s.clearFilters)
  const userProfile = useAppStore(s => s.userProfile)
  const [showAllCities, setShowAllCities] = useState(false)

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
      useAppStore.getState().setUserProfile(null)
      useAppStore.getState().setAppView('connect')
    }).catch(console.error)
  }

  const showFilters = panelView !== 'stats'
  const visibleCities = showAllCities ? cities : cities.slice(0, CITY_INITIAL_LIMIT)
  const hasMoreCities = cities.length > CITY_INITIAL_LIMIT

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'var(--surface)', borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Scrollable upper area */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: '28px 22px 14px', display: 'flex', flexDirection: 'column', gap: 28,
      }}>
        {showFilters ? (
          <>
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

            <button onClick={clearFilters} style={{
              fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              textAlign: 'left', padding: 0, marginTop: -10,
            }}>Reset filters</button>
          </>
        ) : (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
            letterSpacing: 0.6, lineHeight: 1.6,
          }}>
            All-time analytics<br />
            Filters are paused on this tab.
          </div>
        )}
      </div>

      {/* Sticky Account block */}
      <div style={{
        flexShrink: 0,
        padding: '12px 22px 18px',
        borderTop: '1px solid var(--line-2)',
        background: 'var(--surface)',
      }}>
        <Account profile={userProfile} onSignOut={handleSignOut} />
      </div>
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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function Account({ profile, onSignOut }: { profile: { name: string; photo_url: string | null } | null; onSignOut: () => void }) {
  const initials = profile ? initialsOf(profile.name) : 'SW'
  const displayName = profile?.name ?? 'Connected'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {profile?.photo_url ? (
        <img
          src={profile.photo_url}
          alt={profile.name}
          width={28} height={28}
          referrerPolicy="no-referrer"
          style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover', background: 'var(--accent-soft)' }}
        />
      ) : (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--sans)', letterSpacing: 0.5,
          flexShrink: 0,
        }}>{initials}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayName}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'oklch(0.62 0.12 140)' }}>foursquare · connected</div>
      </div>
      <button onClick={onSignOut} style={{
        background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 2, fontSize: 13,
      }} title="Sign out">⏻</button>
    </div>
  )
}
