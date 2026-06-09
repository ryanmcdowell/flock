import { invoke } from '@tauri-apps/api/core'
import { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { loadCachedAndSync } from '../hooks/useTauriEvents'
import { useDraggable } from '../hooks/useDraggable'

export default function ConnectScreen() {
  const dragRef = useRef<HTMLDivElement>(null)
  useDraggable(dragRef)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setAppView = useAppStore(s => s.setAppView)

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    try {
      await invoke('start_oauth')
      setAppView('loading')
      await loadCachedAndSync()
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: 'var(--surface)', position: 'relative',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Spacer for OS title bar overlay so traffic lights have a non-content backdrop */}
      <div ref={dragRef} data-tauri-drag-region style={{ height: 32, flexShrink: 0 }} />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.05fr 1fr', minHeight: 0 }}>
        <PitchColumn />
        <ConnectColumn connecting={connecting} error={error} onConnect={handleConnect} />
      </div>
    </div>
  )
}

function PitchColumn() {
  return (
    <div style={{
      padding: '56px 56px 40px', display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--line-2)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>
        Swarm · Check-in viewer
      </div>
      <h1 style={{
        fontSize: 46, lineHeight: 1.0, letterSpacing: -1,
        margin: 0, color: '#000', textWrap: 'pretty', fontFamily: 'var(--sans)', fontWeight: 800,
      }}>
        Every place you've been,<br />
        <em style={{ color: 'var(--accent)', fontStyle: 'normal', fontWeight: 800 }}>on one map.</em>
      </h1>
      <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 440 }}>
        Connect your Foursquare account to explore years of check-ins through an interactive map,
        a searchable timeline, and filters that actually work. Your data stays local — cached on this
        machine, never sent anywhere else.
      </p>

      <div style={{ flex: 1, position: 'relative', marginTop: 32, minHeight: 0 }}>
        <svg viewBox="0 0 400 280" width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <pattern id="si-grain" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect width="20" height="20" fill="var(--map-land)" />
              <circle cx="5" cy="7" r="0.5" fill="rgba(0,0,0,0.04)" />
              <circle cx="15" cy="14" r="0.4" fill="rgba(0,0,0,0.04)" />
            </pattern>
          </defs>
          <rect width="400" height="280" fill="var(--map-water)" />
          {Array.from({ length: 8 }).map((_, i) => (
            <path key={i} d={`M -20 ${30 + i * 35} Q 100 ${25 + i * 35} 200 ${32 + i * 35} T 420 ${30 + i * 35}`}
              stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" fill="none" />
          ))}
          <path d="M 60 80 C 50 60 80 40 120 50 C 170 55 200 80 195 110 C 185 140 150 150 110 140 C 80 135 55 115 60 80 Z"
            fill="url(#si-grain)" stroke="rgba(80,60,30,0.18)" strokeWidth="1" />
          <path d="M 240 140 C 230 120 260 105 300 115 C 340 125 360 150 350 180 C 335 205 290 210 260 195 C 240 185 235 160 240 140 Z"
            fill="url(#si-grain)" stroke="rgba(80,60,30,0.18)" strokeWidth="1" />
          {[
            { x: 110, y: 95, c: '#1ECCCF' },
            { x: 140, y: 110, c: '#26A65B' },
            { x: 95, y: 120, c: '#7C6FFF' },
            { x: 155, y: 80, c: '#FFBC00' },
            { x: 285, y: 160, c: '#FF6B7A' },
            { x: 315, y: 145, c: '#D84C42' },
            { x: 300, y: 180, c: '#1ECCCF' },
          ].map((p, i) => (
            <g key={i} transform={`translate(${p.x}, ${p.y})`}>
              <circle r="14" fill={p.c} opacity="0.12" />
              <circle r="7" fill="white" stroke={p.c} strokeWidth="2" />
              <circle r="2.6" fill={p.c} />
            </g>
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 28, fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--sans)', marginTop: 24 }}>
        <span><span style={{ color: 'var(--ink-2)' }}>Local-first</span> · cache on device</span>
        <span><span style={{ color: 'var(--ink-2)' }}>Read-only</span> · never writes to Swarm</span>
        <span><span style={{ color: 'var(--ink-2)' }}>Keychain</span> · OS-secured token</span>
      </div>
    </div>
  )
}

function ConnectColumn({ connecting, error, onConnect }: { connecting: boolean; error: string | null; onConnect: () => void }) {
  return (
    <div style={{
      padding: '56px 48px', display: 'flex', flexDirection: 'column', gap: 22,
      background: 'var(--bg)', overflowY: 'auto',
    }}>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 8 }}>
          Step 1 — connect
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 22, letterSpacing: -0.3, marginBottom: 14, color: 'var(--ink)' }}>
          Link your Foursquare account
        </div>
        <button
          onClick={onConnect}
          disabled={connecting}
          style={{
            width: '100%', height: 48, borderRadius: 8, border: 'none',
            background: connecting ? 'var(--line)' : 'var(--accent)',
            color: connecting ? 'var(--ink-3)' : '#fff',
            fontSize: 14, fontFamily: 'var(--sans)', fontWeight: 700, letterSpacing: 0.2,
            cursor: connecting ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background 160ms ease',
          }}
        >
          {connecting ? (
            <>
              <Spinner />
              <span>Opening Foursquare…</span>
            </>
          ) : (
            <>
              <span>Connect with Foursquare</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.7 }}>↗</span>
            </>
          )}
        </button>
        {error && (
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 6,
            background: '#FEF2F2', border: '1px solid #FCA5A5',
            color: '#991B1B', fontSize: 12, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 14 }}>
          Foursquare OAuth 2.0. The access token is stored in the OS keychain and can be revoked
          any time by signing out.
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.6, lineHeight: 1.6,
      }}>
        Foursquare · OAuth 2.0 · read-only scope<br />
        Cache: ~/Library/Application Support/Swarm Viewer/swarm.db
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin 900ms linear infinite' }}>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.25" />
      <path d="M 12.5 7 A 5.5 5.5 0 0 0 7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}
