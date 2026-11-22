import {
  defaultAnimationConfig,
  defaultEdgeConfig,
  defaultHoverConfig,
  defaultPixelGridConfig,
  defaultShaderConfig,
  fixLayers,
  gridPitch,
  problemLayers,
  type DitherState,
  type HeroTemplate,
} from '../heroes/dither/ditherStore'
import { drawField, loopPointer, SHAPE_FN, type SketchLayer } from '../heroes/dither/panelSketch'

/* 2D sketches of one Layers step: the hero after steps 0…i, drawn to the scale
   of the 1440-wide artboard. Built on panelSketch (drawField, SHAPE_FN) so the
   Layers previews and the Design Panel previews speak one visual language. */

export type StepId = 'grid' | 'snap' | 'points' | 'edge' | 'hover'
export type LookSource = Pick<DitherState, 'shader' | 'pixelGrid' | 'edge' | 'hover' | 'animation'>

export interface StepLook {
  back: string
  layers: SketchLayer[]
  hoverLayers: SketchLayer[]
  /** The template's tile pitch (or dot size without a grid), hero CSS px: sets the zoom. */
  unit: number
  /** Free dither dot size, hero CSS px. */
  dot: number
  /** Tile mask, hero CSS px; null = no tile grid. */
  grid: { pitch: number; gap: number; radius: number } | null
  snap: boolean
  /** Point-size spread; null = colour display. */
  points: number | null
  edge: { full: boolean; position: number; lines: boolean; padding: number; depth: number }
  warp: { radius: number; rotate: number; round: number; jitter: number } | null
}

/** The look after the steps in `on`, with the same rules as the Layers steps:
 *  without the grid a gridded template shows dots at its tile size; with the
 *  edge step off the edge is the default one. */
export function stepLook(v: LookSource, on: ReadonlySet<StepId>): StepLook {
  const pg = v.pixelGrid
  const grid = pg.enabled && on.has('grid')
  const pitch = gridPitch(pg)
  const edge = on.has('edge') || v.edge.mode !== 'full' ? v.edge : defaultEdgeConfig
  return {
    back: v.shader.colorBack,
    layers: v.shader.alphaLayers,
    hoverLayers: v.hover.hoverLayers,
    unit: pg.enabled ? pitch : v.shader.size,
    dot: grid ? v.shader.size : pg.enabled ? pitch : v.shader.size,
    grid: grid ? { pitch, gap: pg.gap, radius: pg.radius } : null,
    snap: grid && pg.snap && on.has('snap'),
    points: grid && v.animation.tileDisplay === 'points' && on.has('points') ? v.animation.tileSizeSpread : null,
    edge: { full: edge.mode === 'full', position: edge.position, lines: edge.textRectMode === 'lines', padding: edge.fullPadding, depth: edge.dissolveDepth },
    warp: v.hover.enabled && on.has('hover')
      ? { radius: v.hover.radius, rotate: v.hover.warpRotate, round: v.hover.warpRound, jitter: v.hover.warpJitter }
      : null,
  }
}

/** A template's look values without applying it (same merge as applyHeroTemplate,
 *  minus the baked-in scene, which is motion only). */
export function templateSource(tp: HeroTemplate): LookSource {
  const rest = tp.initialState === 'fix' ? fixLayers : problemLayers
  const reveal = tp.initialState === 'fix' ? problemLayers : fixLayers
  return {
    shader: { ...defaultShaderConfig, ...tp.shader, alphaLayers: rest },
    pixelGrid: { ...defaultPixelGridConfig, ...tp.pixelGrid },
    edge: { ...defaultEdgeConfig, ...tp.edge },
    hover: { ...defaultHoverConfig, ...tp.hover, hoverLayers: reveal },
    animation: { ...defaultAnimationConfig, ...tp.animation },
  }
}
export const ALL_STEPS: ReadonlySet<StepId> = new Set(['grid', 'snap', 'points', 'edge', 'hover'])

const HERO_W = 1440
const MIN_TILE = 4
const hash = (x: number, y: number) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s) }

/** Point sizes: one round dot per tile, sized by the strongest layer there. */
function drawPoints(ctx: CanvasRenderingContext2D, W: number, H: number, o: { back: string; layers: SketchLayer[]; t: number; pitch: number; gap: number; spread: number }) {
  const p = Math.max(2, Math.round(o.pitch))
  const full = Math.max(1, p - Math.min(p - 1, Math.round(o.gap)))
  const md = Math.min(W, H) / 1.4
  const byLayer: number[][] = o.layers.map(() => [])
  ctx.fillStyle = o.back
  ctx.fillRect(0, 0, W, H)
  for (let y = 0; y < H; y += p) {
    const v = (y + p / 2 - H / 2) / md
    for (let x = 0; x < W; x += p) {
      const u = (x + p / 2 - W / 2) / md
      let best = 0
      let k = -1
      o.layers.forEach((l, i) => {
        const m = SHAPE_FN[l.shape](u, v, o.t + i * 1.7) * l.opacity
        if (m > best) { best = m; k = i }
      })
      if (k < 0 || best < 0.2) continue
      byLayer[k].push(x + p / 2, y + p / 2, full * (1 - o.spread * (1 - best)))
    }
  }
  byLayer.forEach((a, k) => {
    if (!a.length) return
    ctx.fillStyle = o.layers[k].color
    ctx.beginPath()
    for (let i = 0; i < a.length; i += 3) {
      const d = Math.max(1, a[i + 2])
      ctx.roundRect(a[i] - d / 2, a[i + 1] - d / 2, d, d, d / 2)
    }
    ctx.fill()
  })
}

