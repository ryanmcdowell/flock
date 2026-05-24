import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'
import { useAppStore } from '../store'
import { loadCachedAndSync } from '../hooks/useTauriEvents'

export default function ConnectScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setAppView = useAppStore(s => s.setAppView)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      await invoke('start_oauth')
      setAppView('loading')
      await loadCachedAndSync()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ fontSize: '48px' }}>📍</div>
      <h1 style={{ margin: 0, fontSize: '24px' }}>Swarm Viewer</h1>
      <p style={{ margin: 0, color: 'var(--color-muted, #888)', textAlign: 'center', maxWidth: '320px' }}>
        Connect your Foursquare account to explore your check-in history.
      </p>
      {error && <p style={{ color: 'red', fontSize: '14px' }}>{error}</p>}
      <button
        onClick={handleConnect}
        disabled={loading}
        style={{
          padding: '10px 24px', fontSize: '16px', borderRadius: '8px',
          background: '#F4845F', color: '#fff', border: 'none',
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Opening browser…' : 'Connect to Swarm'}
      </button>
    </div>
  )
}
