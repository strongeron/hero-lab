/** Page-wide performance probes for the PerfStrip. Imported first in main.tsx
 *  so the getContext wrapper is in place before any shader asks for a context,
 *  and so the buffered observers start at load rather than when the strip is
 *  first opened. Everything here is passive: the strip's rAF loop is the only
 *  per-frame cost, and it runs only while the strip is shown. */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'

// ── WebGL context census ────────────────────────────────────────────────────
// Browsers cap a page at ~16 live WebGL contexts and fail silently past it
// (see docs/architecture.md), so the count is worth seeing. The cap counts every
// live context, also one whose canvas was never attached or was removed but not
// yet collected, so the census tracks contexts, not canvases in the DOM. Weak
// refs let the GC drop them. Kept on globalThis so a Vite HMR re-run neither
// wraps getContext twice nor forgets contexts.
type GLContext = WebGLRenderingContext | WebGL2RenderingContext
const g = globalThis as { __heroLabGLContexts?: { seen: WeakSet<GLContext>; refs: Set<WeakRef<GLContext>> } }
if (!g.__heroLabGLContexts) {
  const census = { seen: new WeakSet<GLContext>(), refs: new Set<WeakRef<GLContext>>() }
  g.__heroLabGLContexts = census
  const original = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const ctx = Reflect.apply(original, this, [type, ...rest]) as RenderingContext | null
    if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') && !census.seen.has(ctx as GLContext)) {
      census.seen.add(ctx as GLContext)
      census.refs.add(new WeakRef(ctx as GLContext))
    }
    return ctx
  } as typeof original
}
const glCensus = g.__heroLabGLContexts

/** Canvases in this document, and live (not lost, not collected) WebGL contexts
 *  in this tab, attached or not. */
export function countCanvases() {
  let webgl = 0
  for (const ref of glCensus.refs) {
    const ctx = ref.deref()
    if (!ctx) glCensus.refs.delete(ref)
    else if (!ctx.isContextLost()) webgl++
  }
  return { canvases: document.querySelectorAll('canvas').length, webgl }
}

// Preview iframes load the same bundle. They keep the context census (cheap,
// and harmless) but skip the observers — the strip only ever reads the top tab.
const isPreviewFrame = new URLSearchParams(window.location.search).get('preview') === '1'

// ── Core Web Vitals ─────────────────────────────────────────────────────────
export type VitalName = Metric['name']
export const vitals: Partial<Record<VitalName, Metric>> = {}
const listeners = new Set<() => void>()
export function subscribeVitals(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
const report = (m: Metric) => {
  vitals[m.name] = m
  listeners.forEach((fn) => fn())
}

// ── Long tasks ──────────────────────────────────────────────────────────────
const longTasks: { start: number; end: number }[] = []
export const longTaskSupported = typeof PerformanceObserver !== 'undefined'
  && PerformanceObserver.supportedEntryTypes?.includes('longtask')

/** Long tasks that overlap the last second, and their blocking time inside that
 *  second (the part of each task past its first 50ms, the rule TBT uses). Only
 *  the part inside the window counts, so the total never passes 1000ms/s. */
export function longTasksLastSecond(now = performance.now()) {
  while (longTasks.length && longTasks[0].end < now - 5000) longTasks.shift()
  const from = now - 1000
  let count = 0
  let blockedMs = 0
  for (const t of longTasks) {
    if (t.end < from) continue
    count++
    blockedMs += Math.max(0, Math.min(t.end, now) - Math.max(t.start + 50, from))
  }
  return { count, blockedMs: Math.round(blockedMs) }
}

if (!isPreviewFrame) {
  onLCP(report, { reportAllChanges: true })
  onINP(report, { reportAllChanges: true })
  onCLS(report, { reportAllChanges: true })
  onFCP(report, { reportAllChanges: true })
  onTTFB(report, { reportAllChanges: true })
  if (longTaskSupported) {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks.push({ start: e.startTime, end: e.startTime + e.duration })
      }
    }).observe({ type: 'longtask', buffered: true })
  }
}

// ── Environment ─────────────────────────────────────────────────────────────
/** Chromium only; undefined elsewhere so the strip can hide the cell. Without
 *  --enable-precise-memory-info Chrome may round and cache this value. */
export function heapUsedMB() {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return mem ? mem.usedJSHeapSize / 1048576 : undefined
}

/** Network Information API (Chromium only). */
export function connection() {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection
  return c ? { effectiveType: c.effectiveType, saveData: !!c.saveData } : undefined
}
