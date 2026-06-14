import { useCallback, useEffect, useState } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export type UpdaterPhase =
  | { kind: 'idle' }
  | { kind: 'available'; update: Update }
  | { kind: 'downloading'; update: Update; loaded: number; total: number | null }
  | { kind: 'installing'; update: Update }
  | { kind: 'error'; message: string }

export interface UpdaterApi {
  phase: UpdaterPhase
  install: () => void
  dismiss: () => void
}

export function useAppUpdater(): UpdaterApi {
  const [phase, setPhase] = useState<UpdaterPhase>({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    // Check on startup. If there's no update, the call resolves with null and
    // we stay idle (no banner shown).
    check().then(update => {
      if (cancelled) return
      if (update) setPhase({ kind: 'available', update })
    }).catch(err => {
      // Network failure, no published release yet, etc. — fail silently.
      // Don't pop a banner the user can't do anything about.
      console.warn('[updater] check failed:', err)
    })
    return () => { cancelled = true }
  }, [])

  const install = useCallback(() => {
    if (phase.kind !== 'available') return
    const update = phase.update
    let total: number | null = null
    let loaded = 0
    setPhase({ kind: 'downloading', update, loaded: 0, total: null })
    update.downloadAndInstall(event => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength ?? null
          setPhase({ kind: 'downloading', update, loaded: 0, total })
          break
        case 'Progress':
          loaded += event.data.chunkLength
          setPhase({ kind: 'downloading', update, loaded, total })
          break
        case 'Finished':
          setPhase({ kind: 'installing', update })
          break
      }
    })
      .then(() => relaunch())
      .catch(err => {
        console.error('[updater] downloadAndInstall failed:', err)
        setPhase({ kind: 'error', message: String(err) })
      })
  }, [phase])

  const dismiss = useCallback(() => {
    setPhase({ kind: 'idle' })
  }, [])

  return { phase, install, dismiss }
}
