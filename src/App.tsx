import { useTauriEvents } from './hooks/useTauriEvents'
import { useAppUpdater } from './hooks/useAppUpdater'
import { useAppStore } from './store'
import ConnectScreen from './components/ConnectScreen'
import LoadingScreen from './components/LoadingScreen'
import Shell from './components/Shell'
import UpdateBanner from './components/UpdateBanner'

export default function App() {
  useTauriEvents()
  const updater = useAppUpdater()
  const appView = useAppStore(s => s.appView)

  let view: React.ReactNode
  if (appView === 'connect') view = <ConnectScreen />
  else if (appView === 'loading') view = <LoadingScreen />
  else view = <Shell />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <UpdateBanner updater={updater} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {view}
      </div>
    </div>
  )
}
