import Toolbar from './Toolbar'
import MapPanel from './MapPanel'
import TimelinePanel from './TimelinePanel'
import StatsPanel from './StatsPanel'
import SyncErrorBanner from './SyncErrorBanner'
import { useAppStore } from '../store'

export default function Shell() {
  const panelView = useAppStore(s => s.panelView)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <SyncErrorBanner />
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: '0 0 60%', position: 'relative' }}>
          <MapPanel />
        </div>
        <div style={{ flex: '0 0 40%', overflow: 'hidden', borderLeft: '1px solid var(--color-border, #e5e7eb)' }}>
          {panelView === 'timeline' ? <TimelinePanel /> : <StatsPanel />}
        </div>
      </div>
    </div>
  )
}