/** Two copy lines, as rectangles in device px (same place as the Design Panel's template tiles). */
function copyLines(W: number, H: number) {
  const h = Math.max(2, Math.round(H * 0.09))
  return [
    { x: Math.round(W * 0.1), y: Math.round(H * 0.62), w: Math.round(W * 0.55), h },
    { x: Math.round(W * 0.1), y: Math.round(H * 0.77), w: Math.round(W * 0.36), h },
  ]
}

/** Draw the hero after one step into the whole canvas. */
export function drawStep(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, dpr: number, look: StepLook) {
  // A thumbnail of the whole 1440px hero makes 24px tiles 1.5 CSS px wide, too
  // small to tell grid, snap and points apart. Zoom in (up to 3×) until one tile
  // is MIN_TILE CSS px; all steps of a template share the zoom (same `unit`).
  const zoom = Math.min(3, Math.max(1, (MIN_TILE * dpr * HERO_W) / (look.unit * W)))
  const k = (W / HERO_W) * zoom
  const px = (v: number) => Math.max(dpr, Math.round(v * k))
  const g = look.grid
  const tile = g ? px(g.pitch) : px(look.dot)
  const gap = g ? Math.min(tile - 1, Math.round(g.gap * k)) : 0
  const round = g ? Math.min(1, (g.radius * 2) / g.pitch) : 0

  if (g && look.points != null) {
    drawPoints(ctx, W, H, { back: look.back, layers: look.layers, t, pitch: tile, gap, spread: look.points })
  } else if (g && look.snap) {
    drawField(ctx, W, H, { back: look.back, layers: look.layers, t, pitch: tile, gap, round })
  } else {
    drawField(ctx, W, H, { back: look.back, layers: look.layers, t, pitch: px(look.dot), gap: 0 })
    if (g) {
      // Tile mask: paint everything back except the tile interiors.
      const size = tile - gap
      const inset = Math.floor(gap / 2)
      ctx.fillStyle = look.back
      ctx.beginPath()
      ctx.rect(0, 0, W, H)
      for (let y = 0; y < H; y += tile) {
        for (let x = 0; x < W; x += tile) {
          if (round * size >= 1) ctx.roundRect(x + inset, y + inset, size, size, (round * size) / 2)
          else ctx.rect(x + inset, y + inset, size, size)
        }
      }
      ctx.fill('evenodd')
    }
  }

  if (look.warp) {
    const w = look.warp
    const { x, y } = loopPointer(t, W, H)
    // To scale, but never smaller than a fifth of the preview, so it reads.
    const r = Math.max(w.radius * k, H * 0.2)
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.clip()
    drawField(ctx, W, H, {
      back: look.back, layers: look.hoverLayers, t, pitch: tile, gap, round,
      warp: { x, y, r, layers: look.hoverLayers, rotate: w.rotate, round: w.round, jitter: w.jitter },
    })
    ctx.restore()
  }

  const lines = copyLines(W, H)
  ctx.fillStyle = look.back
  if (look.edge.full) {
    // Clearance: no tile within `padding` of each line (or of the whole block).
    const pad = Math.round(look.edge.padding * k)
    const boxes = look.edge.lines ? lines : [{
      x: lines[0].x, y: lines[0].y,
      w: Math.max(...lines.map((l) => l.w)), h: lines[1].y + lines[1].h - lines[0].y,
    }]
    for (const b of boxes) ctx.fillRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
  } else {
    // Default edge: the field ends at `position`, with a dissolve band above it.
    const cut = Math.round(H * look.edge.position / 100)
    ctx.fillRect(0, cut, W, H - cut)
    const rows = look.edge.depth
    for (let r = 1; r <= rows; r++) {
      const y = cut - r * tile
      if (y < 0) break
      for (let x = 0; x < W; x += tile) {
        if (hash(x / tile, r) < (rows - r + 1) / (rows + 1)) ctx.fillRect(x, y, tile, tile)
      }
    }
  }
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#fff'
  for (const l of lines) ctx.fillRect(l.x, l.y, l.w, l.h)
  ctx.globalAlpha = 1
}
