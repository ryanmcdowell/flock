import { useEffect, type RefObject } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

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
      const win = getCurrentWindow()
      if (e.detail === 2) {
        win.toggleMaximize().catch(err => console.error('[drag] toggleMaximize failed:', err))
        return
      }
      win.startDragging().catch(err => console.error('[drag] startDragging failed:', err))
    }

    // Capture phase so we run before any descendant handler that might stopPropagation.
    el.addEventListener('mousedown', onMouseDown, { capture: true })
    return () => el.removeEventListener('mousedown', onMouseDown, { capture: true })
  }, [ref])
}
