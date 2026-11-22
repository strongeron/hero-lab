import type { DitheringShape, WarpMode } from './ditherStore'
import { morphShape, roamPose } from './roam'

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
  /** Shape centre above the canvas centre, as a share of H (the hero's
   *  shapeLift: centred shapes sit mid-band, not behind the copy). */
  lift?: number
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
    const v = (y0 + p / 2 - H / 2 + (o.lift ?? 0) * H) / md
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

/** A warp preview for a mode, in a W×H box: Hover follows the looping
 *  pointer; Roam follows the hero's roam path (sped up to read in a small
 *  box) with a breathing radius and a morphing shape; Both hands over between
 *  the two every few seconds. `r` is the radius at rest. */
export function previewWarp<S extends { rotate: number; round: number }>(mode: WarpMode, t: number, W: number, H: number, r: number, shape: S): { x: number; y: number; r: number } & S {
  if (mode === 'hover') return { ...loopPointer(t, W, H), r, ...shape }
  const p = roamPose(t * 3)
  // Both: 0 = roaming, 1 = on the pointer, eased in and out.
  const f = mode === 'both' ? 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, Math.sin(t * 0.7) * 2))) : 0
  const lp = loopPointer(t, W, H)
  const rx = W * (0.1 + 0.8 * p.x), ry = H * (0.1 + 0.8 * p.y)
  const m = morphShape({ ...shape, scale: 1 }, p, 1 - f)
  return { ...shape, rotate: m.rotate, round: m.round, x: rx + (lp.x - rx) * f, y: ry + (lp.y - ry) * f, r: r * (p.breath + (1 - p.breath) * f) }
}

/* ── Paper-faithful sketch ──
   The Shape and Grid previews use Paper's own shape maths (Dithering shader,
   @paper-design/shaders) in hero CSS px, so a preview shows the same pattern
   at the same scale and pace as the hero, only smaller. */

// 2D simplex noise (Ashima / Gustavson), the same function Paper uses.
const mod289 = (x: number) => x - Math.floor(x / 289) * 289
const permute = (x: number) => mod289((x * 34 + 1) * x)
function snoise(x: number, y: number) {
  const C0 = 0.211324865405187, C1 = 0.366025403784439, C2 = -0.577350269189626, C3 = 0.024390243902439
  const s = (x + y) * C1
  let ix = Math.floor(x + s), iy = Math.floor(y + s)
  const t = (ix + iy) * C0
  const x0 = x - ix + t, y0 = y - iy + t
  const i1x = x0 > y0 ? 1 : 0, i1y = x0 > y0 ? 0 : 1
  const x1 = x0 + C0 - i1x, y1 = y0 + C0 - i1y
  const x2 = x0 + C2, y2 = y0 + C2
  ix = mod289(ix); iy = mod289(iy)
  const p0 = permute(permute(iy) + ix), p1 = permute(permute(iy + i1y) + ix + i1x), p2 = permute(permute(iy + 1) + ix + 1)
  let n = 0
  for (const [p, dx, dy] of [[p0, x0, y0], [p1, x1, y1], [p2, x2, y2]] as const) {
    let m = Math.max(0.5 - dx * dx - dy * dy, 0)
    m = m * m; m = m * m
    const fx = 2 * ((p * C3) % 1 + ((p * C3) % 1 < 0 ? 1 : 0)) - 1
    const h = Math.abs(fx) - 0.5
    const a0 = fx - Math.floor(fx + 0.5)
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h)
    n += m * (a0 * dx + h * dy)
  }
  return 130 * n
}
const fract = (x: number) => x - Math.floor(x)
const hash11 = (p: number) => { p = fract(p * 0.3183099) + 0.1; p *= p + 19.19; return fract(p * p) }
const smooth = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k) }

/** Paper's shape value (0…1) at a hero point. x, y: CSS px from the hero
 *  centre, y up. W, H: hero size. t: Paper time (0.5 × u_time). */
