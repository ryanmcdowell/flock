import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'

export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const { prefs, setPrefs, setAppView, setCheckins } = useAppStore()

  async function handleToggle(key: 'show_categories' | 'show_notes') {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    await invoke('save_prefs', { prefs: updated }).catch(console.error)
  }

  async function handleSignOut() {
    await invoke('sign_out').catch(console.error)
    setCheckins([])
    setAppView('connect')
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Settings"
        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)', background: 'var(--color-surface, #fff)', cursor: 'pointer', fontSize: '14px' }}
      >
        ⚙
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '4px',
          background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '8px', padding: '8px', minWidth: '200px', zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', cursor: 'pointer', fontSize: '14px' }}>
            Show categories
            <input type="checkbox" checked={prefs.show_categories} onChange={() => handleToggle('show_categories')} />
          </label>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', cursor: 'pointer', fontSize: '14px' }}>
            Show notes
            <input type="checkbox" checked={prefs.show_notes} onChange={() => handleToggle('show_notes')} />
          </label>
          <hr style={{ margin: '6px 0', border: 'none', borderTop: '1px solid var(--color-border, #e5e7eb)' }} />
          <button onClick={handleSignOut} style={{ width: '100%', padding: '6px', fontSize: '14px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
