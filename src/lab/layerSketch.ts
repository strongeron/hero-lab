import {
  CENTERED_SIZE_CONTRAST,
  centeredEdge,
  defaultAnimationConfig,
  defaultCompositionConfig,
  defaultEdgeConfig,
  defaultHoverConfig,
  defaultPixelGridConfig,
  defaultShaderConfig,
  fixLayers,
  gridPitch,
  problemLayers,
  type DitherState,
  type HeroTemplate,
  type WarpMode,
} from '../heroes/dither/ditherStore'
import { boundingRect, centredCopyLines, drawClearance, drawCopyBars, drawField, drawPointField, previewWarp, type SketchLayer } from '../heroes/dither/panelSketch'

/* 2D sketches of one Layers step: the hero after steps 0…i, drawn to the scale
   of the 1440-wide artboard. Built on panelSketch (drawField, SHAPE_FN) so the
   Recipe previews and the Design Panel previews speak one visual language. */

export type StepId = 'grid' | 'snap' | 'points' | 'layout' | 'edge' | 'hover'
export type LookSource = Pick<DitherState, 'shader' | 'pixelGrid' | 'edge' | 'hover' | 'animation' | 'composition'>

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
  /** Point sizes: the GPU field's own clocks and size settings (as the
   *  Design Panel's Grid preview); null = colour display. */
  points: { spread: number; contrast: number; speed: number; noise: number; cycle: number } | null
  /** full: the field fills the hero and clears the text (Full edge, or Centered). */
  edge: { full: boolean; position: number; lines: boolean; padding: number; depth: number; motion: number }
  /** Centered layout (the Layout step): copy in the middle, 'full' edge. */
  centered: boolean
  /** Shape centre above the canvas centre, share of H: the hero's shapeLift. */
  lift: number
  warp: { radius: number; rotate: number; round: number; jitter: number; mode: WarpMode } | null
}

/** The look after the steps in `on`, with the same rules as the Layers steps:
 *  without the grid a gridded template shows dots at its tile size; with the
 *  edge step off the edge is the default one. */
export function stepLook(v: LookSource, on: ReadonlySet<StepId>): StepLook {
  const pg = v.pixelGrid
  const grid = pg.enabled && on.has('grid')
  const pitch = gridPitch(pg)
  // The Layout step applies Centered as setComposition does: the
  // line-hugging edge values, and a lively Size contrast where there is none.
  const centered = on.has('layout') && v.composition.mode === 'centered'
  const base = on.has('edge') || v.edge.mode !== 'full' ? v.edge : defaultEdgeConfig
  const edge = centered ? { ...base, ...centeredEdge, mode: 'full' as const } : base
  const a = centered && !v.animation.tileSizeContrast ? { ...v.animation, tileSizeContrast: CENTERED_SIZE_CONTRAST } : v.animation
  return {
    back: v.shader.colorBack,
    layers: v.shader.alphaLayers,
    hoverLayers: v.hover.hoverLayers,
    unit: pg.enabled ? pitch : v.shader.size,
    dot: grid ? v.shader.size : pg.enabled ? pitch : v.shader.size,
    grid: grid ? { pitch, gap: pg.gap, radius: pg.radius } : null,
    snap: grid && pg.snap && on.has('snap'),
    points: grid && a.tileDisplay === 'points' && on.has('points')
      ? { spread: a.tileSizeSpread, contrast: a.tileSizeContrast ?? 0, speed: a.tileSizeSpeed, noise: a.tileSizeNoise, cycle: v.shader.colorCycleSpeed }
      : null,
    edge: { full: edge.mode === 'full', position: edge.position, lines: edge.textRectMode === 'lines', padding: edge.fullPadding, depth: edge.dissolveDepth, motion: edge.textBlendMotion },
    centered,
    // As the Design Panel: a fixed 24% stands in for the hero's measured band.
    lift: edge.mode === 'full' ? 0 : 0.24,
    warp: v.hover.enabled && on.has('hover')
      ? { radius: v.hover.radius, rotate: v.hover.warpRotate, round: v.hover.warpRound, jitter: v.hover.warpJitter, mode: v.hover.mode ?? 'hover' }
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
    composition: { ...defaultCompositionConfig },
  }
}
export const ALL_STEPS: ReadonlySet<StepId> = new Set(['grid', 'snap', 'points', 'layout', 'edge', 'hover'])

const HERO_W = 1440
const MIN_TILE = 4
const hash = (x: number, y: number) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s) }

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

  const lift = look.lift
  if (g && look.points) {
    // The hero's GPU point field ignores layer shapes: draw its port on the
    // hero's clocks, as the Design Panel's Grid preview does.
    const pt = look.points
    drawPointField(ctx, W, H, {
      back: look.back, layers: look.layers, pitch: tile, gap,
      t: 1.3 + t * pt.speed, phase: t * pt.cycle, spread: pt.spread, contrast: pt.contrast, mapScale: pt.noise,
    })
  } else if (g && look.snap) {
    drawField(ctx, W, H, { back: look.back, layers: look.layers, t, pitch: tile, gap, round, lift })
  } else {
    drawField(ctx, W, H, { back: look.back, layers: look.layers, t, pitch: px(look.dot), gap: 0, lift })
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
    // To scale, but never smaller than a fifth of the preview, so it reads.
    // Roam / Both: the hero's roam path, breathing radius and morph.
    const { x, y, r, rotate, round: wRound } = previewWarp(w.mode, t, W, H, Math.max(w.radius * k, H * 0.2), { rotate: w.rotate, round: w.round })
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.clip()
    drawField(ctx, W, H, {
      back: look.back, layers: look.hoverLayers, t, pitch: tile, gap, round, lift,
      warp: { x, y, r, layers: look.hoverLayers, rotate, round: wRound, jitter: w.jitter },
    })
    ctx.restore()
  }

  const lines = look.centered ? centredCopyLines(W, H) : copyLines(W, H)
  if (look.edge.full) {
    // Clearance, as the hero: no tile within `padding` of each line (or of
    // the whole block), and a rim of `depth` rows that thins out.
    drawClearance(ctx, W, H, look.edge.lines ? lines : [boundingRect(lines)], {
      back: look.back, pitch: tile,
      ...(g && look.points ? { ox: (W - Math.floor(W / tile) * tile) / 2, oy: (H - Math.floor(H / tile) * tile) / 2 } : {}),
      pad: Math.round(look.edge.padding * k), rim: Math.max(1, Math.round(look.edge.depth)) * tile,
      motion: look.points || look.snap ? look.edge.motion : 0, t,
    })
  } else {
    // Default edge: the field ends at `position`, with a dissolve band above it.
    ctx.fillStyle = look.back
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
  drawCopyBars(ctx, lines)
}
