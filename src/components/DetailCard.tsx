import { useAppStore } from '../store'
import type { CheckIn } from '../types'

interface Props {
  checkin: CheckIn
  onClose: () => void
}

export default function DetailCard({ checkin, onClose }: Props) {
  const prefs = useAppStore(s => s.prefs)
  const date = new Date(checkin.checked_in_at * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={{
      background: 'var(--color-surface, #fff)', borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '16px', minWidth: '240px', maxWidth: '300px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <strong style={{ fontSize: '15px', lineHeight: '1.3' }}>{checkin.venue_name}</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#888', padding: '0 0 0 8px' }}>×</button>
      </div>
      {checkin.venue_address && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#888' }}>{checkin.venue_address}</p>}
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#888' }}>{date}</p>
      {prefs.show_categories && checkin.venue_category && (
        <span style={{ display: 'inline-block', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#FEF3C7', color: '#92400E', marginBottom: '8px' }}>
          {checkin.venue_category}
        </span>
      )}
      {prefs.show_notes && checkin.note && (
        <p style={{ margin: '0 0 8px', fontSize: '13px', fontStyle: 'italic', color: '#555' }}>"{checkin.note}"</p>
      )}
      <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
        {checkin.venue_city && checkin.lat && checkin.lng && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${checkin.lat},${checkin.lng}`}
            target="_blank" rel="noreferrer"
            style={{ color: '#F4845F' }}
          >
            Open in Maps
          </a>
        )}
        {checkin.swarm_url && (
          <a href={checkin.swarm_url} target="_blank" rel="noreferrer" style={{ color: '#F4845F' }}>
            View on Swarm
          </a>
        )}
      </div>
    </div>
  )
}
