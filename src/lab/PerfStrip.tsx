import { useEffect, useState, useSyncExternalStore } from 'react'
import { CLSThresholds, FCPThresholds, INPThresholds, LCPThresholds, TTFBThresholds } from 'web-vitals'
import { useDitherStore, heroTemplates } from '../heroes/dither/ditherStore'
import { vitals, subscribeVitals, countCanvases, longTasksLastSecond, longTaskSupported, heapUsedMB, connection, type VitalName } from './perfMonitor'

export const PERF_STRIP_HEIGHT = 32
const WINDOW_MS = 2000

type Rating = 'good' | 'needs-improvement' | 'poor'
// Scoped exception to lab-* tokens (DESIGN.md, 2026-11-21): each colour has one
// fixed meaning here, good / needs improvement / poor, and lab-accent and
// lab-danger are reserved for "on" and destructive actions.
const tone: Record<Rating, string> = {
  good: 'text-emerald-400',
  'needs-improvement': 'text-amber-300',
  poor: 'text-rose-400',
}
/** Same rule as web-vitals: good up to `good`, poor only above `poor`. */
const rate = (v: number, good: number, poor: number): Rating =>
  v <= good ? 'good' : v <= poor ? 'needs-improvement' : 'poor'

// Frame bands are a lab rule, not a Lighthouse or Core Web Vitals metric. They
// judge against the 60 Hz budget, so a faster screen (120 Hz, 8.3ms frames)
// always reads good and only budget misses turn a cell amber or red.
const BUDGET_MS = 1000 / 60
const FPS_GOOD = 55 // 60 fps with rAF jitter
const FPS_POOR = 30
// A frame longer than 1.5 budgets missed at least one 60 Hz vsync. Past 50ms it
// is a long-task-sized hitch (the Long Tasks API threshold).
const WORST_GOOD_MS = 1.5 * BUDGET_MS
const WORST_POOR_MS = 50
const FRAME_SOURCE = 'Lab rule from the 60 Hz frame budget (16.7ms); 120 Hz screens stay green. Not a Lighthouse or Core Web Vitals metric.'

/** Frame stats over the last 2s from a rAF loop. Mounted only while the strip
 *  is shown, so a hidden strip costs nothing per frame. Publishes at 2Hz —
 *  re-rendering React every frame would itself show up in the numbers. */
