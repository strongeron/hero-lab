/** Page-wide performance probes for the PerfStrip. Imported first in main.tsx
 *  so the getContext wrapper is in place before any shader asks for a context,
 *  and so the buffered observers start at load rather than when the strip is
 *  first opened. Everything here is passive: the strip's rAF loop is the only
 *  per-frame cost, and it runs only while the strip is shown. */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'

// ── WebGL context census ────────────────────────────────────────────────────
// Browsers cap a page at ~16 live WebGL contexts and fail silently past it
// (see docs/architecture.md), so the count is worth seeing. Kept on globalThis
// so a Vite HMR re-run neither wraps getContext twice nor forgets canvases.
type GLContext = WebGLRenderingContext | WebGL2RenderingContext
const g = globalThis as { __heroLabGL?: WeakMap<HTMLCanvasElement, GLContext> }
if (!g.__heroLabGL) {
  const glCanvases = new WeakMap<HTMLCanvasElement, GLContext>()
  g.__heroLabGL = glCanvases
  const original = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const ctx = Reflect.apply(original, this, [type, ...rest]) as RenderingContext | null
    if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
      glCanvases.set(this, ctx as GLContext)
    }
    return ctx
  } as typeof original
}
const glCanvases = g.__heroLabGL

/** Canvases in this document, and how many hold a WebGL context that is not lost. */
export function countCanvases() {
  const all = document.querySelectorAll('canvas')
  let webgl = 0
  for (const c of all) {
    const ctx = glCanvases.get(c)
    if (ctx && !ctx.isContextLost()) webgl++
  }
  return { canvases: all.length, webgl }
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
const longTasks: { end: number; blocking: number }[] = []
export const longTaskSupported = typeof PerformanceObserver !== 'undefined'
  && PerformanceObserver.supportedEntryTypes?.includes('longtask')

/** Long tasks that ended in the last second, and their total blocking time
 *  (the part of each task past 50ms — the same rule TBT uses). */
export function longTasksLastSecond(now = performance.now()) {
  while (longTasks.length && longTasks[0].end < now - 5000) longTasks.shift()
  let count = 0
  let blockedMs = 0
  for (const t of longTasks) {
    if (t.end >= now - 1000) { count++; blockedMs += t.blocking }
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
        longTasks.push({ end: e.startTime + e.duration, blocking: Math.max(0, e.duration - 50) })
      }
    }).observe({ type: 'longtask', buffered: true })
  }
}

// ── Environment ─────────────────────────────────────────────────────────────
/** Chromium only; undefined elsewhere so the strip can hide the cell. */
export function heapUsedMB() {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return mem ? mem.usedJSHeapSize / 1048576 : undefined
}

/** Network Information API (Chromium only). */
export function connection() {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection
  return c ? { effectiveType: c.effectiveType, saveData: !!c.saveData } : undefined
}
