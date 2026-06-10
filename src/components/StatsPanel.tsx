import { useMemo, useState } from 'react'
import { useAppStore } from '../store'
import { CAT_STYLE, mapCategory, type CatKey } from '../categories'
import type { CheckIn } from '../types'

interface BarDatum { label: string; value: number; key: string }

function fmtMonthShort(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
function ymKey(ts: number) {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function computeStats(checkins: CheckIn[], all: CheckIn[]) {
  const sorted = [...checkins].sort((a, b) => a.checked_in_at - b.checked_in_at)
  const total = sorted.length
  const citySet = new Set(sorted.map(c => c.venue_city).filter(Boolean) as string[])
  const venueSet = new Set(sorted.map(c => c.venue_name))

  const monthMap = new Map<string, number>()
  for (const c of sorted) {
    const k = ymKey(c.checked_in_at)
    monthMap.set(k, (monthMap.get(k) ?? 0) + 1)
  }
  const byMonth: BarDatum[] = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({
      key: k, value: v,
      label: fmtMonthShort(Date.parse(`${k}-01`) / 1000),
    }))

  const yearMap = new Map<string, number>()
  for (const c of sorted) {
    const y = String(new Date(c.checked_in_at * 1000).getFullYear())
    yearMap.set(y, (yearMap.get(y) ?? 0) + 1)
  }
  const byYear: BarDatum[] = [...yearMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([y, v]) => ({ key: y, label: y, value: v }))

  const cityCount = new Map<string, number>()
  for (const c of sorted) {
    if (c.venue_city) cityCount.set(c.venue_city, (cityCount.get(c.venue_city) ?? 0) + 1)
  }
  const topCities = [...cityCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([full, count]) => ({ city: full.replace(/, [A-Z]{2}$/, ''), full, count }))

  const catCount: Partial<Record<CatKey, number>> = {}
  for (const c of sorted) {
    const k = mapCategory(c.venue_category)
    catCount[k] = (catCount[k] ?? 0) + 1
  }
  const byCategory = (Object.entries(catCount) as [CatKey, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ cat, count }))

  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = [0, 0, 0, 0, 0, 0, 0]
  for (const c of sorted) day[new Date(c.checked_in_at * 1000).getDay()] += 1
  const byDayOfWeek = dowLabels.map((label, i) => ({ label, value: day[i] }))

  return {
    total, cityCount: citySet.size, uniqueVenues: venueSet.size,
    byMonth, byYear, topCities, byCategory, byDayOfWeek,
    allLen: all.length,
  }
}

export default function StatsPanel() {
  // Analytics always reflects the full check-in history regardless of sidebar
  // filters so the numbers are stable.
  const all = useAppStore(s => s.checkins)
  const [granularity, setGranularity] = useState<'Monthly' | 'Yearly'>('Monthly')
  const stats = useMemo(() => computeStats(all, all), [all])

  const chartData = granularity === 'Monthly' ? stats.byMonth : stats.byYear

  // minWidth: 0 on grid children is what lets the inner overflow-x:auto
  // actually work (CSS grid children default to min-width:auto = content size).
  const gridChild: React.CSSProperties = { minWidth: 0 }

  return (
    <div style={{
      padding: '28px 32px', overflowY: 'auto', height: '100%',
      display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        <div style={gridChild}><StatCard label="Total check-ins" value={stats.total.toLocaleString()} /></div>
        <div style={gridChild}><StatCard label="Cities visited" value={stats.cityCount.toLocaleString()} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <div style={gridChild}>
          <ChartCard
            title="Check-ins over time"
            right={
              <SegControl
                opts={['Monthly', 'Yearly']}
                active={granularity}
                onChange={v => setGranularity(v as 'Monthly' | 'Yearly')}
              />
            }
          >
            <BarChart data={chartData} />
          </ChartCard>
        </div>

        <div style={{ ...gridChild, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ChartCard title="Top cities">
            <CityLeaderboard rows={stats.topCities} />
          </ChartCard>
          <ChartCard title="By category">
            <CategoryBreakdown rows={stats.byCategory} total={stats.total} />
          </ChartCard>
        </div>
      </div>

      <ChartCard title="Most active day of week">
        <DayOfWeekChart data={stats.byDayOfWeek} />
      </ChartCard>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px' }}>
      <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 36, fontWeight: 300, letterSpacing: -0.3, color: 'var(--ink)', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function ChartCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  )
}

function SegControl({ opts, active, onChange }: { opts: string[]; active: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 5, padding: 2 }}>
      {opts.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          padding: '3px 10px', fontSize: 11, fontFamily: 'var(--sans)', fontWeight: 500,
          background: active === o ? 'var(--surface)' : 'transparent',
          color: active === o ? 'var(--ink)' : 'var(--ink-3)',
          border: 'none', borderRadius: 3, cursor: 'pointer',
          boxShadow: active === o ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
        }}>{o}</button>
      ))}
    </div>
  )
}

