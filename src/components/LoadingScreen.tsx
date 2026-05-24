import { useAppStore } from '../store'

export default function LoadingScreen() {
  const progress = useAppStore(s => s.syncProgress)
  const pct = progress ? Math.round((progress.loaded / progress.total) * 100) : 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ fontSize: '32px' }}>📍</div>
      <h2 style={{ margin: 0 }}>Loading your check-ins…</h2>
      {progress && (
        <>
          <div style={{
            width: '300px', height: '8px', background: 'var(--color-muted-bg, #eee)', borderRadius: '4px', overflow: 'hidden'
          }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#F4845F', transition: 'width 0.3s' }} />
          </div>
          <p style={{ margin: 0, color: 'var(--color-muted, #888)', fontSize: '14px' }}>
            Loading {progress.loaded} of {progress.total} check-ins
          </p>
        </>
      )}
      {!progress && <p style={{ color: 'var(--color-muted, #888)' }}>Connecting…</p>}
    </div>
  )
}