function useFrameStats() {
  const [stats, setStats] = useState({ fps: 0, p50: 0, worst: 0 })
  useEffect(() => {
    const frames: { t: number; dt: number }[] = []
    let last = performance.now()
    // rAF stops while the tab is hidden; without a reset the gap would read as
    // one multi-second frame.
    const onVisibility = () => { frames.length = 0; last = performance.now() }
    document.addEventListener('visibilitychange', onVisibility)
    let raf = requestAnimationFrame(function tick(now) {
      frames.push({ t: now, dt: now - last })
      last = now
      while (frames.length && frames[0].t < now - WINDOW_MS) frames.shift()
      raf = requestAnimationFrame(tick)
    })
    const id = setInterval(() => {
      if (frames.length < 2) return
      const dts = frames.map((f) => f.dt).sort((a, b) => a - b)
      const span = frames[frames.length - 1].t - frames[0].t
      setStats({
        fps: span > 0 ? ((frames.length - 1) * 1000) / span : 0,
        p50: dts[Math.floor(dts.length / 2)],
        worst: dts[dts.length - 1],
      })
    }, 500)
    return () => { cancelAnimationFrame(raf); clearInterval(id); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  return stats
}

/** Everything not frame-driven, polled at 2Hz. */
function useSampled() {
  const sample = () => ({ ...countCanvases(), tasks: longTasksLastSecond(), heap: heapUsedMB(), net: connection() })
  const [s, setS] = useState(sample)
  useEffect(() => {
    const id = setInterval(() => setS(sample()), 500)
    return () => clearInterval(id)
  }, [])
  return s
}

function Cell({ label, value, rating, title }: { label: string; value: string; rating?: Rating; title?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 shrink-0" title={title}>
      <dt className="text-lab-fg-subtle">{label}</dt>
      <dd className={`m-0 font-semibold tabular-nums ${rating ? tone[rating] : 'text-lab-fg'}`}>{value}</dd>
    </div>
  )
}

const Sep = () => <span aria-hidden="true" className="w-px h-3.5 bg-lab-border shrink-0" />

const sec = (v: number) => `${(v / 1000).toFixed(2)}s`
const ms = (v: number) => `${Math.round(v)}ms`
const LOAD_ONLY = 'Measured once per page load; switching templates does not re-measure.'
/** Ratings come from web-vitals itself (m.rating), which uses these thresholds. */
const VITALS: { name: VitalName; fmt: (v: number) => string; thresholds: readonly number[]; note: string }[] = [
  { name: 'LCP', fmt: sec, thresholds: LCPThresholds, note: `Core Web Vital. ${LOAD_ONLY}` },
  { name: 'INP', fmt: ms, thresholds: INPThresholds, note: 'Core Web Vital. Slowest interaction so far; shows – until you interact.' },
  { name: 'CLS', fmt: (v) => v.toFixed(3), thresholds: CLSThresholds, note: 'Core Web Vital. Largest burst of layout shifts so far.' },
  { name: 'FCP', fmt: sec, thresholds: FCPThresholds, note: `Diagnostic, not a Core Web Vital. ${LOAD_ONLY}` },
  { name: 'TTFB', fmt: ms, thresholds: TTFBThresholds, note: `Diagnostic, not a Core Web Vital. ${LOAD_ONLY} A local dev server reads faster than production.` },
]
const vitalTitle = ({ name, fmt, thresholds: [good, poor], note }: (typeof VITALS)[number]) =>
  `${name}: green ≤ ${fmt(good)}, amber ≤ ${fmt(poor)}, red > ${fmt(poor)}. ${note} Source: web.dev field thresholds (good / needs improvement / poor). Lighthouse lab scores use other curves and TBT instead of INP.`

/** Live performance strip, docked at the bottom of the viewport. Measures the
 *  TOP document only — Breakpoints and Templates render their previews in
 *  iframes, whose own frames, tasks and contexts are not counted here. */
export default function PerfStrip({ rightOffset, inIframeView }: { rightOffset: number; inIframeView: boolean }) {
  const frame = useFrameStats()
  const s = useSampled()
  // Re-render whenever a vital reports a new value.
  useSyncExternalStore(subscribeVitals, () => VITALS.map((v) => vitals[v.name]?.value ?? '').join('|'))
  const { activeTemplate } = useDitherStore()
  const templateName = heroTemplates.find((t) => t.id === activeTemplate)?.name

  const fpsRating: Rating = frame.fps >= FPS_GOOD ? 'good' : frame.fps >= FPS_POOR ? 'needs-improvement' : 'poor'

  return (
    <section
      aria-label="Performance, this tab"
      className="fixed bottom-0 left-0 z-[1001] border-t border-lab-border bg-lab-toolbar backdrop-blur-xl text-lab-xs text-lab-fg"
      style={{ right: rightOffset, height: PERF_STRIP_HEIGHT }}
    >
      <div className="h-full flex items-center gap-3 px-3 overflow-x-auto whitespace-nowrap">
        <span
          className="font-semibold text-lab-fg shrink-0"
          title={inIframeView ? 'Measures this tab’s top document. The previews here run in iframes and are not counted.' : 'Measures this tab’s top document.'}
        >
          Perf <span className="font-normal text-lab-fg-subtle">this tab{inIframeView ? ', excl. iframes' : ''}</span>
        </span>
        {templateName && <span className="text-lab-fg-subtle shrink-0">{templateName}</span>}
        <Sep />
        <dl className="m-0 flex items-center gap-3">
          <Cell
            label="FPS"
            value={frame.fps.toFixed(0)}
            rating={fpsRating}
            title={`Frames per second over the last 2s. Green ≥ ${FPS_GOOD}, amber ≥ ${FPS_POOR}, red < ${FPS_POOR}. ${FRAME_SOURCE}`}
          />
          <Cell
            label="frame p50"
            value={`${frame.p50.toFixed(1)}ms`}
            rating={rate(frame.p50, 1000 / FPS_GOOD, 1000 / FPS_POOR)}
            title={`Median frame time over the last 2s. Green ≤ ${(1000 / FPS_GOOD).toFixed(1)}ms, amber ≤ ${(1000 / FPS_POOR).toFixed(1)}ms, red above. ${FRAME_SOURCE}`}
          />
          <Cell
            label="worst"
            value={`${frame.worst.toFixed(0)}ms`}
            rating={rate(frame.worst, WORST_GOOD_MS, WORST_POOR_MS)}
            title={`Slowest frame in the last 2s. Green ≤ ${WORST_GOOD_MS.toFixed(0)}ms (no 60 Hz frame dropped), amber ≤ ${WORST_POOR_MS}ms (1–2 dropped), red above (a long-task-sized hitch). ${FRAME_SOURCE}`}
          />
          {longTaskSupported && (
            <Cell
              label="blocked"
              value={`${s.tasks.blockedMs}ms/s`}
              rating={rate(s.tasks.blockedMs, 50, 250)}
              title={`${s.tasks.count} long task(s) in the last second. Blocked = each task's time past its first 50ms, the rule Lighthouse TBT uses. Green ≤ 50ms/s, amber ≤ 250ms/s, red above: a lab rule; TBT itself is summed over page load and Lighthouse calls ≤ 200ms good. Chromium only.`}
            />
          )}
        </dl>
        <Sep />
        <dl className="m-0 flex items-center gap-3">
          {VITALS.map((v) => {
            const { name, fmt } = v
            const m = vitals[name]
            return <Cell key={name} label={name} value={m ? fmt(m.value) : '–'} rating={m?.rating} title={vitalTitle(v)} />
          })}
        </dl>
        <Sep />
        <dl className="m-0 flex items-center gap-3">
          <Cell label="WebGL" value={String(s.webgl)} rating={rate(s.webgl, 8, 15)} title="Live WebGL contexts in this tab, also on detached canvases. Green ≤ 8, amber ≤ 15, red ≥ 16: Chromium keeps about 16 per page (may be fewer on mobile) and loses the oldest past that." />
          <Cell label="canvases" value={String(s.canvases)} title="<canvas> elements in this document. No rating." />
          {s.heap !== undefined && <Cell label="heap" value={`${s.heap.toFixed(0)}MB`} title="JS heap used (Chromium only; may be rounded and cached). No rating." />}
          {s.net && (
            <Cell label="net" value={`${s.net.effectiveType ?? '?'}${s.net.saveData ? ' · save-data' : ''}`} title="Network Information API effective type (Chromium only). No rating." />
          )}
        </dl>
      </div>
    </section>
  )
}
