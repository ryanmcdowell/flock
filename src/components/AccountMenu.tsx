import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export default function AccountMenu() {
  const profile = useAppStore(s => s.userProfile)
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(null))
  }, [])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function handleSignOut() {
    setOpen(false)
    invoke('sign_out').then(() => {
      useAppStore.getState().setCheckins([])
      useAppStore.getState().setUserProfile(null)
      useAppStore.getState().setAppView('connect')
    }).catch(console.error)
  }

  const initials = profile ? initialsOf(profile.name) : 'FL'
  const name = profile?.name ?? 'Connected'

  return (
    <div ref={rootRef} style={{ position: 'relative', marginLeft: 10, flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account"
        style={{
          width: 30, height: 30, padding: 0, borderRadius: '50%',
          border: '1.5px solid rgba(255,255,255,0.5)',
          background: 'rgba(255,255,255,0.18)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {profile?.photo_url ? (
          <img
            src={profile.photo_url}
            alt={profile.name}
            width={30} height={30}
            referrerPolicy="no-referrer"
            style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{
            fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11,
            color: '#fff', letterSpacing: 0.4,
          }}>{initials}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 6,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(24,20,14,0.14)',
          minWidth: 200, zIndex: 100, padding: 8,
        }}>
          <div style={{ padding: '6px 10px 10px', borderBottom: '1px solid var(--line-2)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'oklch(0.62 0.12 140)', marginTop: 2 }}>
              foursquare · connected
            </div>
            {version && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
                Flock v{version}
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            style={{
              display: 'block', width: '100%', padding: '8px 10px',
              fontSize: 13, fontFamily: 'var(--sans)', color: 'var(--ink-2)',
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              borderRadius: 4, marginTop: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--line-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