export function paperShape(shape: DitheringShape, x: number, y: number, t: number, W: number, H: number, scale: number, rotation: number): number {
  const r = rotation * Math.PI / 180, c = Math.cos(r), s = Math.sin(r)
  const pattern = shape === 'simplex' || shape === 'warp' || shape === 'dots'
  // Pattern shapes: CSS px × (min / max) for fit cover; object shapes: ÷ max side.
  const k = pattern ? Math.min(W, H) / Math.max(W, H) : 1 / Math.max(W, H)
  let u = (x * k) / scale, v = (y * k) / scale
  ;[u, v] = [c * u + s * v, -s * u + c * v]
  if (pattern) { u += 0.5; v += 0.5 }
  switch (shape) {
    case 'simplex': {
      u *= 0.001; v *= 0.001
      const n = 0.5 * snoise(u, v - 0.3 * t) + 0.5 * snoise(2 * u, 2 * v + 0.32 * t)
      return smooth(0.3, 0.9, 0.5 + 0.5 * n)
    }
    case 'warp': {
      u *= 0.003; v *= 0.003
      for (let i = 1; i < 6; i++) {
        u += 0.6 / i * Math.cos(i * 2.5 * v + t)
        v += 0.6 / i * Math.cos(i * 1.5 * u + t)
      }
      return smooth(0.02, 1, 0.15 / Math.max(0.001, Math.abs(Math.sin(t - v - u))))
    }
    case 'dots': {
      u *= 0.05; v *= 0.05
      const idx = Math.floor(2 * u / (2 * Math.PI))
      let rnd = hash11(idx * 10)
      rnd = Math.sign(rnd - 0.5) * Math.pow(0.1 + Math.abs(rnd), 0.4)
      return Math.pow(Math.abs(Math.sin(u) * Math.cos(v - 5 * rnd * t)), 6)
    }
    case 'wave': {
      u *= 4; v *= 4
      const wave = Math.cos(0.5 * u - 2 * t) * Math.sin(1.5 * u + t) * (0.75 + 0.25 * Math.cos(3 * t))
      return 1 - smooth(-1, 1, v + wave)
    }
    case 'ripple': return Math.sin(Math.pow(Math.hypot(u, v), 1.7) * 7 - 3 * t) * 0.5 + 0.5
    case 'swirl': {
      const l = Math.max(Math.hypot(u, v), 1e-6)
      const offset = 1 / Math.pow(l, 1.2) + (6 * Math.atan2(v, u) + 4 * t) / (2 * Math.PI)
      return smooth(0, 1, Math.pow(l, 1.2)) * fract(offset)
    }
    case 'sphere': {
      u *= 2; v *= 2
      const d = 1 - (u * u + v * v)
      if (d < 0) return 0
      const lx = Math.cos(1.5 * t), ly = 0.8, lz = Math.sin(1.25 * t), ln = Math.hypot(lx, ly, lz)
      return 0.5 + 0.5 * (lx * u + ly * v + lz * Math.sqrt(d)) / ln
    }
  }
}

const BAYER8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((n) => n / 64)
const rgb = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }

export interface HeroSketch {
  back: string
  layers: SketchLayer[]
  /** Paper time. */
  t: number
  scale: number
  rotation: number
  /** shader.alphaSpread: each layer's small offset. */
  spread: number
  /** Hero size the preview stands for (CSS px). */
  heroW: number
  heroH: number
  /** Preview px per hero CSS px (1 = true size). */
  zoom: number
  /** Hero point at the preview centre (CSS px from the hero centre, y up). */
  cx?: number
  cy?: number
  /** Tile pitch, gap and corner radius in hero CSS px. */
  pitch: number
  gap: number
  radius: number
  /** Draw only whole tiles, centred: no tile is cut at the edge. */
  whole?: boolean
  /** Shape centre above the hero centre, in hero CSS px (the hero's
   *  shapeLift: centred shapes sit mid-band, not behind the copy). */
  lift?: number
}

