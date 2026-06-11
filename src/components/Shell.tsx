import TopBar from './TopBar'
import Sidebar from './Sidebar'
import FilterBar from './FilterBar'
import MapPanel from './MapPanel'
import TimelinePanel from './TimelinePanel'
import StatsPanel from './StatsPanel'
import SyncErrorBanner from './SyncErrorBanner'
import { useAppStore } from '../store'

export default function Shell() {
  const panelView = useAppStore(s => s.panelView)

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <TopBar />
      <SyncErrorBanner />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {panelView !== 'stats' && <Sidebar />}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {panelView === 'stats' ? (
            <StatsPanel />
          ) : (
            <>
              <FilterBar />
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <div style={{ flex: '1 1 62%', position: 'relative', padding: 14, borderRight: '1px solid var(--line-2)', minWidth: 0 }}>
                  <MapPanel />
                </div>
                <div style={{ flex: '0 0 380px', minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}>
                  <TimelinePanel />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
