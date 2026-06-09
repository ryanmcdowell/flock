import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'

export default function SyncErrorBanner() {
  const syncError = useAppStore(s => s.syncError)
  const setSyncError = useAppStore(s => s.setSyncError)

  if (!syncError) return null

  function retry() {
    setSyncError(null)
    invoke('start_sync').catch((e) => {
      console.error('start_sync failed:', e)
      useAppStore.getState().setSyncError(String(e))
    })
  }

  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '10px 22px',
        background: '#FEF2F2', color: '#991B1B',
        borderBottom: '1px solid #FCA5A5',
        fontSize: 12, fontFamily: 'var(--sans)',
      }}
    >
      <span style={{ fontWeight: 600, flexShrink: 0 }}>Sync error</span>
      <span style={{ flex: 1, wordBreak: 'break-word', color: 'var(--ink-2)' }}>{syncError}</span>
      <button
        onClick={retry}
        style={{
          padding: '2px 10px', borderRadius: 4, fontSize: 11,
          fontFamily: 'var(--sans)', fontWeight: 500,
          border: '1px solid #991B1B', background: 'transparent', color: '#991B1B',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        Retry
      </button>
      <button
        onClick={() => setSyncError(null)}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#991B1B', fontSize: 16, lineHeight: 1, padding: '0 4px', flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