/** Draw the hero as Paper composes it: one dither cell per tile, Bayer 8×8,
 *  every layer screen-blended at its opacity. W, H in device px; dpr maps
 *  CSS px to device px. */
export function drawHero(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, o: HeroSketch) {
  // Tile pitch in device px. A scaled-down preview of a fine grid samples
  // coarser cells: at least 2 px, and at most ~4000 cells per canvas.
  const pd = Math.max(2, Math.sqrt((W * H) / 4000), o.pitch * o.zoom * dpr)
  const gd = pd >= 3 ? Math.min(pd - 1, Math.round(o.gap * o.zoom * dpr)) : 0
  const cols = o.whole ? Math.max(1, Math.floor(W / pd)) : Math.ceil(W / pd) + 1
  const rows = o.whole ? Math.max(1, Math.floor(H / pd)) : Math.ceil(H / pd) + 1
  const ox = o.whole ? Math.round((W - cols * pd) / 2) : Math.round(W / 2 - Math.ceil(W / 2 / pd) * pd)
  const oy = o.whole ? Math.round((H - rows * pd) / 2) : Math.round(H / 2 - Math.ceil(H / 2 / pd) * pd)
  const n = o.layers.length
  const groups = new Map<number, number[]>()
  const M = Math.max(o.heroW, o.heroH)
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const px = ox + (ix + 0.5) * pd, py = oy + (iy + 0.5) * pd
      const hx = (o.cx ?? 0) + (px - W / 2) / (o.zoom * dpr)
      const hy = (o.cy ?? 0) - (py - H / 2) / (o.zoom * dpr)
      const thr = 1 - BAYER8[(iy & 7) * 8 + (ix & 7)]
      let mask = 0
      for (let k = 0; k < n; k++) {
        const l = o.layers[k]
        if (l.opacity <= 0) continue
        const sp = o.spread * k
        if (paperShape(l.shape, hx - sp * 2 * M, hy - (o.lift ?? 0) + sp * 1.5 * M, o.t, o.heroW, o.heroH, o.scale, o.rotation) >= thr) mask |= 1 << k
      }
      if (!mask) continue
      let a = groups.get(mask)
      if (!a) groups.set(mask, (a = []))
      a.push(Math.round(ox + ix * pd + gd / 2), Math.round(oy + iy * pd + gd / 2), Math.round(ox + (ix + 1) * pd - gd / 2), Math.round(oy + (iy + 1) * pd - gd / 2))
    }
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = o.back
  ctx.fillRect(0, 0, W, H)
  const back = rgb(o.back)
  const rad = o.radius * o.zoom * dpr
  for (const [mask, a] of groups) {
    // Screen blend of the lit layers over the back: 1 − Π(1 − c·α).
    const out = back.map((b, ch) => {
      let inv = 1 - b / 255
      for (let k = 0; k < n; k++) if (mask & (1 << k)) inv *= 1 - (rgb(o.layers[k].color)[ch] / 255) * o.layers[k].opacity
      return Math.round((1 - inv) * 255)
    })
    ctx.fillStyle = `rgb(${out[0]} ${out[1]} ${out[2]})`
    ctx.beginPath()
    for (let i = 0; i < a.length; i += 4) {
      const w = a[i + 2] - a[i], h = a[i + 3] - a[i + 1]
      if (w <= 0 || h <= 0) continue
      if (rad >= 0.5 && w > 2) ctx.roundRect(a[i], a[i + 1], w, h, Math.min(rad, w / 2))
      else ctx.rect(a[i], a[i + 1], w, h)
    }
    ctx.fill()
  }
}

/* ── GPU point field, ported from tileField.ts (TILE_FRAG fieldDot) ──
   Templates on the GPU path (Point sizes) never use the layer shapes: each dot
   takes its size, alpha and colour from the tile field's own noise. Previews
   of those templates draw this port so they move like the hero, on the same
   clock (field time = maskAnimT, colour phase = colorPhase). */
