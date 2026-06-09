import { useAppStore } from '../store'
import SyncErrorBanner from './SyncErrorBanner'

export default function LoadingScreen() {
  const progress = useAppStore(s => s.syncProgress)
  const setAppView = useAppStore(s => s.setAppView)
  const pct = progress ? Math.min(100, (progress.loaded / Math.max(progress.total, 1)) * 100) : 0

  function continueInBackground() {
    setAppView('main')
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 28, minHeight: '100vh',
    }}>
      <div style={{
        width: '100%', maxWidth: 1380, height: 'min(880px, calc(100vh - 56px))',
        borderRadius: 14, overflow: 'hidden', position: 'relative',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 24px 60px rgba(40,30,10,0.18)',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ height: 60, background: 'var(--accent)' }} />
        <SyncErrorBanner />
        <div style={{ flex: 1 }} />

        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(242,236,224,0.88)', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: 380, padding: '32px 32px 28px', background: 'var(--surface)',
            border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: '0 20px 48px rgba(24,20,14,0.10)',
            fontFamily: 'var(--sans)',
          }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 26, fontWeight: 400, letterSpacing: -0.3, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.2 }}>
              Loading your check-ins
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 20 }}>
              Initial sync · Foursquare Swarm API
            </div>
            <div style={{ height: 2, background: 'var(--line-2)', borderRadius: 1, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 120ms linear' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
              {progress ? (
                <>
                  <span>{progress.loaded} of {progress.total}</span>
                  <span>{Math.round(pct)}%</span>
                </>
              ) : (
                <span>Connecting…</span>
              )}
            </div>
            {progress && (
              <button onClick={continueInBackground} style={{
                marginTop: 20, background: 'transparent', border: 'none',
                color: 'var(--ink-3)', fontSize: 11, cursor: 'pointer', padding: 0,
                fontFamily: 'var(--sans)', textDecoration: 'underline', textUnderlineOffset: 3,
                textDecorationColor: 'var(--line)',
              }}>Continue in background</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
