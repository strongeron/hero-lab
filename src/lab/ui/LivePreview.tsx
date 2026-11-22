import { useEffect, useRef } from 'react'

/** Draw callback: device-pixel canvas size and the entry's own clock (s). */
export type PreviewDraw = (ctx: CanvasRenderingContext2D, t: number, w: number, h: number, dpr: number) => void

interface Entry {
  draw: () => void
  visible: boolean
  rate: number
  t: number
}

/* One requestAnimationFrame loop for every preview on the page. It runs only
   while at least one visible preview animates, so a closed or scrolled-away
   panel costs nothing. Each preview is a small 2D canvas, never a WebGL
   context (the page keeps one GPU context for the hero). */
const entries = new Set<Entry>()
let raf = 0
let last = 0
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function tick(now: number) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
  last = now
  let any = false
  for (const e of entries) {
    if (!e.visible || e.rate === 0) continue
    any = true
    e.t += dt * e.rate
    e.draw()
  }
  raf = any ? requestAnimationFrame(tick) : 0
  if (!any) last = 0
}
function wake() {
  if (!raf && !reduced) raf = requestAnimationFrame(tick)
}

/** A small live canvas that shows what a setting does. `rate` scales its clock
 *  (0 = a still frame); reduced motion always shows a still frame. Redraws on
 *  every render, so a paused preview still follows the settings. */
export default function LivePreview({ draw, rate = 1, className = '' }: {
  draw: PreviewDraw
  rate?: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const entryRef = useRef<Entry | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let dpr = 1
    const entry: Entry = {
      visible: false,
      rate: 0,
      t: 1.3, // a still frame with some structure, not the t = 0 symmetry
      draw: () => drawRef.current(ctx, entry.t, canvas.width, canvas.height, dpr),
    }
    entryRef.current = entry
    entries.add(entry)
    const ro = new ResizeObserver(([r]) => {
      dpr = Math.min(2, Math.round(devicePixelRatio || 1))
      canvas.width = Math.max(1, Math.round(r.contentRect.width * dpr))
      canvas.height = Math.max(1, Math.round(r.contentRect.height * dpr))
      entry.draw()
    })
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => {
      entry.visible = e.isIntersecting
      if (entry.visible) wake()
    })
    io.observe(canvas)
    return () => {
      ro.disconnect()
      io.disconnect()
      entries.delete(entry)
      entryRef.current = null
    }
  }, [])

  useEffect(() => {
    const entry = entryRef.current
    if (!entry) return
    entry.rate = reduced ? 0 : rate
    entry.draw()
    if (entry.rate) wake()
  })

  return <canvas ref={ref} aria-hidden className={`block pointer-events-none select-none [image-rendering:pixelated] ${className}`} />
}
