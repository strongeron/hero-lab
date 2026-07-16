import { useEffect, useRef } from 'react'
import { useTextInspector } from './TextInspectorContext'

/** Compute a DOM path string from heroRoot to the target element (e.g. "0/2/1/0") */
function getDomPath(root: HTMLElement, target: HTMLElement): string | null {
  const indices: number[] = []
  let node: HTMLElement | null = target
  while (node && node !== root) {
    const parent = node.parentElement
    if (!parent) return null
    const idx = Array.from(parent.children).indexOf(node)
    if (idx === -1) return null
    indices.unshift(idx)
    node = parent
  }
  if (node !== root) return null
  return indices.join('/')
}

/** Resolve a DOM path string back to an element */
export function resolvePathToElement(root: HTMLElement, path: string): HTMLElement | null {
  const indices = path.split('/').map(Number)
  let el: HTMLElement = root
  for (const idx of indices) {
    const child = el.children[idx] as HTMLElement | undefined
    if (!child) return null
    el = child
  }
  return el
}

/** Check if an element or its immediate children contain text */
function isTextElement(el: HTMLElement): boolean {
  // Has direct text content
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return true
  }
  // Is a heading, paragraph, span, etc.
  const textTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'LABEL']
  return textTags.includes(el.tagName)
}

/** Walk up from target to find the nearest text-containing element within the root */
function findTextAncestor(root: HTMLElement, target: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = target
  while (el && el !== root) {
    if (isTextElement(el)) return el
    el = el.parentElement
  }
  return null
}

const HIGHLIGHT_OUTLINE = '2px solid rgba(27, 68, 218, 0.7)'
const HIGHLIGHT_RADIUS = '2px'

export function useTextSelection(heroRef: React.RefObject<HTMLElement | null>) {
  const { enabled, select, selectedElement } = useTextInspector()
  const prevSelectedRef = useRef<HTMLElement | null>(null)

  // Manage highlight outline
  useEffect(() => {
    // Remove from previous
    if (prevSelectedRef.current && prevSelectedRef.current !== selectedElement) {
      prevSelectedRef.current.style.outline = ''
      prevSelectedRef.current.style.outlineOffset = ''
      prevSelectedRef.current.style.borderRadius = ''
    }
    // Add to current
    if (selectedElement) {
      selectedElement.style.outline = HIGHLIGHT_OUTLINE
      selectedElement.style.outlineOffset = '2px'
    }
    prevSelectedRef.current = selectedElement
  }, [selectedElement])

  // Clean up highlight on unmount or disable
  useEffect(() => {
    if (!enabled && prevSelectedRef.current) {
      prevSelectedRef.current.style.outline = ''
      prevSelectedRef.current.style.outlineOffset = ''
      prevSelectedRef.current.style.borderRadius = ''
      prevSelectedRef.current = null
    }
  }, [enabled])

  // Click listener on hero root
  useEffect(() => {
    const root = heroRef.current
    if (!root || !enabled) return

    function handleClick(e: MouseEvent) {
      // Don't interfere with links/buttons
      const target = e.target as HTMLElement
      if (target.closest('[data-inspector-panel]')) return

      e.preventDefault()
      e.stopPropagation()

      const textEl = findTextAncestor(root!, target)
      if (!textEl) {
        select(null, null)
        return
      }

      const path = getDomPath(root!, textEl)
      if (!path) {
        select(null, null)
        return
      }

      select(textEl, path)
    }

    root.addEventListener('click', handleClick, true)
    root.style.cursor = 'crosshair'

    return () => {
      root.removeEventListener('click', handleClick, true)
      root.style.cursor = ''
    }
  }, [heroRef, enabled, select])
}
