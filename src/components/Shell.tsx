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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 28, minHeight: '100vh',
    }}>
      <div style={{
        width: '100%', maxWidth: 1380, height: 'min(880px, calc(100vh - 56px))',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 24px 60px rgba(40,30,10,0.18)',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}>
        <TopBar />
        <SyncErrorBanner />
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Sidebar />
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
    </div>
  )
}
