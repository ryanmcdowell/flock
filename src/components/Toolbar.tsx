import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'
import FilterChips from './FilterChips'
import SettingsMenu from './SettingsMenu'

export default function Toolbar() {
  const { searchQuery, setSearchQuery, panelView, setPanelView } = useAppStore()

  function handleRefresh() {
    invoke('start_sync').catch(console.error)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
      borderBottom: '1px solid var(--color-border, #e5e7eb)',
      background: 'var(--color-surface, #fff)', flexShrink: 0,
    }}>
      <span style={{ fontWeight: 700, color: '#F4845F', marginRight: '4px' }}>◉ Swarm</span>
      <input
        type="search"
        placeholder="Search check-ins…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{
          flex: 1, padding: '6px 10px', borderRadius: '6px',
          border: '1px solid var(--color-border, #e5e7eb)',
          background: 'var(--color-input-bg, #f9fafb)', fontSize: '14px',
        }}
      />
      <FilterChips />
      <button
        onClick={() => setPanelView(panelView === 'stats' ? 'timeline' : 'stats')}
        aria-label="Stats"
        style={{
          padding: '6px 12px', borderRadius: '6px', fontSize: '13px',
          border: '1px solid var(--color-border, #e5e7eb)',
          background: panelView === 'stats' ? '#F4845F' : 'var(--color-surface, #fff)',
          color: panelView === 'stats' ? '#fff' : 'inherit',
          cursor: 'pointer',
        }}
      >
        Stats
      </button>
      <button onClick={handleRefresh} aria-label="Refresh" style={{
        padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)',
        background: 'var(--color-surface, #fff)', cursor: 'pointer', fontSize: '14px',
      }}>↻</button>
      <SettingsMenu />
    </div>
  )
}
