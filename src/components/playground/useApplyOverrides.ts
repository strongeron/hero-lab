import { useEffect } from 'react'
import { useTextInspector } from './TextInspectorContext'
import { resolvePathToElement } from './useTextSelection'

const OVERRIDE_PROPS = [
  'font-family',
  'font-weight',
  'font-size',
  'line-height',
  'letter-spacing',
  'font-style',
  'text-transform',
  'color',
] as const

export function useApplyOverrides(heroRef: React.RefObject<HTMLElement | null>) {
  const { overrides, activeVariant, enabled } = useTextInspector()

  useEffect(() => {
    const root = heroRef.current
    if (!root) return

    function applyAll() {
      const root = heroRef.current
      if (!root) return

      for (const [path, props] of Object.entries(overrides)) {
        const el = resolvePathToElement(root, path)
        if (!el) continue
        for (const prop of OVERRIDE_PROPS) {
          if (props[prop]) {
            el.style.setProperty(prop, props[prop], 'important')
          } else {
            el.style.removeProperty(prop)
          }
        }
      }
    }

    // Apply immediately
    applyAll()

    // Re-apply after DOM changes (AnimatePresence re-mounts)
    const observer = new MutationObserver(() => {
      // Small delay to let React finish rendering
      requestAnimationFrame(applyAll)
    })

    observer.observe(root, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      // Clean up all overrides from DOM
      for (const [path] of Object.entries(overrides)) {
        const el = resolvePathToElement(root, path)
        if (!el) continue
        for (const prop of OVERRIDE_PROPS) {
          el.style.removeProperty(prop)
        }
      }
    }
  }, [heroRef, overrides, activeVariant, enabled])
}