const u32 = (n: number) => n >>> 0
function tileHash(cx: number, cy: number, seed: number) {
  let h = u32(Math.imul(cx, 374761393) + Math.imul(cy, 668265263) + Math.imul(seed, 2246822519 | 0))
  h = u32(Math.imul(h ^ (h >>> 13), 1274126177))
  return u32(h ^ (h >>> 16)) / 4294967296
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
function valueNoise(x: number, y: number, seed: number) {
  const fx = Math.floor(x), fy = Math.floor(y)
  const ux = fade(x - fx), uy = fade(y - fy)
  const a = tileHash(fx, fy, seed), b = tileHash(fx + 1, fy, seed)
  const c = tileHash(fx, fy + 1, seed), d = tileHash(fx + 1, fy + 1, seed)
  return a + (b - a) * ux + (c - a + (a - b - c + d) * ux) * uy
}
const fbm = (x: number, y: number, t: number, seed: number) =>
  valueNoise(x + t * 0.4, y + t * 0.25, seed) * 0.55
  + valueNoise(x * 2.1 + t * 0.7, y * 2.1, seed + 1) * 0.3
  + valueNoise(x * 4.3, y * 4.3 + t * 0.35, seed + 2) * 0.15
const easeIO = (t: number) => t * t * (3 - 2 * t)

export interface PointFieldOpts {
  back: string
  layers: { color: string; opacity: number }[]
  /** Field time and colour phase, as the hero's tile frame. */
  t: number
  phase: number
  /** Tile pitch and gap in device px; dot size scales the hero's piece. */
  pitch: number
  gap: number
  /** animation.tileSizeSpread / tileSizeContrast / tileSizeNoise. */
  spread: number
  contrast: number
  mapScale: number
}

export function drawPointField(ctx: CanvasRenderingContext2D, W: number, H: number, o: PointFieldOpts) {
  ctx.globalAlpha = 1
  ctx.fillStyle = o.back
  ctx.fillRect(0, 0, W, H)
  const layers = o.layers.filter((l) => l.opacity > 0)
  const n = layers.length
  if (!n) return
  const p = Math.max(2, o.pitch)
  const cols = Math.floor(W / p), rows = Math.floor(H / p)
  const ox = (W - cols * p) / 2, oy = (H - rows * p) / 2
  const width = Math.min(3, Math.max(0.4, o.mapScale))
  const k = Math.min(1, Math.max(0, o.contrast))
  const spread = Math.min(1, Math.max(0, o.spread)) * 0.65
  const maxPiece = p - Math.min(p - 1, Math.max(0, o.gap))
  let minScale = spread <= 0 ? 1 : Math.max(o.gap / Math.max(1, maxPiece), 1 - spread)
  if (spread > 0) minScale *= 1 - k
  const cols3 = layers.map((l) => rgb(l.color))
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const organic = fbm(ix * (0.095 / width), iy * (0.095 / width), o.t * 0.8, 2401)
      const wave = 0.5 + 0.5 * Math.sin(ix * 0.33 + iy * 0.21 + o.t * Math.PI * 2 * 0.55)
      const ww = 0.28 + 0.27 * k
      let v = Math.min(1, Math.max(0, organic * (1 - ww) + wave * ww))
      v = Math.min(1, Math.max(0, (v - 0.5) * (1 + 3 * k) + 0.5))
      const floorV = 0.18 * (1 - k)
      const sizeV = floorV + (1 - floorV) * easeIO(v)
      const piece = maxPiece * (minScale + (1 - minScale) * sizeV)
      if (piece < 0.5) continue
      const an = fbm(ix * (0.08 / width) + 19, iy * (0.08 / width) - 7, o.t * 0.55, 3119)
      const aw = 0.5 + 0.5 * Math.sin(ix * 0.16 - iy * 0.27 + o.t * Math.PI * 1.2)
      const alphaV = Math.min(1, Math.max(0, an * 0.65 + aw * 0.35))
      const pos = ((tileHash(ix, iy, 701) * n + o.phase * n) % n + n) % n
      const li = Math.floor(pos), ni = li + 1 === n ? 0 : li + 1
      const m = easeIO(pos - li)
      const c = cols3[li].map((ch, j) => Math.round(ch + (cols3[ni][j] - ch) * m))
      const op = layers[li].opacity + (layers[ni].opacity - layers[li].opacity) * m
      ctx.globalAlpha = Math.min(0.95, (0.28 + alphaV * 0.72) * op)
      ctx.fillStyle = `rgb(${c[0]} ${c[1]} ${c[2]})`
      ctx.beginPath()
      ctx.arc(ox + (ix + 0.5) * p, oy + (iy + 0.5) * p, piece / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

export interface SketchRect { x: number; y: number; w: number; h: number }

/** Centered copy at thumbnail size, device px: two headline lines, the sub
 *  and the CTA, in the middle (Layout previews, Recipe thumbnails). */
export function centredCopyLines(W: number, H: number): SketchRect[] {
  const r = (x: number, y: number, w: number, h: number) => ({ x: Math.round(W * x), y: Math.round(H * y), w: Math.round(W * w), h: Math.max(2, Math.round(H * h)) })
  return [r(0.2, 0.24, 0.6, 0.12), r(0.3, 0.39, 0.4, 0.12), r(0.33, 0.57, 0.34, 0.05), r(0.42, 0.68, 0.16, 0.1)]
}

/** One bounding box round all `rects` ('box' text rects). */
export function boundingRect(rects: SketchRect[]): SketchRect {
  const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y))
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y }
}

