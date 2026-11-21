import { useEffect, useState, useSyncExternalStore } from 'react'
import { useDitherStore, heroTemplates } from '../heroes/dither/ditherStore'
import { vitals, subscribeVitals, countCanvases, longTasksLastSecond, longTaskSupported, heapUsedMB, connection, type VitalName } from './perfMonitor'

export const PERF_STRIP_HEIGHT = 32
const WINDOW_MS = 2000

type Rating = 'good' | 'needs-improvement' | 'poor'
const tone: Record<Rating, string> = {
  good: 'text-emerald-400',
  'needs-improvement': 'text-amber-300',
  poor: 'text-rose-400',
}
const rate = (v: number, good: number, poor: number): Rating =>
  v <= good ? 'good' : v <= poor ? 'needs-improvement' : 'poor'

/** Frame stats over the last 2s from a rAF loop. Mounted only while the strip
 *  is shown, so a hidden strip costs nothing per frame. Publishes at 2Hz —
 *  re-rendering React every frame would itself show up in the numbers. */
function useFrameStats() {
  const [stats, setStats] = useState({ fps: 0, p50: 0, worst: 0 })
  useEffect(() => {
    const frames: { t: number; dt: number }[] = []
    let last = performance.now()
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
    return () => { cancelAnimationFrame(raf); clearInterval(id) }
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
      <dt className="text-white/40">{label}</dt>
      <dd className={`m-0 font-semibold tabular-nums ${rating ? tone[rating] : 'text-white/85'}`}>{value}</dd>
    </div>
  )
}

const Sep = () => <span aria-hidden="true" className="w-px h-3.5 bg-white/10 shrink-0" />

const VITALS: { name: VitalName; fmt: (v: number) => string }[] = [
  { name: 'LCP', fmt: (v) => `${(v / 1000).toFixed(2)}s` },
  { name: 'INP', fmt: (v) => `${Math.round(v)}ms` },
  { name: 'CLS', fmt: (v) => v.toFixed(3) },
  { name: 'FCP', fmt: (v) => `${(v / 1000).toFixed(2)}s` },
  { name: 'TTFB', fmt: (v) => `${Math.round(v)}ms` },
]

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

  const fpsRating: Rating = frame.fps >= 55 ? 'good' : frame.fps >= 30 ? 'needs-improvement' : 'poor'

  return (
    <section
      aria-label="Performance, this tab"
      className="fixed bottom-0 left-0 z-[1001] border-t border-white/10 bg-[rgba(11,12,20,0.94)] backdrop-blur-xl text-[11px] text-white/85"
      style={{ right: rightOffset, height: PERF_STRIP_HEIGHT }}
    >
      <div className="h-full flex items-center gap-3 px-3 overflow-x-auto whitespace-nowrap">
        <span
          className="font-semibold text-white/90 shrink-0"
          title={inIframeView ? 'Measures this tab’s top document. The previews here run in iframes and are not counted.' : 'Measures this tab’s top document.'}
        >
          Perf <span className="font-normal text-white/40">this tab{inIframeView ? ', excl. iframes' : ''}</span>
        </span>
        {templateName && <span className="text-white/40 shrink-0">{templateName}</span>}
        <Sep />
        <dl className="m-0 flex items-center gap-3">
          <Cell label="FPS" value={frame.fps.toFixed(0)} rating={fpsRating} title="Frames per second over the last 2s" />
          <Cell label="frame p50" value={`${frame.p50.toFixed(1)}ms`} rating={rate(frame.p50, 1000 / 55, 1000 / 30)} />
          <Cell label="worst" value={`${frame.worst.toFixed(0)}ms`} rating={rate(frame.worst, 1000 / 55, 1000 / 30)} title="Slowest frame in the last 2s" />
          {longTaskSupported && (
            <Cell
              label="blocked"
              value={`${s.tasks.blockedMs}ms/s`}
              rating={rate(s.tasks.blockedMs, 50, 250)}
              title={`${s.tasks.count} long task(s) in the last second; blocked = time past 50ms per task`}
            />
          )}
        </dl>
        <Sep />
        <dl className="m-0 flex items-center gap-3">
          {VITALS.map(({ name, fmt }) => {
            const m = vitals[name]
            return <Cell key={name} label={name} value={m ? fmt(m.value) : '–'} rating={m?.rating} />
          })}
        </dl>
        <Sep />
        <dl className="m-0 flex items-center gap-3">
          <Cell label="WebGL" value={String(s.webgl)} rating={rate(s.webgl, 8, 15)} title="Live WebGL contexts in this document (browsers cap a page at ~16)" />
          <Cell label="canvases" value={String(s.canvases)} />
          {s.heap !== undefined && <Cell label="heap" value={`${s.heap.toFixed(0)}MB`} title="JS heap used (Chromium only)" />}
          {s.net && (
            <Cell label="net" value={`${s.net.effectiveType ?? '?'}${s.net.saveData ? ' · save-data' : ''}`} />
          )}
        </dl>
      </div>
    </section>
  )
}
