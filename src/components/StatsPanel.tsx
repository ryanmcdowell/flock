import { useEffect, useMemo, useState } from 'react'
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

interface Streak { days: number; startTs: number | null; endTs: number | null }

function computeStats(checkins: CheckIn[], all: CheckIn[]) {
  const sorted = [...checkins].sort((a, b) => a.checked_in_at - b.checked_in_at)
  const total = sorted.length
  const citySet = new Set(sorted.map(c => c.venue_city).filter(Boolean) as string[])
  const venueSet = new Set(sorted.map(c => c.venue_id ?? c.venue_name))

  const firstTs = sorted[0]?.checked_in_at ?? null
  const lastTs = sorted[sorted.length - 1]?.checked_in_at ?? null

  // Per-month bars
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

  // Per-year bars
  const yearMap = new Map<string, number>()
  for (const c of sorted) {
    const y = String(new Date(c.checked_in_at * 1000).getFullYear())
    yearMap.set(y, (yearMap.get(y) ?? 0) + 1)
  }
  const byYear: BarDatum[] = [...yearMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([y, v]) => ({ key: y, label: y, value: v }))

  // Top cities
  const cityCount = new Map<string, number>()
  for (const c of sorted) {
    if (c.venue_city) cityCount.set(c.venue_city, (cityCount.get(c.venue_city) ?? 0) + 1)
  }
  const topCities = [...cityCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([full, count]) => ({ city: full.replace(/, [A-Z]{2}$/, ''), full, count }))

  // By category
  const catCount: Partial<Record<CatKey, number>> = {}
  for (const c of sorted) {
    const k = mapCategory(c.venue_category)
    catCount[k] = (catCount[k] ?? 0) + 1
  }
  const byCategory = (Object.entries(catCount) as [CatKey, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ cat, count }))

  // Day of week
  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = [0, 0, 0, 0, 0, 0, 0]
  for (const c of sorted) day[new Date(c.checked_in_at * 1000).getDay()] += 1
  const byDayOfWeek = dowLabels.map((label, i) => ({ label, value: day[i] }))

  // Hour of day
  const hour = new Array(24).fill(0) as number[]
  for (const c of sorted) hour[new Date(c.checked_in_at * 1000).getHours()] += 1
  const byHour = hour.map((value, h) => ({
    label: h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`,
    value,
    hour: h,
  }))

  // Longest streak — sequence of consecutive UTC days with at least one check-in
  const dayKeys = [...new Set(sorted.map(c => new Date(c.checked_in_at * 1000).toISOString().slice(0, 10)))].sort()
  const streak: Streak = { days: dayKeys.length > 0 ? 1 : 0, startTs: null, endTs: null }
  if (dayKeys.length > 0) {
    let bestDays = 1
    let bestStart = dayKeys[0]
    let bestEnd = dayKeys[0]
    let runDays = 1
    let runStart = dayKeys[0]
    for (let i = 1; i < dayKeys.length; i++) {
      const prev = Date.parse(dayKeys[i - 1] + 'T00:00:00Z') / 86400000
      const curr = Date.parse(dayKeys[i] + 'T00:00:00Z') / 86400000
      if (curr - prev === 1) {
        runDays += 1
      } else {
        runDays = 1
        runStart = dayKeys[i]
      }
      if (runDays > bestDays) {
        bestDays = runDays
        bestStart = runStart
        bestEnd = dayKeys[i]
      }
    }
    streak.days = bestDays
    streak.startTs = Date.parse(bestStart + 'T12:00:00Z') / 1000
    streak.endTs = Date.parse(bestEnd + 'T12:00:00Z') / 1000
  }

  return {
    total, cityCount: citySet.size, uniqueVenues: venueSet.size,
    firstTs, lastTs,
    byMonth, byYear, topCities, byCategory, byDayOfWeek, byHour,
    longestStreak: streak,
    allLen: all.length,
  }
}

function fmtShortDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtMonthYear(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function StatsPanel() {
  // Analytics always reflects the full check-in history regardless of sidebar
  // filters so the numbers are stable.
  const all = useAppStore(s => s.checkins)
  const stats = useMemo(() => computeStats(all, all), [all])
  // Default to Yearly when the history spans more than ~3 years; otherwise the
  // monthly bar chart turns into 100+ tiny bars whose labels can't fit.
  const longHistory = stats.byMonth.length > 36
  const [granularity, setGranularity] = useState<'Monthly' | 'Yearly'>(longHistory ? 'Yearly' : 'Monthly')
  useEffect(() => {
    setGranularity(longHistory ? 'Yearly' : 'Monthly')
  }, [longHistory])

  const chartData = granularity === 'Monthly' ? stats.byMonth : stats.byYear

  // minWidth: 0 on grid children is what lets the inner overflow-x:auto
  // actually work (CSS grid children default to min-width:auto = content size).
  const gridChild: React.CSSProperties = { minWidth: 0 }

  const activeSince = stats.firstTs ? fmtMonthYear(stats.firstTs) : null
  const streakRange = stats.longestStreak.startTs && stats.longestStreak.endTs
    ? (stats.longestStreak.startTs === stats.longestStreak.endTs
        ? fmtShortDate(stats.longestStreak.startTs)
        : `${fmtShortDate(stats.longestStreak.startTs)} – ${fmtShortDate(stats.longestStreak.endTs)}`)
    : null

  return (
    <div style={{
      padding: '28px 32px', overflowY: 'auto', height: '100%',
      display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0,
    }}>
      {/* Headline metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div style={gridChild}><StatCard label="Total check-ins" value={stats.total.toLocaleString()} /></div>
        <div style={gridChild}><StatCard label="Cities visited" value={stats.cityCount.toLocaleString()} /></div>
        <div style={gridChild}>
          <StatCard
            label="Unique venues"
            value={stats.uniqueVenues.toLocaleString()}
            sub={activeSince ? `since ${activeSince}` : undefined}
          />
        </div>
        <div style={gridChild}>
          <StatCard
            label="Longest streak"
            value={`${stats.longestStreak.days} ${stats.longestStreak.days === 1 ? 'day' : 'days'}`}
            sub={streakRange ?? undefined}
          />
        </div>
      </div>

      {/* Check-ins over time — full width */}
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

      {/* Place + category insights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={gridChild}>
          <ChartCard title="Top cities">
            <CityLeaderboard rows={stats.topCities} />
          </ChartCard>
        </div>
        <div style={gridChild}>
          <ChartCard title="By category">
            <CategoryDonut rows={stats.byCategory} total={stats.total} />
          </ChartCard>
        </div>
      </div>

      {/* Time-of-week / time-of-day */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={gridChild}>
          <ChartCard title="By day of week">
            <DayOfWeekChart data={stats.byDayOfWeek} />
          </ChartCard>
        </div>
        <div style={gridChild}>
          <ChartCard title="By hour of day">
            <HourOfDayChart data={stats.byHour} />
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8,
      padding: '16px 18px',
      height: '100%', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 30, fontWeight: 300, letterSpacing: -0.3, color: 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ flex: 1 }} />
      {/* Reserve a row for the sub line so cards without one still match height */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: 12 }}>
        {sub ?? ' '}
      </div>
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

// Decide which bars get an x-axis label: every year boundary for monthly view,
// every bar for yearly view (or anything with 12 or fewer bars).
function pickTickIndices(data: BarDatum[]): number[] {
  if (data.length <= 12) return data.map((_, i) => i)
  // Monthly keys are "YYYY-MM"; surface only the YYYY-01 entries.
  const isMonthly = data[0].key.length === 7 && data[0].key.includes('-')
  if (isMonthly) {
    return data.flatMap((d, i) => (d.key.endsWith('-01') ? [i] : []))
  }
  // Fallback for any other long series: ~8 evenly spaced ticks
  const step = Math.ceil(data.length / 8)
  return data.flatMap((_, i) => (i % step === 0 ? [i] : []))
}

function tickLabel(d: BarDatum): string {
  // For monthly data, show only the year on Jan ticks; otherwise the raw label.
  if (d.key.length === 7 && d.key.endsWith('-01')) return d.key.slice(0, 4)
  return d.label
}

function BarChart({ data }: { data: BarDatum[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (!data.length) {
    return (
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
        No data
      </div>
    )
  }

  const max = Math.max(...data.map(d => d.value))
  // Each column gets at least MIN_COL_W px. If the data fits in the container,
  // flex stretches the columns to fill 100%. If not, minWidth kicks in and
  // overflow-x scrolls. The previous version hard-capped column width at 32px
  // which left the right half of the chart blank in Yearly view.
  const MIN_COL_W = 6
  const gap = 3
  const height = 110
  const naturalMinWidth = data.length * (MIN_COL_W + gap)
  const ticks = pickTickIndices(data)

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ position: 'relative', minWidth: naturalMinWidth, paddingBottom: 22 }}>
        {/* Bars */}
        <div style={{ display: 'flex', gap, alignItems: 'flex-end', height }}>
          {data.map((d, i) => {
            const h = max > 0 ? Math.max(3, Math.round(d.value / max * height)) : 3
            const isH = hovered === i
            return (
              <div
                key={d.key}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ position: 'relative', flex: '1 1 0', minWidth: MIN_COL_W, height }}
              >
                {isH && (
                  <div style={{
                    position: 'absolute', bottom: h + 4, left: '50%', transform: 'translateX(-50%)',
                    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink)',
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 3, padding: '2px 5px', whiteSpace: 'nowrap',
                    pointerEvents: 'none', zIndex: 1,
                  }}>
                    <div style={{ fontWeight: 600 }}>{d.value}</div>
                    <div style={{ color: 'var(--ink-3)', fontSize: 9 }}>{d.label}</div>
                  </div>
                )}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: h,
                  background: isH ? 'var(--accent)' : 'color-mix(in oklch, var(--accent) 55%, var(--line))',
                  borderRadius: '2px 2px 0 0',
                  transition: 'background 120ms',
                }} />
              </div>
            )
          })}
        </div>
        {/* Baseline */}
        <div style={{ height: 1, background: 'var(--line-2)', marginTop: 0 }} />
        {/* X-axis tick labels — flex columns mirror the bar columns above so
            ticks always sit under their bar regardless of container width. */}
        <div style={{ display: 'flex', gap, height: 18, marginTop: 4 }}>
          {data.map((d, i) => (
            <div key={d.key} style={{ flex: '1 1 0', minWidth: MIN_COL_W, position: 'relative', height: 14 }}>
              {ticks.includes(i) && (
                <div style={{
                  position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
                  whiteSpace: 'nowrap', lineHeight: 1,
                }}>
                  {tickLabel(d)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryDonut({ rows, total }: { rows: { cat: CatKey; count: number }[]; total: number }) {
  if (!rows.length || total === 0) {
    return <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>No data</div>
  }

  // SVG donut: each segment is a circle stroke segment positioned by
  // strokeDasharray + strokeDashoffset. Rotate -90deg so the first segment
  // starts at 12 o'clock.
  const radius = 40
  const stroke = 14
  const circumference = 2 * Math.PI * radius

  let cursor = 0
  const segments = rows.map(r => {
    const len = (r.count / total) * circumference
    const offset = cursor
    cursor += len
    return { ...r, len, offset }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 132, height: 132 }}>
        <svg width="132" height="132" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
          {segments.map(s => (
            <circle
              key={s.cat}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={CAT_STYLE[s.cat].dot}
              strokeWidth={stroke}
              strokeDasharray={`${s.len} ${circumference}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt"
              transform="rotate(-90 50 50)"
            />
          ))}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>
            {total.toLocaleString()}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 3, letterSpacing: 0.4 }}>
            TOTAL
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {rows.map(r => {
          const pct = Math.round((r.count / total) * 100)
          return (
            <div key={r.cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 9, height: 9, borderRadius: '50%',
                background: CAT_STYLE[r.cat].dot, flexShrink: 0,
              }} />
              <span style={{
                flex: 1, fontSize: 12.5, color: 'var(--ink)', fontWeight: 500,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {CAT_STYLE[r.cat].label}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>
                {r.count.toLocaleString()}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
                flexShrink: 0, width: 30, textAlign: 'right',
              }}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HourOfDayChart({ data }: { data: { label: string; value: number; hour: number }[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value))
  const peakHour = max === 0 ? -1 : data.findIndex(d => d.value === max)
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 72 }}>
        {data.map((d, i) => {
          const pct = max > 0 ? d.value / max : 0
          const isPeak = i === peakHour
          return (
            <div key={d.hour} title={`${d.label}: ${d.value}`} style={{ flex: 1, height: 64, display: 'flex', alignItems: 'flex-end', minWidth: 6 }}>
              <div style={{
                width: '100%',
                height: `${Math.max(2, pct * 60)}px`,
                background: isPeak ? 'var(--accent)' : 'color-mix(in oklch, var(--accent) 45%, var(--line))',
                borderRadius: '2px 2px 0 0',
                transition: 'background 120ms',
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)' }}>
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
      {peakHour >= 0 && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)' }}>
          Peak: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{data[peakHour].label}</span>
          <span style={{ marginLeft: 6 }}>· {data[peakHour].value} check-ins</span>
        </div>
      )}
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