export interface ClearanceOpts {
  back: string
  /** Tile pitch and the lattice origin, device px. */
  pitch: number
  ox?: number
  oy?: number
  /** edge.fullPadding and the rim (dissolveDepth rows × pitch), device px. */
  pad: number
  rim: number
  /** edge.textBlendMotion and the motion clock: the rim breathes. */
  motion?: number
  t?: number
}

/** The hero's text clearance ('full' edge, Centered), as the GPU field's
 *  clearance(): paint the back colour over every tile that touches a rect
 *  grown by `pad`; tiles within `rim` of it thin out with distance by a
 *  seeded hash, nudged by noise over time when `motion` > 0. */
export function drawClearance(ctx: CanvasRenderingContext2D, W: number, H: number, rects: SketchRect[], o: ClearanceOpts) {
  const p = Math.max(1, Math.round(o.pitch))
  const ox = o.ox ?? 0, oy = o.oy ?? 0
  const rim = Math.max(p, o.rim)
  const motion = o.motion ?? 0
  ctx.globalAlpha = 1
  ctx.fillStyle = o.back
  ctx.beginPath()
  for (let y = oy; y < H; y += p) {
    for (let x = ox; x < W; x += p) {
      let minD = Infinity
      let inside = false
      for (const r of rects) {
        const ax = r.x - o.pad, ay = r.y - o.pad, bx = r.x + r.w + o.pad, by = r.y + r.h + o.pad
        if (x + p > ax && x < bx && y + p > ay && y < by) { inside = true; break }
        const dx = Math.max(ax - (x + p / 2), 0, x + p / 2 - bx)
        const dy = Math.max(ay - (y + p / 2), 0, y + p / 2 - by)
        minD = Math.min(minD, Math.hypot(dx, dy))
      }
      if (!inside) {
        if (minD >= rim) continue
        const ix = Math.round((x - ox) / p), iy = Math.round((y - oy) / p)
        const th = Math.min(1, Math.max(0, tileHash(ix, iy, 1) + (motion > 0 ? (fbm(ix * 0.33, iy * 0.33, (o.t ?? 0) * 0.8, 89) - 0.5) * motion * 0.55 : 0)))
        if (minD / rim > th) continue
      }
      ctx.rect(x, y, p, p)
    }
  }
  ctx.fill()
}

/** White copy bars over a sketch (headline, sub, CTA). */
export function drawCopyBars(ctx: CanvasRenderingContext2D, rects: SketchRect[]) {
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#fff'
  for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.globalAlpha = 1
}
