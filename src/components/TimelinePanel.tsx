import { useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '../store'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'
import { CAT_STYLE, mapCategory } from '../categories'
import type { CheckIn } from '../types'

function fmtMonth(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

export default function TimelinePanel() {
  const filteredCheckins = useFilteredCheckins()
  const selectedCheckinId = useAppStore(s => s.selectedCheckinId)
  const setSelectedCheckinId = useAppStore(s => s.setSelectedCheckinId)
  const setHoveredCheckinId = useAppStore(s => s.setHoveredCheckinId)
  const hoveredCheckinId = useAppStore(s => s.hoveredCheckinId)
  const prefs = useAppStore(s => s.prefs)
  const searchQuery = useAppStore(s => s.searchQuery)
  const listRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const g = new Map<string, CheckIn[]>()
    const sorted = [...filteredCheckins].sort((a, b) => b.checked_in_at - a.checked_in_at)
    for (const c of sorted) {
      const key = fmtMonth(c.checked_in_at)
      if (!g.has(key)) g.set(key, [])
      g.get(key)!.push(c)
    }
    return [...g.entries()]
  }, [filteredCheckins])

  useEffect(() => {
    if (!selectedCheckinId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-id="${selectedCheckinId}"]`)
    if (!el) return
    const parent = listRef.current
    const er = el.getBoundingClientRect()
    const pr = parent.getBoundingClientRect()
    if (er.top < pr.top || er.bottom > pr.bottom) {
      parent.scrollTop += (er.top - pr.top) - (pr.height / 2 - er.height / 2)
    }
  }, [selectedCheckinId])

  if (filteredCheckins.length === 0) {
    return (
      <div style={{ padding: '64px 28px', textAlign: 'center', color: 'var(--ink-3)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 22, color: 'var(--ink-2)', marginBottom: 8 }}>
          Nothing here
        </div>
        <div style={{ fontSize: 13, fontFamily: 'var(--sans)' }}>
          {searchQuery ? `No check-ins match "${searchQuery}".` : 'No check-ins match these filters.'}
        </div>
      </div>
    )
  }

  return (
    <div ref={listRef} style={{ height: '100%', overflowY: 'auto', padding: '0 0 40px' }}>
      {groups.map(([month, items]) => (
        <div key={month}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '18px 22px 10px',
            position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2,
          }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
              {month}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--line-2)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{items.length}</span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map(item => (
              <TimelineRow
                key={item.id}
                item={item}
                selected={item.id === selectedCheckinId}
                hovered={item.id === hoveredCheckinId}
                onSelect={setSelectedCheckinId}
                onHover={setHoveredCheckinId}
                query={searchQuery}
                showCats={prefs.show_categories}
                showNotes={prefs.show_notes}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function TimelineRow({
  item, selected, hovered, onSelect, onHover, query, showCats, showNotes,
}: {
  item: CheckIn
  selected: boolean
  hovered: boolean
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  query: string
  showCats: boolean
  showNotes: boolean
}) {
  const cat = mapCategory(item.venue_category)
  const color = CAT_STYLE[cat].dot
  const isActive = selected || hovered
  const dt = new Date(item.checked_in_at * 1000)
  const day = dt.getDate()
  const dow = dt.toLocaleDateString('en-US', { weekday: 'short' })
  const place = [item.venue_city, item.venue_country].filter(Boolean).join(' · ')

  return (
    <li
      data-id={item.id}
      onClick={() => onSelect(item.id)}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'grid', gridTemplateColumns: '52px 1fr',
        padding: '12px 22px 12px 16px',
        cursor: 'pointer',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        borderBottom: '1px solid var(--line-2)',
        background: isActive ? 'var(--bg)' : 'transparent',
        transition: 'background 100ms ease',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingTop: 3, gap: 2 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 300, color: 'var(--ink-2)', lineHeight: 1 }}>{day}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 0.8, color: 'var(--ink-3)' }}>{dow}</span>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          {showCats && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, marginBottom: 1 }} />
          )}
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.15, letterSpacing: -0.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textDecoration: selected ? 'underline' : 'none',
            textUnderlineOffset: 3, textDecorationColor: 'var(--accent)',
          }}>
            <Highlight text={item.venue_name} q={query} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', flexShrink: 0 }}>{fmtTime(item.checked_in_at)}</span>
        </div>

        {place && (
          <div style={{
            fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--sans)',
            marginLeft: showCats ? 14 : 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <Highlight text={place} q={query} />
          </div>
        )}

        {showNotes && item.note && (
          <div style={{
            marginTop: 7, marginLeft: showCats ? 14 : 0,
            paddingLeft: 10,
            borderLeft: '1.5px solid var(--line)',
            fontSize: 13, fontFamily: 'var(--sans)', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.45,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <Highlight text={item.note} q={query} />
          </div>
        )}
      </div>
    </li>
  )
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: 'var(--accent-soft)', color: 'var(--ink)', padding: '0 2px', borderRadius: 2 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  )
}
