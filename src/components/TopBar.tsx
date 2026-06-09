import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'

const TRAFFIC = { width: 11, height: 11, borderRadius: '50%', border: '0.5px solid rgba(0,0,0,0.08)' } as const

export default function TopBar() {
  const panelView = useAppStore(s => s.panelView)
  const setPanelView = useAppStore(s => s.setPanelView)
  const query = useAppStore(s => s.searchQuery)
  const setSearchQuery = useAppStore(s => s.setSearchQuery)
  const syncProgress = useAppStore(s => s.syncProgress)
  const syncing = syncProgress !== null

  function refresh() {
    invoke('start_sync').catch((e) => {
      console.error('start_sync failed:', e)
      useAppStore.getState().setSyncError(String(e))
    })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '0 22px',
      height: 60, borderBottom: '1px solid rgba(0,0,0,0.1)',
      background: 'var(--accent)', flexWrap: 'nowrap', position: 'relative',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: 7, flexShrink: 0, marginRight: 18 }}>
        <span style={{ ...TRAFFIC, background: '#ff5f57' }} />
        <span style={{ ...TRAFFIC, background: '#febc2e' }} />
        <span style={{ ...TRAFFIC, background: '#28c840' }} />
      </div>

      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 18, letterSpacing: -0.5, color: '#ffffff', marginRight: 28, flexShrink: 0 }}>
        Swarm
      </div>

      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 3, gap: 2 }}>
        {([['timeline', 'Check-ins'], ['stats', 'Analytics']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPanelView(key)}
            style={{
              padding: '5px 20px', height: 32, fontWeight: 600, fontSize: 12.5,
              fontFamily: 'var(--sans)', cursor: 'pointer',
              background: panelView === key ? '#ffffff' : 'transparent',
              color: panelView === key ? 'var(--accent)' : 'rgba(255,255,255,0.75)',
              border: 'none', borderRadius: 6,
              boxShadow: panelView === key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 140ms ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, width: 230,
        height: 32, padding: '0 12px', borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.18)', flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
          <circle cx="5.5" cy="5.5" r="4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
          <path d="M8.6 8.6l3 3" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 12.5, fontFamily: 'var(--sans)', color: '#ffffff',
          }}
        />
        {query && (
          <button onClick={() => setSearchQuery('')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)', fontSize: 14, padding: 0, lineHeight: 1,
          }}>×</button>
        )}
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 14,
        fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.85)', flexShrink: 0,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
          animation: syncing ? 'pulse 1.2s infinite' : 'none',
        }} />
        {syncing && syncProgress
          ? `${syncProgress.loaded} / ${syncProgress.total}`
          : (
            <button onClick={refresh} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.85)', padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}>refresh</button>
          )}
      </div>
    </div>
  )
}
