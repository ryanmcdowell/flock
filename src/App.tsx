import { useTauriEvents } from './hooks/useTauriEvents'
import { useAppStore } from './store'
import ConnectScreen from './components/ConnectScreen'
import LoadingScreen from './components/LoadingScreen'
import Shell from './components/Shell'

export default function App() {
  useTauriEvents()
  const appView = useAppStore(s => s.appView)

  if (appView === 'connect') return <ConnectScreen />
  if (appView === 'loading') return <LoadingScreen />
  return <Shell />
}
