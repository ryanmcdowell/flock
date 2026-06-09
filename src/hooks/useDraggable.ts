import { useEffect, type RefObject } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

// macOS double-click on title bar toggles maximize. We replicate that.
const INTERACTIVE_SELECTOR = 'button, input, a, textarea, select, [role="button"]'

export function useDraggable(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest(INTERACTIVE_SELECTOR)) return
      if (e.detail === 2) {
        getCurrentWindow().toggleMaximize().catch(console.error)
        return
      }
      getCurrentWindow().startDragging().catch(console.error)
    }

    el.addEventListener('mousedown', onMouseDown)
    return () => el.removeEventListener('mousedown', onMouseDown)
  }, [ref])
}
