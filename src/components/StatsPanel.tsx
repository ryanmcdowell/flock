import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'

function fmtMonth(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function longestStreak(timestamps: number[]): { days: number; startTs: number | null; endTs: number | null } {
  if (!timestamps.length) return { days: 0, startTs: null, endTs: null }
  const days = [...new Set(timestamps.map(ts => Math.floor(ts / 86400)))].sort((a,b) => a-b)
  let max = 1, curr = 1, maxStart = days[0], maxEnd = days[0], currStart = days[0]
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i-1] + 1) {
      curr++
      if (curr > max) { max = curr; maxStart = currStart; maxEnd = days[i] }
    } else { curr = 1; currStart = days[i] }
  }
  return { days: max, startTs: maxStart * 86400, endTs: maxEnd * 86400 }
}

export default function StatsPanel() {
  const checkins = useFilteredCheckins()

  const stats = useMemo(() => {
    const total = checkins.length

    const monthMap = new Map<string, number>()
    for (const c of checkins) {
      const key = fmtMonth(c.checked_in_at)
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
    }
    const perMonth = [...monthMap.entries()].sort((a,b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }))

    const streak = longestStreak(checkins.map(c => c.checked_in_at))
    const streakStart = streak.startTs ? new Date(streak.startTs * 1000).toLocaleDateString() : null
    const streakEnd = streak.endTs ? new Date(streak.endTs * 1000).toLocaleDateString() : null

    const cityMap = new Map<string, number>()
    for (const c of checkins) {
      if (c.venue_city) cityMap.set(c.venue_city, (cityMap.get(c.venue_city) ?? 0) + 1)
    }
    const topCities = [...cityMap.entries()].sort((a,b) => b[1]-a[1]).slice(0,10)
      .map(([city, count]) => ({ city, count }))

    const firstVisit = new Map<string, string>()
    const sorted = [...checkins].sort((a,b) => a.checked_in_at - b.checked_in_at)
    for (const c of sorted) {
      if (c.venue_id && !firstVisit.has(c.venue_id)) firstVisit.set(c.venue_id, fmtMonth(c.checked_in_at))
    }
    const newVenueMap = new Map<string, number>()
    for (const month of firstVisit.values()) newVenueMap.set(month, (newVenueMap.get(month) ?? 0) + 1)
    const newVenues = [...newVenueMap.entries()].sort((a,b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }))

    return { total, perMonth, streak, streakStart, streakEnd, topCities, newVenues }
  }, [checkins])

  const sectionStyle: React.CSSProperties = { marginBottom: '24px' }
  const headingStyle: React.CSSProperties = { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: '8px' }

  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ ...sectionStyle, textAlign: 'center' }}>
        <div style={{ fontSize: '48px', fontWeight: 700, color: '#F4845F', lineHeight: 1 }}>{stats.total}</div>
        <div style={{ color: '#888', fontSize: '13px' }}>total check-ins</div>
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>Check-ins per month</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={stats.perMonth} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [v, 'check-ins']} />
            <Bar dataKey="count" fill="#F4845F" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>Longest streak</div>
        <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.streak.days} days</div>
        {stats.streakStart && <div style={{ fontSize: '12px', color: '#888' }}>{stats.streakStart} – {stats.streakEnd}</div>}
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>Top cities</div>
        {stats.topCities.map(({ city, count }) => (
          <div key={city} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: '1px solid var(--color-border, #f0f0f0)' }}>
            <span>{city}</span>
            <span style={{ color: '#888' }}>{count}</span>
          </div>
        ))}
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>New venues per month</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={stats.newVenues} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [v, 'new venues']} />
            <Bar dataKey="count" fill="#60A5FA" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
