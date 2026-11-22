import type { DitheringShape } from './ditherStore'

/* 2D sketches of the dither field for the Design Panel previews. They are
   approximations of Paper's shapes and the GPU tile field, cheap enough to run
   in a dozen small canvases: whole-pixel tiles, an ordered 4×4 threshold and
   one fill per colour. The hero itself never uses this file. */

export interface SketchLayer { color: string; shape: DitheringShape; opacity: number }

export const SHAPE_FN: Record<DitheringShape, (u: number, v: number, t: number) => number> = {
  simplex: (u, v, t) => 0.5 + 0.25 * (Math.sin(u * 3 + t) * Math.sin(v * 2.3 - t * 0.7) + Math.sin((u + v) * 1.7 + t * 0.5)),
  warp: (u, v, t) => 0.5 + 0.5 * Math.sin(u * 2.5 + 1.6 * Math.sin(v * 2 + t) + t * 0.3),
  dots: (u, v, t) => 0.5 + 0.5 * Math.sin(u * 9 + t) * Math.sin(v * 9 - t * 0.6),
  wave: (u, v, t) => 0.5 + 0.5 * Math.sin(v * 5 + 1.3 * Math.sin(u * 2 + t)),
  ripple: (u, v, t) => 0.5 + 0.5 * Math.sin(Math.hypot(u, v) * 10 - t * 2),
  swirl: (u, v, t) => 0.5 + 0.5 * Math.sin(Math.atan2(v, u) * 3 + Math.hypot(u, v) * 6 - t),
  sphere: (u, v, t) => Math.max(0, Math.min(1, 1.05 - Math.hypot(u - 0.25 * Math.sin(t * 0.4), v - 0.15 * Math.cos(t * 0.3)) * 1.1)),
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }

export interface SketchWarp {
  /** Centre and radius in device px. */
  x: number
  y: number
  r: number
  layers: SketchLayer[]
  rotate: number
  round: number
  jitter: number
}

export interface SketchOpts {
  back: string
  layers: SketchLayer[]
  t: number
  /** Tile pitch and gap in device px (whole numbers). */
  pitch: number
  gap: number
  /** Corner radius as a share of the tile (0 square … 1 circle). */
  round?: number
  /** Pattern zoom: larger shows more of the shape. */
  zoom?: number
  /** Per-layer alpha, to single one layer out. */
  alpha?: number[]
  /** Only tiles with v (−1 top … 1 bottom) below this draw: a top band. */
  bandTo?: number
  warp?: SketchWarp
}

/** Draw one dither field into the whole canvas. */
export function drawField(ctx: CanvasRenderingContext2D, W: number, H: number, o: SketchOpts) {
  const p = Math.max(1, Math.round(o.pitch))
  const g = Math.min(p - 1, Math.max(0, Math.round(o.gap)))
  const size = p - g
  const inset = Math.floor(g / 2)
  const md = Math.min(W, H) / (o.zoom ?? 1.4)
  const cols = Math.ceil(W / p)
  const rows = Math.ceil(H / p)
  const n = o.layers.length
  const rest: number[][] = o.layers.map(() => [])
  const warped: number[] = []
  const w = o.warp
  ctx.globalAlpha = 1
  ctx.fillStyle = o.back
  ctx.fillRect(0, 0, W, H)
  for (let iy = 0; iy < rows; iy++) {
    const y0 = iy * p
    const v = (y0 + p / 2 - H / 2) / md
    if (o.bandTo != null && (y0 + p / 2) / H > o.bandTo) break
    for (let ix = 0; ix < cols; ix++) {
      const x0 = ix * p
      const u = (x0 + p / 2 - W / 2) / md
      const thr = BAYER[(iy & 3) * 4 + (ix & 3)]
      const d = w ? Math.hypot(x0 + p / 2 - w.x, y0 + p / 2 - w.y) : Infinity
      const inWarp = w != null && d < w.r
      const layers = inWarp ? w.layers : o.layers
      let ci = -1
      for (let k = 0; k < layers.length; k++) {
        if (SHAPE_FN[layers[k].shape](u, v, o.t + k * 1.7) * layers[k].opacity > thr) ci = k
      }
      if (ci < 0) continue
      if (inWarp) warped.push(x0 + p / 2, y0 + p / 2, ci, d / w.r, ix, iy)
      else rest[ci].push(x0 + inset, y0 + inset)
    }
  }
  const rad = (o.round ?? 0) * size / 2
  for (let k = 0; k < n; k++) {
    const a = rest[k]
    if (!a.length) continue
    ctx.globalAlpha = o.alpha?.[k] ?? 1
    ctx.fillStyle = o.layers[k].color
    ctx.beginPath()
    for (let i = 0; i < a.length; i += 2) {
      if (rad >= 0.5) ctx.roundRect(a[i], a[i + 1], size, size, rad)
      else ctx.rect(a[i], a[i + 1], size, size)
    }
    ctx.fill()
  }
  ctx.globalAlpha = 1
  if (!w || !warped.length) return
  for (let k = 0; k < w.layers.length; k++) {
    ctx.fillStyle = w.layers[k].color
    ctx.beginPath()
    for (let i = 0; i < warped.length; i += 6) {
      if (warped[i + 2] !== k) continue
      const cx = warped[i], cy = warped[i + 1], nd = warped[i + 3]
      const j = hash(warped[i + 4], warped[i + 5])
      const s = Math.max(1, Math.round(size * (1 + 0.3 * (1 - nd)) * (1 - Math.min(1, w.jitter / 1.5) * j * 0.6)))
      const r = Math.min(1, w.round) * s / 2
      const ang = (w.rotate * (1 - nd)) * Math.PI / 180
      if (ang === 0) {
        const x = Math.round(cx - s / 2), y = Math.round(cy - s / 2)
        if (r >= 0.5) ctx.roundRect(x, y, s, s, r)
        else ctx.rect(x, y, s, s)
      } else {
        const c = Math.cos(ang), sn = Math.sin(ang), hs = s / 2
        const pts: [number, number][] = [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]]
        pts.forEach(([px, py], idx) => {
          const X = cx + px * c - py * sn, Y = cy + px * sn + py * c
          if (idx === 0) ctx.moveTo(X, Y)
          else ctx.lineTo(X, Y)
        })
        ctx.closePath()
      }
    }
    ctx.fill()
  }
}

/** A looping pointer path inside a W×H box (device px). */
export function loopPointer(t: number, W: number, H: number) {
  return { x: W * (0.5 + 0.32 * Math.sin(t * 0.9)), y: H * (0.5 + 0.28 * Math.sin(t * 1.4 + 0.6)) }
}
