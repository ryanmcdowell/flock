import { useAppStore } from '../store'
import type { CheckIn } from '../types'

interface Props {
  checkin: CheckIn
  style: React.CSSProperties
}

export default function TimelineRow({ checkin, style }: Props) {
  const { selectedCheckinId, setSelectedCheckinId, prefs } = useAppStore()
  const isSelected = selectedCheckinId === checkin.id
  const date = new Date(checkin.checked_in_at * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      onClick={() => setSelectedCheckinId(checkin.id)}
      style={{
        ...style,
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border, #f0f0f0)',
        cursor: 'pointer',
        background: isSelected ? '#FFF7ED' : 'var(--color-surface, #fff)',
        borderLeft: isSelected ? '3px solid #F4845F' : '3px solid transparent',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {checkin.venue_name}
      </div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: prefs.show_categories && checkin.venue_category ? '4px' : 0 }}>
        {checkin.venue_city} · {date}
      </div>
      {prefs.show_categories && checkin.venue_category && (
        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', background: '#FEF3C7', color: '#92400E' }}>
          {checkin.venue_category}
        </span>
      )}
      {prefs.show_notes && checkin.note && (
        <div style={{ fontSize: '12px', color: '#777', fontStyle: 'italic', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          "{checkin.note}"
        </div>
      )}
    </div>
  )
}
