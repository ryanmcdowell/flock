import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'
import { CAT_STYLE, mapCategory } from '../categories'
import type { CheckIn } from '../types'

interface Props {
  checkin: CheckIn
  onClose: () => void
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

export default function DetailCard({ checkin, onClose }: Props) {
  const prefs = useAppStore(s => s.prefs)
  const cat = mapCategory(checkin.venue_category)
  const color = CAT_STYLE[cat].dot
  const place = [checkin.venue_city, checkin.venue_country].filter(Boolean).join(', ')

  return (
    <div style={{
      width: 288,
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 8, boxShadow: '0 8px 28px rgba(24,20,14,0.10)',
      overflow: 'hidden', fontFamily: 'var(--sans)',
    }}>
      <div style={{ height: 3, background: color, opacity: 0.8 }} />

      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {prefs.show_categories && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--ink-3)', marginBottom: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                {CAT_STYLE[cat].label}
              </div>
            )}
            <div style={{
              fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 500, lineHeight: 1.15,
              letterSpacing: -0.2, color: 'var(--ink)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {checkin.venue_name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-3)', fontSize: 18, lineHeight: 1, padding: '2px 0', flexShrink: 0,
          }}>×</button>
        </div>

        {checkin.venue_address && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {checkin.venue_address}
          </div>
        )}
        {place && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {place}
          </div>
        )}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>
          {fmtDate(checkin.checked_in_at)} · {fmtTime(checkin.checked_in_at)}
        </div>

        {prefs.show_notes && (
          checkin.note ? (
            <div style={{
              marginBottom: 16, paddingLeft: 12,
              borderLeft: '1.5px solid var(--line)',
              fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 400,
              lineHeight: 1.55, color: 'var(--ink)',
            }}>
              {checkin.note}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16, paddingLeft: 12, borderLeft: '1.5px solid var(--line-2)' }}>
              No notes.
            </div>
          )
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
          {checkin.lat != null && checkin.lng != null && (
            <LinkRow label="Open in Maps" href={`https://www.google.com/maps/search/?api=1&query=${checkin.lat},${checkin.lng}`} />
          )}
          {checkin.swarm_url && <LinkRow label="View on Swarm" href={checkin.swarm_url} />}
        </div>
      </div>
    </div>
  )
}

function LinkRow({ label, href }: { label: string; href: string }) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    invoke('open_url', { url: href }).catch((err) => console.error('open_url failed:', err))
  }
  return (
    <a
      href={href}
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 12, color: 'var(--ink-2)', textDecoration: 'none', padding: '3px 0',
        fontFamily: 'var(--sans)', cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-2)')}
    >
      <span>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>↗</span>
    </a>
  )
}
