import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'
import type { CheckIn, Prefs, SyncProgress } from '../types'

export function useTauriEvents() {
  const { setCheckins, setPrefs, setAppView, setSyncProgress } = useAppStore()

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined
    let unlistenComplete: (() => void) | undefined

    async function init() {
      // Check auth
      const isAuthed = await invoke<boolean>('check_auth_status')
      if (!isAuthed) { setAppView('connect'); return }

      // Load cached data immediately
      const [checkins, prefs] = await Promise.all([
        invoke<CheckIn[]>('get_checkins'),
        invoke<Prefs>('get_prefs'),
      ])
      setCheckins(checkins)
      setPrefs(prefs)

      // Subscribe to sync events before starting sync
      unlistenProgress = await listen<SyncProgress>('sync-progress', (e) => {
        setSyncProgress(e.payload)
        if (checkins.length === 0) setAppView('loading')
      })

      unlistenComplete = await listen<null>('sync-complete', async () => {
        const updated = await invoke<CheckIn[]>('get_checkins')
        setCheckins(updated)
        setSyncProgress(null)
        setAppView('main')
      })

      // Show main if we already have data, otherwise show loading
      setAppView(checkins.length > 0 ? 'main' : 'loading')

      // Start sync (background)
      invoke('start_sync').catch(console.error)
    }

    init().catch(console.error)

    return () => {
      unlistenProgress?.()
      unlistenComplete?.()
    }
  }, [])
}