function BarChart({ data }: { data: BarDatum[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (!data.length) return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12 }}>No data</div>
  const max = Math.max(...data.map(d => d.value))
  const barW = Math.max(4, Math.min(32, Math.floor(560 / data.length) - 3))
  const height = 100

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 3, height: height + 32, minWidth: data.length * (barW + 3), alignItems: 'stretch' }}>
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(3, Math.round(d.value / max * height)) : 3
          const isH = hovered === i
          return (
            <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto', width: barW }}>
              {isH && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 3, padding: '2px 4px', whiteSpace: 'nowrap' }}>
                  {d.value}
                </div>
              )}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: barW, height: h,
                    background: isH ? 'var(--accent)' : 'color-mix(in oklch, var(--accent) 55%, var(--line))',
                    borderRadius: '2px 2px 0 0', cursor: 'default',
                    transition: 'background 120ms',
                  }}
                />
              </div>
              {(data.length <= 24 || i % Math.ceil(data.length / 16) === 0) && (
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-3)',
                  whiteSpace: 'nowrap', transform: data.length > 12 ? 'rotate(-40deg)' : 'none',
                  transformOrigin: 'top center', marginTop: 2,
                }}>{d.label}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CityLeaderboard({ rows }: { rows: { city: string; full: string; count: number }[] }) {
  if (!rows.length) return <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>No data</div>
  const max = rows[0].count
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rows.map((r, i) => (
        <div key={r.full} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', width: 14, textAlign: 'right' }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>{r.city}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>{r.count}</div>
            </div>
            <div style={{ height: 4, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${r.count / max * 100}%`,
                background: i === 0 ? 'var(--accent)' : 'color-mix(in oklch, var(--accent) 45%, var(--line))',
              }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DayOfWeekChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value))
  const peak = max === 0 ? -1 : data.findIndex(d => d.value === max)
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 80 }}>
      {data.map((d, i) => {
        const pct = max > 0 ? d.value / max : 0
        const isPeak = i === peak
        return (
          <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>{d.value || ''}</div>
            <div style={{ width: '100%', height: 52, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${Math.max(4, pct * 52)}px`,
                background: isPeak ? 'var(--accent)' : 'var(--line)',
                transition: 'height 300ms ease',
              }} />
            </div>
            <div style={{ fontSize: 11.5, fontFamily: 'var(--sans)', fontWeight: isPeak ? 600 : 400, color: isPeak ? 'var(--ink)' : 'var(--ink-3)' }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryBreakdown({ rows, total }: { rows: { cat: CatKey; count: number }[]; total: number }) {
  if (!rows.length) return <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>No data</div>
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      {rows.map(r => {
        const c = CAT_STYLE[r.cat]
        const pct = total > 0 ? Math.round(r.count / total * 100) : 0
        return (
          <div key={r.cat} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', position: 'relative',
              background: 'transparent', border: `2.5px solid ${c.dot}`,
            }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                {r.count} · {pct}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
