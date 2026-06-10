import { useEffect } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'
import type { CheckIn, Prefs, SyncProgress, UserProfile } from '../types'

async function refreshUserProfile() {
  try {
    const profile = await invoke<UserProfile>('fetch_user_profile')
    useAppStore.getState().setUserProfile(profile)
  } catch (e) {
    console.error('fetch_user_profile failed:', e)
  }
}

export async function loadCachedAndSync() {
  const { setCheckins, setPrefs, setAppView, setSyncError } = useAppStore.getState()
  setSyncError(null)
  const [checkins, prefs] = await Promise.all([
    invoke<CheckIn[]>('get_checkins'),
    invoke<Prefs>('get_prefs'),
  ])
  setCheckins(checkins)
  setPrefs(prefs)
  setAppView(checkins.length > 0 ? 'main' : 'loading')
  // Fire-and-forget — UI doesn't block on the avatar.
  refreshUserProfile()
  invoke('start_sync').catch((e) => {
    console.error('start_sync failed:', e)
    useAppStore.getState().setSyncError(String(e))
  })
}

export function useTauriEvents() {
  useEffect(() => {
    let unlistenProgress: UnlistenFn | undefined
    let unlistenComplete: UnlistenFn | undefined

    async function init() {
      const { setAppView, setSyncProgress, setCheckins } = useAppStore.getState()

      // Attach listeners before any auth check so a sync started later
      // (e.g., after fresh OAuth) is observed.
      unlistenProgress = await listen<SyncProgress>('sync-progress', (e) => {
        setSyncProgress(e.payload)
        if (useAppStore.getState().checkins.length === 0) setAppView('loading')
      })

      unlistenComplete = await listen<null>('sync-complete', async () => {
        const updated = await invoke<CheckIn[]>('get_checkins')
        setCheckins(updated)
        setSyncProgress(null)
        useAppStore.getState().setSyncError(null)
        setAppView('main')
      })

      const isAuthed = await invoke<boolean>('check_auth_status')
      if (!isAuthed) {
        setAppView('connect')
        return
      }

      await loadCachedAndSync()
    }

    init().catch(console.error)

    return () => {
      unlistenProgress?.()
      unlistenComplete?.()
    }
  }, [])
}
