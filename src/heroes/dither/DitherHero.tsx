import { useMemo, useRef, useEffect, useState } from 'react'
import { Dithering } from '@paper-design/shaders-react'
import { useDitherStore, resolveCopy, palettes, heroCtaColors, warpErrorSnippets, warpFixSnippets, type DitherPixelGridConfig, type SceneTemplateId } from './ditherStore'
import { getThemeById } from '../../themes/terminalThemes'
import { TileFieldRenderer, type TileFieldFrame } from './tileField'
import { useHeadlineFit } from './useHeadlineFit'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

/* ─── Pixel grid geometry ───
   Every tile edge sits on a whole pixel: the pitch, gap, inset and phase are
   integers. An odd gap puts the extra pixel after the piece (inset =
   floor(gap / 2)) instead of centring the piece on a half pixel. */

/** Piece pitch = tile size / divisions, in whole pixels. */
function pixelGridPitch(cfg: DitherPixelGridConfig): number {
  const cell = Math.max(1, Math.round(cfg.cell))
  const divisions = Math.max(1, Math.round(cfg.divisions))
  return Math.max(2, Math.round(cell / divisions))
}

function positiveModulo(value: number, base: number): number {
  return ((value % base) + base) % base
}

function clampTileRadius(radius: number, piece: number): number {
  return Math.max(0, Math.min(Math.round(radius), piece / 2))
}

/** Resolved tile lattice: pitch, whole-pixel gap, resting piece, its inset in
 *  the cell, corner radius and phase. */
interface TileGrid {
  pitch: number
  gap: number
  piece: number
  inset: number
  radius: number
  alignX: number
  alignY: number
}

function tileGrid(cfg: DitherPixelGridConfig, alignX: number, alignY: number): TileGrid {
  const pitch = pixelGridPitch(cfg)
  const gap = Math.max(0, Math.min(Math.round(cfg.gap), pitch - 1))
  const piece = pitch - gap
  return { pitch, gap, piece, inset: Math.floor(gap / 2), radius: clampTileRadius(cfg.radius, piece), alignX, alignY }
}

/** One resting piece in a pitch × pitch cell, as an SVG data URL. */
function buildTileMaskUrl(g: TileGrid): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${g.pitch}' height='${g.pitch}'>` +
    `<rect x='${g.inset}' y='${g.inset}' width='${g.piece}' height='${g.piece}' rx='${g.radius}' ry='${g.radius}' fill='black'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function buildPixelGridMask(g: TileGrid): React.CSSProperties {
  const url = buildTileMaskUrl(g)
  const size = `${g.pitch}px ${g.pitch}px`
  const pos = `${g.alignX}px ${g.alignY}px`
  return {
    maskImage: url, WebkitMaskImage: url,
    maskRepeat: 'repeat', WebkitMaskRepeat: 'repeat',
    maskSize: size, WebkitMaskSize: size,
    maskPosition: pos, WebkitMaskPosition: pos,
  }
}


/** Stable per-tile threshold in [0,1) from grid coords + seed — a fixed random
 *  map (like a Photoshop dissolve threshold), so the dither doesn't flicker
 *  frame-to-frame even when the gradient (e.g. a moving wave) animates. */
function tileThreshold(cx: number, cy: number, seed: number): number {
  let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263) + Math.imul(seed, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function noiseFade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function noiseHash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function valueNoise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = noiseFade(x - ix)
  const fy = noiseFade(y - iy)
  const a = noiseHash2(ix, iy, seed)
  const b = noiseHash2(ix + 1, iy, seed)
  const c = noiseHash2(ix, iy + 1, seed)
  const d = noiseHash2(ix + 1, iy + 1, seed)
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy
}

/** Layered value noise for organic dissolve / tile-size motion. */
function fbmNoise(x: number, y: number, t: number, seed: number): number {
  return (
    valueNoise2(x + t * 0.4, y + t * 0.25, seed) * 0.55
    + valueNoise2(x * 2.1 + t * 0.7, y * 2.1, seed + 1) * 0.3
    + valueNoise2(x * 4.3, y * 4.3 + t * 0.35, seed + 2) * 0.15
  )
}

interface TextRect { x: number; y: number; w: number; h: number }

/** Share of a font's content box above the baseline, from the font's own
 *  metrics. A fixed 0.8em guess put every type pair's baseline in the same
 *  place, so the guides did not move when the font changed. Cached per font;
 *  the cache is cleared when a web font finishes loading (useFontsLoaded). */
const ascentShareCache = new Map<string, number>()
let metricsCtx: CanvasRenderingContext2D | null = null
function ascentShare(cs: CSSStyleDeclaration): number {
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const cached = ascentShareCache.get(font)
  if (cached != null) return cached
  metricsCtx ??= document.createElement('canvas').getContext('2d')
  if (!metricsCtx) return 0.8
  metricsCtx.font = font
  const m = metricsCtx.measureText('Hg')
  const share = m.fontBoundingBoxAscent / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) || 0.8
  ascentShareCache.set(font, share)
  return share
}

/** Viewport-space baseline of every rendered text line of an element. A text
 *  range's client rect is the font's content box, so the baseline sits at its
 *  top plus the ascent share of its height. */
function lineBaselines(el: Element, minWidth = 4): number[] {
  const cs = getComputedStyle(el)
  const fontSize = parseFloat(cs.fontSize)
  const share = ascentShare(cs)
  const range = document.createRange()
  range.selectNodeContents(el)
  return Array.from(range.getClientRects())
    .filter((r) => r.width > minWidth && r.height > fontSize * 0.5)
    .map((r) => r.top + r.height * share)
}

/** Baseline of an element's LAST rendered text line. Null when nothing renders. */
function lastLineBaseline(el: Element): number | null {
  return lineBaselines(el).at(-1) ?? null
}

/** Bumps when a web font finishes loading. Font swaps change line metrics
 *  without always resizing the box, so ResizeObserver can miss them. */
function useFontsLoaded(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const onDone = (e: FontFaceSetLoadEvent) => {
      // The panel's tiles load about ten faces; react only to the hero's own.
      const used = Array.from(document.querySelectorAll('section h1, section p, section a'), (el) => getComputedStyle(el).fontFamily).join(',')
      if (!e.fontfaces.some((f) => used.includes(f.family.replace(/["']/g, '')))) return
      ascentShareCache.clear()
      setTick((t) => t + 1)
    }
    document.fonts.addEventListener('loadingdone', onDone)
    return () => document.fonts.removeEventListener('loadingdone', onDone)
  }, [])
  return tick
}

/** Build a dither edge mask (Photoshop-dissolve style): a white→black gradient
 *  where each tile is kept while the gradient value exceeds its fixed random
 *  threshold. A flat band ending at `positionPct`, aligned to the tile grid, in
 *  px. Returns undefined until measured. */
function buildDissolveMaskUrl(
  positionPct: number, depthRows: number, pitch: number,
  w: number, h: number, alignY: number, alignX: number, seed: number,
  motion?: { t: number; strength: number; scale: number },
  extendPx = 0,
): string | undefined {
  if (!w || !h || pitch < 2) return undefined
  const snap = (y: number) => Math.round((y - alignY) / pitch) * pitch + alignY
  // Columns must share the tile grid's X phase — desktop happens to land on
  // phase 0 (720 % 24 = 0) but tablet/mobile don't, and unphased columns cut
  // dots at their left/right edges inside the dissolve band.
  const xPhase = ((alignX % pitch) + pitch) % pitch
  const x0 = xPhase > 0 ? xPhase - pitch : 0
  const posPx = (positionPct / 100) * h
  const bandH = Math.max(pitch, Math.round(depthRows) * pitch)
  const maxEdge = Math.min(h, posPx)
  const solidBottom = Math.max(0, snap(posPx - bandH))
  const extendEnd = extendPx > 0 ? Math.min(h, snap(posPx + extendPx)) : posPx
  const rects: string[] = []
  if (solidBottom > 0) rects.push(`<rect x='0' y='0' width='${w}' height='${solidBottom}'/>`)

  const addTile = (x: number, y: number, g: number) => {
    const cx = Math.round((x - xPhase) / pitch)
    const cy = Math.round(y / pitch)
    let threshold = tileThreshold(cx, cy, seed)
    if (motion && motion.strength > 0) {
      const n = fbmNoise(cx * motion.scale, cy * motion.scale, motion.t, seed + 17)
      threshold += (n - 0.5) * motion.strength
      threshold = Math.max(0.02, Math.min(0.98, threshold))
    }
    const keep = g >= 1 || (g > 0 && g > threshold)
    if (keep) rects.push(`<rect x='${x}' y='${y}' width='${pitch}' height='${pitch}'/>`)
  }

  for (let y = solidBottom; y < maxEdge; y += pitch) {
    for (let x = x0; x < w; x += pitch) addTile(x, y, (posPx - y) / bandH)
  }

  // Shader extend — solid tiles below Position, soft fade at the bottom rim.
  if (extendPx > 0 && extendEnd > posPx) {
    const extBandH = Math.max(pitch, Math.round(depthRows) * pitch)
    const extSolidEnd = Math.max(posPx + pitch, extendEnd - extBandH)
    for (let y = snap(posPx); y < extSolidEnd; y += pitch) {
      for (let x = x0; x < w; x += pitch) addTile(x, y, 1)
    }
    for (let y = extSolidEnd; y < extendEnd; y += pitch) {
      for (let x = x0; x < w; x += pitch) {
        addTile(x, y, (extendEnd - y) / extBandH)
      }
    }
  }

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' fill='white'>${rects.join('')}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** Container mask combining the repeating tile mask with the full-size dissolve
 *  mask (intersect) — a pixel shows only where both keep it. */
function buildDissolveContainerStyle(g: TileGrid, dissolveUrl: string): React.CSSProperties {
  return intersectMask(buildPixelGridMask(g), dissolveUrl)
}

/** Add a full-size mask image to a style's mask stack (or start one). The
 *  layers intersect: a pixel shows only where every layer keeps it. */

function intersectMask(style: React.CSSProperties | undefined, url: string): React.CSSProperties {
  if (!style || !style.maskImage) {
    return {
      ...style,
      maskImage: url, WebkitMaskImage: url,
      maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
      maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
      maskPosition: '0px 0px', WebkitMaskPosition: '0px 0px',
    }
  }
  return {
    ...style,
    maskImage: `${String(style.maskImage)}, ${url}`,
    WebkitMaskImage: `${String(style.WebkitMaskImage ?? style.maskImage)}, ${url}`,
    maskRepeat: `${String(style.maskRepeat ?? 'repeat')}, no-repeat`,
    WebkitMaskRepeat: `${String(style.WebkitMaskRepeat ?? style.maskRepeat ?? 'repeat')}, no-repeat`,
    maskSize: `${String(style.maskSize ?? 'auto')}, 100% 100%`,
    WebkitMaskSize: `${String(style.WebkitMaskSize ?? style.maskSize ?? 'auto')}, 100% 100%`,
    maskPosition: `${String(style.maskPosition ?? '0px 0px')}, 0px 0px`,
    WebkitMaskPosition: `${String(style.WebkitMaskPosition ?? style.maskPosition ?? '0px 0px')}, 0px 0px`,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  }
}


/** Animation drift offsets — accumulated over time */
interface AnimDrift {
  offsetX: number
  offsetY: number
  rotation: number
  scale: number
  colorPhase: number
  /** Wave sweep — origin offset */
  waveOriginX: number
  waveOriginY: number
  /** Loop-break translation — accumulates on its OWN channel so a scan scene,
   *  which reassigns offsetX/offsetY every frame, can't wipe it. */
  loopX: number
  loopY: number
}

const zeroDrift: AnimDrift = { offsetX: 0, offsetY: 0, rotation: 0, scale: 0, colorPhase: 0, waveOriginX: 0, waveOriginY: 0, loopX: 0, loopY: 0 }

/** A distinct motion baseline for each scene. Scene templates change motion,
 *  not styling, so without a new baseline they would inherit the previous
 *  scene's accumulated transform and look unchanged for several seconds. */
const sceneStartDrift: Record<SceneTemplateId, Partial<AnimDrift>> = {
  'orbit': { offsetX: 0.18, offsetY: -0.12, rotation: 14, colorPhase: 0.08 },
  'breathe-tiles': { scale: 0.025, colorPhase: 0.24 },
  'color-flow': { offsetX: -0.55, offsetY: 0.04, colorPhase: 0.52 },
  'gentle-drift': { offsetX: -0.18, offsetY: 0.2, colorPhase: 0.16 },
  'living-texture': { rotation: 28, scale: 0.035, colorPhase: 0.68 },
  'falling-errors': { offsetY: -0.48, colorPhase: 0.34 },
  'signal-sweep': { offsetX: 0.62, rotation: 8, colorPhase: 0.46 },
  'radar-scan': { offsetX: -0.35, waveOriginX: 0.14, colorPhase: 0.74 },
  'error-sweep': { offsetX: 0.28, offsetY: -0.22, rotation: 18, waveOriginY: 0.2, colorPhase: 0.6 },
  'deep-breath': { scale: 0.07, colorPhase: 0.88 },
  'solid-classic': { colorPhase: 0 },
}

function initialDriftForScene(id: SceneTemplateId | null): AnimDrift {
  return id ? { ...zeroDrift, ...sceneStartDrift[id] } : { ...zeroDrift }
}


/** Whole-tile circle as a clip-path polygon (px units). Each grid tile is fully
 *  IN or OUT based on whether its center falls inside the radius — so the
 *  recolor/reveal fills COMPLETE rectangular pixels with a staircased edge, never
 *  slicing a tile mid-cell at the rim. The container's pixel-grid mask re-adds the
 *  inter-tile gaps, so the result reads as whole dither cells inside a pixel circle.
 *  Returns a degenerate (empty) polygon when nothing is covered. */
function buildWholeTileCircleClip(
  px: number, py: number, r: number, pitch: number,
  alignX: number, alignY: number, cw: number, ch: number,
): string {
  const EMPTY = 'polygon(0px 0px, 0px 0px, 0px 0px)'
  if (r < pitch * 0.5 || pitch <= 1) return EMPTY
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const rowTop = Math.floor((py - r - alignY) / pitch)
  const rowBot = Math.ceil((py + r - alignY) / pitch)
  const right: string[] = []
  const leftRows: Array<[string, string]> = []
  for (let row = rowTop; row <= rowBot; row++) {
    const dy = alignY + (row + 0.5) * pitch - py // tile-center y offset
    if (Math.abs(dy) > r) continue
    const dx = Math.sqrt(r * r - dy * dy)
    const colLo = Math.ceil((px - dx - alignX) / pitch - 0.5)
    const colHi = Math.floor((px + dx - alignX) / pitch - 0.5)
    if (colHi < colLo) continue
    const xL = clamp(alignX + colLo * pitch, 0, cw)
    const xR = clamp(alignX + (colHi + 1) * pitch, 0, cw)
    const yT = clamp(alignY + row * pitch, 0, ch)
    const yB = clamp(alignY + (row + 1) * pitch, 0, ch)
    right.push(`${xR}px ${yT}px`, `${xR}px ${yB}px`)   // down the right staircase
    leftRows.push([`${xL}px ${yB}px`, `${xL}px ${yT}px`])
  }
  if (!right.length) return EMPTY
  const left: string[] = []
  for (let i = leftRows.length - 1; i >= 0; i--) left.push(leftRows[i][0], leftRows[i][1]) // up the left
  return `polygon(${right.concat(left).join(', ')})`
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Pixel-circle radius: snapped to whole tile rings, so a tile is either fully
 *  in (centre inside) or fully out. GLSL inHover in tileField.ts matches. */
function pixelCircleRadius(r: number, pitch: number): number {
  return Math.round(r / pitch) * pitch
}

/** Whole device pixels with the same parity as the pitch: a piece centred in
 *  its cell then has every edge on a pixel boundary. */
function snapPiece(size: number, pitch: number, dpr: number): number {
  const p = Math.round(pitch * dpr)
  const s = Math.max(0, Math.round(size * dpr))
  return (s - ((p - s) & 1)) / dpr
}

/** Size of one warped tile: up to `scale` × piece, spread big→small by a fixed
 *  per-tile random value. */
function warpTileSize(piece: number, scale: number, spread: number, col: number, row: number): number {
  const maxSz = piece * Math.max(0, Math.min(1, scale))
  if (spread <= 0) return maxSz
  const minSz = maxSz * Math.max(0, 1 - Math.min(1.5, spread))
  const u = Math.pow(tileThreshold(col, row, 1337), 1 / (1 + spread * 1.25))
  return minSz + (maxSz - minSz) * u
}

interface WarpShape { rotate: number; round: number; scale: number; spread: number }

/** Reveal mask for the Paper + CSS tile grid path: only the warped tiles in
 *  the pixel circle, drawn into a canvas the size of the circle's tile box
 *  (not the whole hero), so encoding and decoding it stays cheap. Returns the
 *  box in CSS px, or null when no tile is drawn. */
function buildRevealMask(
  canvas: HTMLCanvasElement, px: number, py: number, r: number,
  g: TileGrid, w: WarpShape, dpr: number,
): { x: number; y: number; w: number; h: number } | null {
  const { pitch, alignX, alignY } = g
  if (pitch <= 1) return null
  const rr = pixelCircleRadius(r, pitch)
  const reach = rr + pitch
  const colLo = Math.floor((px - reach - alignX) / pitch)
  const colHi = Math.ceil((px + reach - alignX) / pitch)
  const rowLo = Math.floor((py - reach - alignY) / pitch)
  const rowHi = Math.ceil((py + reach - alignY) / pitch)
  const box = { x: alignX + colLo * pitch, y: alignY + rowLo * pitch, w: (colHi - colLo + 1) * pitch, h: (rowHi - rowLo + 1) * pitch }
  const canvasW = Math.max(1, Math.round(box.w * dpr))
  const canvasH = Math.max(1, Math.round(box.h * dpr))
  if (canvas.width !== canvasW || canvas.height !== canvasH) {
    canvas.width = canvasW
    canvas.height = canvasH
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr)
  ctx.clearRect(box.x, box.y, box.w, box.h)
  ctx.fillStyle = '#000'
  const maxSz = g.piece * Math.max(0, Math.min(1, w.scale))
  const targetRound = g.radius + Math.max(0, Math.min(1, w.round)) * (g.piece / 2 - g.radius)
  const rot = w.rotate * Math.PI / 180
  let drew = false
  for (let row = rowLo; row <= rowHi; row++) {
    const tcy = alignY + (row + 0.5) * pitch
    for (let col = colLo; col <= colHi; col++) {
      const tcx = alignX + (col + 0.5) * pitch
      if (Math.hypot(tcx - px, tcy - py) > rr) continue
      const sz = snapPiece(warpTileSize(g.piece, w.scale, w.spread, col, row), pitch, dpr)
      if (sz <= 0) continue
      const rad = clampTileRadius(maxSz > 0 ? g.radius + (targetRound - g.radius) * (sz / maxSz) : g.radius, sz)
      ctx.save()
      ctx.translate(tcx, tcy)
      if (rot) ctx.rotate(rot)
      roundRectPath(ctx, -sz / 2, -sz / 2, sz, sz, rad)
      ctx.fill()
      ctx.restore()
      drew = true
    }
  }
  return drew ? box : null
}


/** Encode a mask canvas off the main thread. A sync toDataURL here was a
 *  full-hero PNG encode on every cursor step (~75% of the main thread during a
 *  hover sweep). The result must still be a data: URL: Chrome loads a blob:
 *  mask-image asynchronously even when it is cached, and the masked layer
 *  paints blank until it lands — every swap blinked the whole grid. */
/** Min ms between warp-mask encodes (CPU warp path, Paper tile displays). */
const WARP_MASK_INTERVAL = 1000 / 60

function canvasToDataUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  })
}

/** Smallest gap the baseline lock leaves between the response line and the
 *  CTA (px) — matches the 'cta' pin's md:gap-6. */
const MIN_RESPONSE_CTA_GAP = 24

type Tip = { px: number; py: number; r: number }

export default function DitherHero() {
  const { shader: c, edge, copyVariant, typePair, palette, hover, pixelGrid, animation: storeAnim, layout, button, terminalTheme: termThemeId, initialState, activeScene, stableColorField } = useDitherStore()
  const reducedMotion = usePrefersReducedMotion()
  // Off-screen heroes read as paused: this stops the drift and mask loops and
  // sets the Paper speed to 0, which stops Paper's own rAF.
  const [inView, setInView] = useState(true)
  const anim = inView ? storeAnim : { ...storeAnim, playing: false }
  // Reduced motion shrinks how far things move; Speed scales how fast.
  const spatialMotionScale = reducedMotion ? 0.15 : 1
  const timeScale = Math.max(0, anim.speed)
  // CTA styling shared with the header (radius + caps), art-directable per template.
  const ctaStyle: React.CSSProperties = { borderRadius: button.radius }
  const ctaTextTransform = button.uppercase ? 'uppercase' as const : undefined

  const copy = resolveCopy(copyVariant, typePair)
  // Delay the two-column split to lg for variants that ask for it (see
  // DitherCopy.tabletLayout). Drives both the grid classes and the baseline
  // lock's media query, which must agree or the lock fires while stacked.
  const stackTablet = copy.tabletLayout === 'stack'
  const activeTheme = termThemeId ? getThemeById(termThemeId) : undefined

  // CTA follows the palette (or the terminal theme); the header reads the same.
  const cta = heroCtaColors(palette, termThemeId)
  const CTA_BG = cta.bg
  const CTA_BG_HOVER = cta.hover
  const ctaTextColor = cta.text
  const headlineColor = activeTheme
    ? activeTheme.fg
    : (copy.headlineColorMode === 'white' ? '#FFFFFF' : (copy.layout === 'problem' ? palettes[palette].problem[0] : palettes[palette].fix[0]))
  const responseColor = activeTheme
    ? CTA_BG
    : (copy.responseColorMode === 'white' ? '#FFFFFF' : palettes[palette].fix[0])
  const sublineColor = activeTheme
    ? `oklch(from ${activeTheme.accent} calc(l + 0.15) calc(c * 0.6) h)`
    : `color-mix(in oklch, ${CTA_BG} 45%, white)`

  // ── Renderer choice (see docs/architecture/2026-11-21-state-machines.md) ──
  //   grid off                    → Paper stack, warp reveals whole dither cells
  //   grid on, points or snapped  → GPU tile field (draws the warp itself)
  //   grid on, colour, snap off   → Paper + CSS tile mask, warp via PNG masks
  const gridOn = pixelGrid.enabled
  const gridSnap = gridOn && pixelGrid.snap
  const pointSizeMode = gridOn && anim.tileDisplay === 'points'
  const snapColorMode = gridSnap && anim.tileDisplay === 'color'
  const pointCanvasMode = pointSizeMode || snapColorMode
  const gridPitch = pixelGridPitch(pixelGrid)

  // Measured shader-container size (masks and the GPU field work in px).
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  // ── Paper render scale ──
  // Paper draws dither cells per render pixel, so a cell is a whole number of
  // device pixels only when the render scale is a whole number. Native DPR on
  // small screens; 1 CSS px per render px on desktop (`image-rendering:
  // pixelated` in index.css scales it up without blur). The old 500k-pixel cap
  // gave a fractional scale and blurred every dot.
  const dpr = Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const paperW = containerSize.w || (typeof window !== 'undefined' ? window.innerWidth : 1440)
  const paperH = containerSize.h || (typeof window !== 'undefined' ? window.innerHeight : 900)
  const paperScale = paperW < 1280 && paperW * paperH * dpr * dpr <= 4_200_000 ? dpr : 1
  const paperMaxPixelCount = Math.ceil(paperW * paperH * paperScale * paperScale)
  // The snapped field centres its lattice on the hero, on a whole pixel. The
  // tile-mask path shares Paper's own lattice (cells start at floor(W / 2)
  // render px from the left, ceil(H / 2) from the top) and draws one Paper
  // cell per tile, so every tile is exactly one dither cell: no tile is split
  // between two cells, whatever the grid and gap.
  const tileMaskPath = gridOn && !pointCanvasMode
  const grid = useMemo(() => {
    if (tileMaskPath) {
      const rw = Math.round(paperW * paperScale), rh = Math.round(paperH * paperScale)
      return tileGrid(pixelGrid,
        positiveModulo(Math.floor(rw / 2) / paperScale, gridPitch),
        positiveModulo(Math.ceil(rh / 2) / paperScale, gridPitch))
    }
    return tileGrid(
      pixelGrid,
      gridSnap ? Math.floor(containerSize.w / 2) % gridPitch : 0,
      gridSnap ? Math.floor(containerSize.h / 2) % gridPitch : 0,
    )
  }, [pixelGrid, gridSnap, tileMaskPath, gridPitch, containerSize.w, containerSize.h, paperW, paperH, paperScale])
  // Points mode shifts rows so the first whole row starts at Top start; the
  // warp must share that row phase or it would cut dots into slivers.
  const tileAlignY = pointCanvasMode && edge.topInset > 0
    ? grid.alignY + positiveModulo(edge.topInset - grid.alignY, gridPitch)
    : grid.alignY

  /** Paper dither cell in CSS px — whole pixels. */
  const paperCell = tileMaskPath ? gridPitch : Math.max(1, Math.round(c.size))

  // ── Dissolve edge (Paper + CSS tile grid only; the GPU field draws its own) ──
  const dissolveOn = gridOn && !pointCanvasMode && edge.mode === 'dissolve'
  const [maskAnimT, setMaskAnimT] = useState(0)
  // Accumulated motion time lives in a ref so slider tweaks (which re-run the
  // rAF effect) resume from the current phase instead of snapping back to 0.
  const maskAnimTRef = useRef(0)
  const dissolveUrl = useMemo(
    () => dissolveOn
      ? buildDissolveMaskUrl(
          edge.position, edge.dissolveDepth, gridPitch,
          containerSize.w, containerSize.h, grid.alignY, grid.alignX, edge.dissolveSeed,
          edge.textBlendMotion > 0 ? { t: maskAnimT, strength: edge.textBlendMotion, scale: 1.5 } : undefined,
          edge.shaderExtend > 0 ? edge.shaderExtend : 0,
        )
      : undefined,
    [dissolveOn, edge.position, edge.dissolveDepth, edge.dissolveSeed, edge.textBlendMotion, edge.shaderExtend,
      maskAnimT, gridPitch, containerSize.w, containerSize.h, grid.alignY, grid.alignX],
  )
  const restMaskStyle = !gridOn || pointCanvasMode
    ? undefined
    : dissolveUrl ? buildDissolveContainerStyle(grid, dissolveUrl) : buildPixelGridMask(grid)

  // ── Drift loop ──
  // Drift lives in a ref and never re-renders the hero: every frame the loop
  // writes opacities to the layer wrappers and pushes the sizing uniforms
  // straight to each Paper mount, and the GPU field reads the ref itself.
  // Start on the selected scene's baseline (no one-frame flash of zero drift).
  const driftRef = useRef<AnimDrift>(initialDriftForScene(activeScene))
  const drift = driftRef.current
  // Motion clock in seconds, advanced by dt × Speed. Oscillations read it
  // instead of wall time, so changing Speed never jumps their phase.
  const clockRef = useRef(0)
  const [, setDriftTick] = useState(0)
  const pushPaperUniformsRef = useRef<() => void>(() => {})
  const colorCycleRef = useRef(c.colorCycleSpeed)
  colorCycleRef.current = c.colorCycleSpeed
  const stableFieldRef = useRef(stableColorField)
  stableFieldRef.current = stableColorField
  const alphaLayersRef = useRef(c.alphaLayers)
  alphaLayersRef.current = c.alphaLayers
  const alphaWrapperRefs = useRef<(HTMLDivElement | null)[]>([])
  const renderedSceneRef = useRef<SceneTemplateId | null | undefined>(activeScene)

  useEffect(() => {
    // A scene selection owns a fresh, recognizable baseline. Fine-tuning the
    // active scene does not reset it because the scene ID remains unchanged.
    if (renderedSceneRef.current !== activeScene) {
      renderedSceneRef.current = activeScene
      driftRef.current = initialDriftForScene(activeScene)
      setDriftTick((n) => n + 1)
    }
    if (!anim.playing) return

    const isOscillate = anim.scanMode === 'oscillate' && anim.scanAmplitude > 0
    const hasWave = anim.waveAmplitude > 0
    const hasLoopBreak = anim.loopBreak !== 'none' && anim.loopBreakAmount > 0
    const needsLoopSettle = driftRef.current.loopX !== 0 || driftRef.current.loopY !== 0
    const hasDrift = anim.driftX !== 0 || anim.driftY !== 0 || anim.rotationDrift !== 0 || anim.pulseAmount !== 0
      || colorCycleRef.current > 0 || isOscillate || hasWave || hasLoopBreak || needsLoopSettle
    if (!hasDrift) return

    let running = true
    let last = performance.now()
    const scanRad = anim.scanAngle * Math.PI / 180
    const waveRad = anim.waveAngle * Math.PI / 180
    const m = spatialMotionScale

    function tick(now: number) {
      if (!running) return
      // Clamp dt to prevent jumps after tab-away
      const dt = Math.min((now - last) / 1000, 0.1) * timeScale
      last = now
      clockRef.current += dt
      const t = clockRef.current
      const d = driftRef.current

      if (isOscillate) {
        const scanVal = anim.scanAmplitude * m * Math.sin(t * anim.scanSpeed * Math.PI * 2)
        d.offsetX = scanVal * Math.cos(scanRad)
        d.offsetY = scanVal * Math.sin(scanRad)
      } else {
        d.offsetY += anim.driftY * m * dt
        d.offsetX += anim.driftX * m * dt
        if (d.offsetY > 2) d.offsetY -= 4
        if (d.offsetY < -2) d.offsetY += 4
        if (d.offsetX > 2) d.offsetX -= 4
        if (d.offsetX < -2) d.offsetX += 4
      }
      if (hasWave) {
        const waveVal = anim.waveAmplitude * m * Math.sin(t * anim.waveSpeed * Math.PI * 2)
        d.waveOriginX = waveVal * Math.cos(waveRad)
        d.waveOriginY = waveVal * Math.sin(waveRad)
      }
      d.rotation += anim.rotationDrift * m * dt
      d.scale = anim.pulseAmount * m * Math.sin(t * anim.pulseSpeed * Math.PI * 2)
      d.colorPhase += colorCycleRef.current * dt

      // Loop break — non-looping motion on its own channel (loopX/loopY).
      if (hasLoopBreak) {
        const amt = anim.loopBreakAmount
        const lb = anim.loopBreak
        const PAN = 0.06 // units/sec per unit amount — readable, not frantic
        if (lb === 'rotate' || lb === 'orbit') d.rotation += amt * 8 * m * dt
        if (lb === 'drift' || lb === 'orbit') {
          d.loopX += amt * PAN * m * dt
          if (d.loopX > 2) d.loopX -= 4
          if (d.loopX < -2) d.loopX += 4
        }
        if (lb === 'wander') {
          const ang = t * 0.06 // direction slowly turns → organic, no clean cycle
          d.loopX += Math.cos(ang) * amt * PAN * m * dt
          d.loopY += Math.sin(ang) * amt * PAN * m * dt
          if (d.loopX > 2) d.loopX -= 4; else if (d.loopX < -2) d.loopX += 4
          if (d.loopY > 2) d.loopY -= 4; else if (d.loopY < -2) d.loopY += 4
          d.rotation += amt * 2.5 * m * dt
        }
      } else if (d.loopX !== 0 || d.loopY !== 0) {
        // Loop break turned off — settle the pan back to neutral.
        d.loopX *= 0.92
        d.loopY *= 0.92
        if (Math.abs(d.loopX) < 1e-3) d.loopX = 0
        if (Math.abs(d.loopY) < 1e-3) d.loopY = 0
      }

      // Opacity of the screen-blended Paper layers.
      const wrappers = alphaWrapperRefs.current
      const layers = alphaLayersRef.current
      if (stableFieldRef.current) {
        // Layers view: hold each layer at its authored opacity. Under screen
        // blending the swing below pulses the composite once per cycle.
        for (let i = 0; i < layers.length; i++) {
          const el = wrappers[i]
          if (el) el.style.opacity = String(layers[i].opacity)
        }
      } else if (colorCycleRef.current > 0) {
        // Layers trade emphasis; the correction keeps the summed alpha as
        // authored, so the field never brightens or dims once per cycle.
        const count = layers.length
        const authoredTotal = layers.reduce((sum, layer) => sum + layer.opacity, 0)
        const animated = layers.map((layer, i) =>
          layer.opacity * (1 + 0.1 * Math.sin(d.colorPhase * Math.PI * 2 + (i / count) * Math.PI * 2)))
        const animatedTotal = animated.reduce((sum, v) => sum + v, 0)
        const correction = animatedTotal > 0 ? authoredTotal / animatedTotal : 1
        for (let i = 0; i < count; i++) {
          const el = wrappers[i]
          if (el) el.style.opacity = String(Math.min(1, animated[i] * correction))
        }
      }

      pushPaperUniformsRef.current()
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    return () => { running = false }
  }, [activeScene, spatialMotionScale, timeScale, anim.playing, anim.driftX, anim.driftY, anim.rotationDrift, anim.pulseAmount, anim.pulseSpeed, anim.scanMode, anim.scanAmplitude, anim.scanSpeed, anim.scanAngle, anim.waveAmplitude, anim.waveSpeed, anim.waveAngle, anim.loopBreak, anim.loopBreakAmount])


  // Sync hero colors to CSS custom properties so the header matches.
  // Must target the [data-palette] element — it overrides documentElement in the cascade.
  const THEME_VARS = [
    '--color-t-bg', '--color-t-bg-surface', '--color-t-headline', '--color-t-body',
    '--color-t-muted', '--color-t-cta-bg', '--color-t-cta-text', '--color-t-cta2-text',
    '--color-t-cta2-border', '--color-t-border', '--color-t-border-strong',
    '--font-hero-display', '--font-hero-cta',
  ] as const
  useEffect(() => {
    const paletteEl = document.querySelector<HTMLElement>('[data-palette]')
    const target = paletteEl ?? document.documentElement
    target.style.setProperty('--color-t-bg', c.colorBack)
    // Publish the template's display face so brand + action surfaces outside the
    // hero (header wordmark, header CTAs) can carry the same character. Nav
    // links deliberately do NOT consume this: they're 14px utility, and a
    // hairline display serif goes weak and hard to scan at that size.
    target.style.setProperty(
      '--font-hero-display',
      copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)',
    )
    // CTAs can opt out of the display face (see DitherCopy.ctaFont).
    target.style.setProperty(
      '--font-hero-cta',
      copy.ctaFont || copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)',
    )

    // The header CTA and the mark's glow follow the hero CTA in every mode,
    // not only under a terminal theme, so a palette change recolours them too.
    target.style.setProperty('--color-t-cta-bg', CTA_BG)
    target.style.setProperty('--color-t-cta-text', ctaTextColor)

    if (activeTheme) {
      target.style.setProperty('--color-t-bg-surface', activeTheme.surface)
      target.style.setProperty('--color-t-headline', activeTheme.fg)
      target.style.setProperty('--color-t-body', `oklch(from ${activeTheme.fg} l c h / 0.65)`)
      target.style.setProperty('--color-t-muted', activeTheme.comment)
      target.style.setProperty('--color-t-cta2-text', `oklch(from ${activeTheme.fg} l c h / 0.8)`)
      target.style.setProperty('--color-t-cta2-border', `oklch(from ${activeTheme.fg} l c h / 0.15)`)
      target.style.setProperty('--color-t-border', `oklch(from ${activeTheme.fg} l c h / 0.1)`)
      target.style.setProperty('--color-t-border-strong', `oklch(from ${activeTheme.fg} l c h / 0.15)`)
    }

    return () => {
      for (const v of THEME_VARS) target.style.removeProperty(v)
    }
  }, [c.colorBack, activeTheme, CTA_BG, ctaTextColor, copy.headlineFont, copy.ctaFont])

  // The Problem palette uses simplex/warp, whose motion reads much more slowly
  // than the Fix palette's swirl/wave at the same authored scene values. Keep
  // scenes state-agnostic in the store, then normalize their rendered energy so
  // switching Initial state never makes a playing scene look paused. Point-size
  // rendering (Full Bleed) and the intentionally near-static Classic scene are
  // left exactly as authored.
  const problemMotionBoost = initialState === 'problem'
    && anim.tileDisplay === 'color'
    && activeScene != null
    // The id is `solid-classic` — `classic` is only the display label, and
    // comparing against it silently never matches.
    && activeScene !== 'solid-classic'
    ? 1.8
    : 1

  // Compose base config + drift (Paper path). Paused = fully static: a zero
  // speed stops the Paper mount's own rAF, so paused frames cost no GPU work.
  const effectiveOffsetX = (drift.offsetX + drift.loopX) * problemMotionBoost
  const effectiveOffsetY = (drift.offsetY + drift.loopY) * problemMotionBoost
  const effectiveRotation = c.rotation + drift.rotation * problemMotionBoost
  const effectiveScale = c.scale + drift.scale * problemMotionBoost
  const effectiveSpeed = anim.playing ? c.speed * problemMotionBoost * spatialMotionScale * timeScale : 0


  // Measure the copy area in container coordinates: the block's top edge
  // bounds the dot band in every mode (its solid bg must never flat-cut a
  // shape), and 'full' mode additionally needs the individual text rects
  // (headline, sub, response, CTAs) to flow around. Re-measures on resize.
  const contentRef = useRef<HTMLDivElement>(null)
  const [textRects, setTextRects] = useState<TextRect[]>([])
  const [contentTop, setContentTop] = useState<number | null>(null)
  const lockHeadlineRef = useRef<HTMLHeadingElement>(null)
  const lockSubRef = useRef<HTMLParagraphElement>(null)
  const lockResponseWrapRef = useRef<HTMLDivElement>(null)
  const lockCtaRef = useRef<HTMLAnchorElement>(null)
  useHeadlineFit(lockHeadlineRef, `${copyVariant}|${typePair}|${copy.headlineSize}`)
  const fontsLoaded = useFontsLoaded()
  const [baselineNudge, setBaselineNudge] = useState({ response: 0, cta: 0, subGap: 0 })
  useEffect(() => {
    const content = contentRef.current
    const host = shaderContainerRef.current
    if (!content || !host) return
    const needRects = edge.mode === 'full'
    const measure = () => {
      const hostRect = host.getBoundingClientRect()
      setContentTop((prev) => {
        const top = Math.round(content.getBoundingClientRect().top - hostRect.top)
        return prev === top ? prev : top
      })
      if (!needRects) return
      const rects: TextRect[] = []
      content.querySelectorAll('h1, p, a').forEach((el) => {
        // Buttons and bubbled text keep their element box — the pill IS the
        // visual. In 'lines' mode plain text contributes one rect PER RENDERED
        // LINE, so the clearance hugs the real glyphs; 'box' mode clears the
        // whole element rectangle for calmer, blocky negative space.
        const isBox = edge.textRectMode === 'box'
          || el.tagName === 'A'
          || getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'
        if (isBox) {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            rects.push({ x: r.left - hostRect.left, y: r.top - hostRect.top, w: r.width, h: r.height })
          }
          return
        }
        const range = document.createRange()
        range.selectNodeContents(el)
        for (const r of range.getClientRects()) {
          if (r.width < 4 || r.height < 6) continue
          rects.push({ x: r.left - hostRect.left, y: r.top - hostRect.top, w: r.width, h: r.height })
        }
      })
      setTextRects((prev) => (JSON.stringify(prev) === JSON.stringify(rects) ? prev : rects))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(content)
    ro.observe(host)
    return () => ro.disconnect()
    // baselineNudge: transforms don't fire the ResizeObserver, so re-measure
    // the exclusion rects after the baseline lock shifts the right column.
  }, [edge.mode, edge.textRectMode, copyVariant, typePair, layout, baselineNudge, fontsLoaded])

  // Baseline lock (problem layout) — the right column snaps to the left one:
  // the response's last line shares the headline's last baseline, the CTA
  // label shares the sub's last baseline. Nudges accumulate incrementally
  // (target minus current, measured post-transform) so the lock converges and
  // then holds across font, size, and copy changes.
  useEffect(() => {
    if (copy.layout !== 'problem') return
    // Generous bound: at wide viewports the CTA's natural distance from the
    // sub's last baseline can exceed 50px — a tight clamp saturates just
    // short of the target and the lock visibly misses.
    const clampNudge = (v: number) => Math.max(-200, Math.min(200, Math.round(v * 2) / 2))
    // The lock aligns the right column to the left one — it only makes sense
    // while the two-column grid is active. While stacked, any nudge would drag
    // the response up over the headline. Must track the same breakpoint the
    // grid uses (per-variant: lg when the variant stacks at tablet, else md).
    const twoCol = window.matchMedia(stackTablet ? '(min-width: 1024px)' : '(min-width: 768px)')
    const measure = () => {
      if (!twoCol.matches) {
        setBaselineNudge((prev) => (prev.response === 0 && prev.cta === 0 && prev.subGap === 0 ? prev : { response: 0, cta: 0, subGap: 0 }))
        return
      }
      const h1El = lockHeadlineRef.current
      const respP = lockResponseWrapRef.current?.querySelector('p')
      const subEl = lockSubRef.current
      const ctaEl = lockCtaRef.current
      setBaselineNudge((prev) => {
        let { response, cta, subGap } = prev
        const hB = h1El && lastLineBaseline(h1El)
        const rB = respP && lastLineBaseline(respP)
        if (hB != null && rB != null && Math.abs(hB - rB) > 0.5) response = clampNudge(response + (hB - rB))
        const sB = subEl && lastLineBaseline(subEl)
        // The CTA label sits on the sub's last baseline, so the button text
        // and the sub read as one line of type across the two columns.
        const cB = ctaEl && lastLineBaseline(ctaEl)
        if (sB != null && cB != null && Math.abs(sB - cB) > 0.5) cta = clampNudge(cta + (sB - cB))
        // Both locks pull the response and the CTA toward each other. When the
        // headline's last baseline and the sub's last baseline sit closer than
        // the response + CTA stack needs (a one-line sub), they collide. Open
        // the headline→sub gap by the overlap instead of breaking either lock:
        // the headline rises, the response follows it, and both baselines hold.
        // Negative overlap (spare room) shrinks the extra gap back toward 0.
        if (copy.responsePin !== 'cta' && respP && ctaEl) {
          const respBottom = respP.getBoundingClientRect().bottom + (response - prev.response)
          const ctaTop = ctaEl.getBoundingClientRect().top + (cta - prev.cta)
          const overlap = respBottom + MIN_RESPONSE_CTA_GAP - ctaTop
          if (Math.abs(overlap) > 0.5) {
            const nextGap = Math.max(0, Math.min(200, Math.round((subGap + overlap) * 2) / 2))
            // The grid is bottom-anchored, so the extra gap lifts the headline
            // by the same amount: move the response with it in this step, or
            // the two corrections fight across frames and overshoot.
            response = clampNudge(response - (nextGap - subGap))
            subGap = nextGap
          }
        }
        return response === prev.response && cta === prev.cta && subGap === prev.subGap ? prev : { response, cta, subGap }
      })
    }
    // A transform does not wake ResizeObserver, so give the baseline lock a
    // small, bounded convergence window after its inputs change. Keeping
    // baselineNudge in this effect's dependency list made the effect feed its
    // own state update indefinitely when half-pixel font metrics alternated.
    // Three frames are enough for the two measured columns to settle without
    // creating a render loop.
    const settleFrames: number[] = []
    measure()
    settleFrames.push(requestAnimationFrame(() => {
      measure()
      settleFrames.push(requestAnimationFrame(measure))
    }))
    const content = contentRef.current
    const ro = content ? new ResizeObserver(measure) : null
    if (ro && content) ro.observe(content)
    // Viewport-height changes reposition the grid without resizing the
    // content box, so the ResizeObserver alone misses them.
    window.addEventListener('resize', measure)
    twoCol.addEventListener('change', measure)
    return () => {
      settleFrames.forEach(cancelAnimationFrame)
      ro?.disconnect()
      window.removeEventListener('resize', measure)
      twoCol.removeEventListener('change', measure)
    }
  }, [copy.layout, copy.responsePin, copyVariant, typePair, stackTablet, layout.headlineCols, layout.responseCols, layout.gutter,
    containerSize.w, fontsLoaded])

  // Baseline guides — debug overlay for alignment checks. One line per
  // rendered text line (headline, sub, response, CTAs), computed from the
  // line's content box and the font's own ascent (lineBaselines).
  const [baselineGuides, setBaselineGuides] = useState<number[]>([])
  useEffect(() => {
    if (!layout.showBaselines) return
    const content = contentRef.current
    const host = shaderContainerRef.current
    if (!content || !host) return
    const measure = () => {
      const hostTop = host.getBoundingClientRect().top
      const lines: number[] = []
      content.querySelectorAll('h1, p, a').forEach((el) => {
        for (const y of lineBaselines(el, 8)) lines.push(Math.round(y - hostTop))
      })
      const unique = [...new Set(lines)].sort((a, b) => a - b)
      setBaselineGuides((prev) => (JSON.stringify(prev) === JSON.stringify(unique) ? prev : unique))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(content)
    ro.observe(host)
    return () => ro.disconnect()
  }, [layout.showBaselines, copyVariant, typePair, layout, baselineNudge, fontsLoaded])

  // Layout guides — debug overlay for the frame every element should sit on.
  // Columns and left/right edges come from CSS (the overlay reuses the copy
  // container's max-width, padding and grid). Top/bottom edges are measured:
  // the header row's content box and the copy block's content box.
  const copyBoxRef = useRef<HTMLDivElement>(null)
  const [edgeGuides, setEdgeGuides] = useState<{ y: number; label: string }[]>([])
  useEffect(() => {
    if (!layout.showGuides) return
    const host = shaderContainerRef.current
    const box = copyBoxRef.current
    if (!host || !box) return
    const header = document.querySelector<HTMLElement>('header > div')
    const contentBox = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { top: r.top + parseFloat(cs.paddingTop), bottom: r.bottom - parseFloat(cs.paddingBottom) }
    }
    const measure = () => {
      const hostRect = host.getBoundingClientRect()
      const next: { y: number; label: string }[] = []
      if (header) {
        const h = contentBox(header)
        next.push({ y: Math.round(h.top - hostRect.top), label: 'nav top' })
        next.push({ y: Math.round(h.bottom - hostRect.top), label: 'nav bottom' })
      }
      const c = contentBox(box)
      next.push({ y: Math.round(c.top - hostRect.top), label: 'copy top' })
      next.push({ y: Math.round(c.bottom - hostRect.top), label: `copy bottom · ${Math.round(hostRect.bottom - c.bottom)}px to edge` })
      setEdgeGuides((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    ro.observe(host)
    if (header) ro.observe(header)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [layout.showGuides, copyVariant, typePair, layout, fontsLoaded])

  const POINT_FLOW_CELLS = 6

  // ── Mask loop: field time for the dissolve rim, the snapped colour field
  // and point sizes. The GPU field reads the ref; CSS masks need a commit. ──
  const pointCanvasModeRef = useRef(false)
  pointCanvasModeRef.current = pointCanvasMode
  useEffect(() => {
    const needsDissolveMotion = edge.mode === 'dissolve' && edge.textBlendMotion > 0 && edge.textBlendSpeed > 0
    const snapMotionRate = Math.max(
      c.speed * spatialMotionScale,
      c.colorCycleSpeed * 0.25,
      (Math.abs(anim.driftX) + Math.abs(anim.driftY)) * spatialMotionScale,
      Math.abs(anim.rotationDrift) * 0.01 * spatialMotionScale,
      anim.pulseAmount > 0 ? anim.pulseSpeed * spatialMotionScale : 0,
      anim.waveAmplitude > 0 ? anim.waveSpeed * spatialMotionScale : 0,
    )
    const needsSizeMotion = pointSizeMode && anim.tileSizeSpread > 0 && anim.tileSizeSpeed > 0
    const needsSnapMotion = snapColorMode && snapMotionRate > 0
    if (!anim.playing || (!needsDissolveMotion && !needsSizeMotion && !needsSnapMotion)) return

    let running = true
    let last = performance.now()
    let lastUpdate = 0
    const interval = 1000 / (snapColorMode ? 24 : 12)

    function tick(now: number) {
      if (!running) return
      const dt = Math.min((now - last) / 1000, 0.1) * timeScale
      last = now
      if (needsDissolveMotion) maskAnimTRef.current += dt * edge.textBlendSpeed
      else if (needsSnapMotion) maskAnimTRef.current += dt * snapMotionRate
      else if (needsSizeMotion) maskAnimTRef.current += dt * anim.tileSizeSpeed
      if (!pointCanvasModeRef.current && now - lastUpdate >= interval) {
        lastUpdate = now
        setMaskAnimT(maskAnimTRef.current)
      }
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    return () => { running = false }
  }, [anim.playing, pointSizeMode, snapColorMode, anim.tileSizeSpread, anim.tileSizeSpeed,
    anim.driftX, anim.driftY, anim.rotationDrift, anim.pulseAmount, anim.pulseSpeed,
    anim.waveAmplitude, anim.waveSpeed, c.speed, c.colorCycleSpeed, spatialMotionScale, timeScale,
    edge.mode, edge.textBlendMotion, edge.textBlendSpeed])

  // ── Hover: warp reveal in a pixel circle ──
  // One rAF loop while the pointer is over the hero or the radius settles. Three
  // ways to draw it, by renderer (hoverPath):
  //   'gpu'   — the tile field draws the warp from hoverAnim; only the tip commits
  //   'mask'  — Paper + CSS tile grid: a clip-path cover plus a small PNG reveal mask
  //   'cells' — Paper without a grid: the reveal layer is clipped to whole dither
  //             cells (no rotation; the field's own dots, no tile shapes)
  const shaderContainerRef = useRef<HTMLDivElement>(null)
  const fixLayerRef = useRef<HTMLDivElement>(null)
  // The reveal Paper stack mounts on the first move and unmounts 2 s after the
  // pointer leaves: each stack holds 3 WebGL contexts (browsers cap ~16).
  const [hoverActive, setHoverActive] = useState(false)
  const hoverActiveRef = useRef(false)
  hoverActiveRef.current = hoverActive
  // WebGL context-loss recovery: a lost context leaves its canvas blank, so
  // bump the epoch, which remounts the stacks with fresh canvases.

  const [glEpoch, setGlEpoch] = useState(0)
  useEffect(() => {
    const el = shaderContainerRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const host = shaderContainerRef.current
    if (!host) return
    const id = window.setInterval(() => {
      for (const cv of host.querySelectorAll('canvas')) {
        const gl = cv.getContext('webgl2') || cv.getContext('webgl')
        if (gl && gl.isContextLost()) {
          setGlEpoch((e) => e + 1)
          return
        }
      }
    }, 3000)
    return () => clearInterval(id)
  }, [])

  // Track the shader container's pixel size so the pixelated ripple can be
  // built in px (matching the tile grid).
  useEffect(() => {
    const el = shaderContainerRef.current
    if (!el) return
    const update = () => {
      const next = { w: el.clientWidth, h: el.clientHeight }
      // WebGL/canvas commits can wake ResizeObserver even when the host did not
      // actually resize. Returning the previous object prevents that callback
      // from feeding the 24fps drift render back into another React update.
      setContainerSize((prev) => prev.w === next.w && prev.h === next.h ? prev : next)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const hoverPath: 'gpu' | 'mask' | 'cells' = pointCanvasMode ? 'gpu' : gridOn ? 'mask' : 'cells'
  const hoverPathRef = useRef(hoverPath)
  hoverPathRef.current = hoverPath
  const [tip, setTip] = useState<Tip | null>(null)
  const hoverAnim = useRef({ radius: 0, px: 0, py: 0, hovering: false, rafId: 0, cw: 0, ch: 0 })
  const radiusRef = useRef(hover.radius)
  radiusRef.current = hover.radius
  const warpShapeRef = useRef<WarpShape>({ rotate: 0, round: 0, scale: 1, spread: 0 })
  warpShapeRef.current = { rotate: hover.warpRotate, round: hover.warpRound, scale: hover.warpScale, spread: hover.warpJitter }
  // 'mask' path grid; the PNG masks are drawn at device DPR (max 2) for crisp tile edges.
  const maskGridRef = useRef(grid)
  maskGridRef.current = grid
  const maskDpr = Math.min(2, dpr)
  const maskDprRef = useRef(maskDpr)
  maskDprRef.current = maskDpr
  // 'cells' path lattice: Paper's dither cells start at floor(W / 2) render px
  // from the left and ceil(H / 2) from the top (its pixelisation is anchored
  // at the canvas centre, y up). The clip shares that lattice, so every
  // revealed cell is whole.
  const cellGridRef = useRef({ pitch: 1, alignX: 0, alignY: 0 })
  {
    const rw = Math.round(containerSize.w * paperScale)
    const rh = Math.round(containerSize.h * paperScale)
    cellGridRef.current = {
      pitch: paperCell,
      alignX: positiveModulo(Math.floor(rw / 2) / paperScale, paperCell),
      alignY: positiveModulo(Math.ceil(rh / 2) / paperScale, paperCell),
    }
  }
  // 'mask' path: the resting tile mask never changes during a hover (swapping
  // a full-hero mask under three Paper layers cost 20–90 ms frames). Instead a
  // background-coloured cover hides the resting tiles in the circle (a cheap
  // clip-path) and the reveal layer gets a small mask of the warped tiles only,
  // both written straight to the DOM with no React commit.
  const coverRef = useRef<HTMLDivElement>(null)
  const revealCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const warpGenRef = useRef({ px: -1, py: -1, r: -1, key: '' })
  const warpEncodingRef = useRef(false)
  const warpLastStartRef = useRef(0)
  const warpTokenRef = useRef(0)
  const hoverReleaseTimer = useRef(0)
  const tileDirtyRef = useRef(true)

  useEffect(() => {
    if (!hover.enabled) return
    const el = shaderContainerRef.current
    if (!el) return
    let running = true
    let lastTipUpdate = 0
    let tipShown = false

    function startLoop() {
      if (hoverAnim.current.rafId) return
      hoverAnim.current.rafId = requestAnimationFrame(animate)
    }

    function handleMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect()
      const a = hoverAnim.current
      a.px = e.clientX - rect.left
      a.py = e.clientY - rect.top
      a.cw = rect.width
      a.ch = rect.height
      a.hovering = true
      if (hoverReleaseTimer.current) {
        clearTimeout(hoverReleaseTimer.current)
        hoverReleaseTimer.current = 0
      }
      if (!hoverActiveRef.current) setHoverActive(true)
      startLoop()
    }

    function handleLeave() {
      hoverAnim.current.hovering = false
      if (hoverReleaseTimer.current) clearTimeout(hoverReleaseTimer.current)
      hoverReleaseTimer.current = window.setTimeout(() => {
        hoverReleaseTimer.current = 0
        setHoverActive(false)
      }, 2000)
    }

    function animate() {
      if (!running) return
      const a = hoverAnim.current
      a.rafId = 0
      const now = performance.now()
      const target = a.hovering ? radiusRef.current : 0
      a.radius += (target - a.radius) * 0.08
      if (a.radius < 1 && target === 0) a.radius = 0
      tileDirtyRef.current = true

      // Error-text tip, 12 commits/s at most.
      if (a.radius <= 0) {
        if (tipShown) { tipShown = false; setTip(null) }
      } else if (now - lastTipUpdate >= 1000 / 12) {
        lastTipUpdate = now
        tipShown = true
        setTip({ px: a.px, py: a.py, r: a.radius })
      }

      const fixEl = fixLayerRef.current
      const path = hoverPathRef.current
      if (path === 'cells') {
        if (fixEl) {
          const g = cellGridRef.current
          fixEl.style.clipPath = buildWholeTileCircleClip(
            a.px, a.py, pixelCircleRadius(a.radius, g.pitch), g.pitch, g.alignX, g.alignY, a.cw, a.ch,
          )
          fixEl.style.visibility = a.radius > 0 ? 'visible' : 'hidden'
        }
      } else if (path === 'mask') {
        const g = maskGridRef.current
        const gen = warpGenRef.current
        if (a.radius > 0 && a.cw > 0) {
          const w = warpShapeRef.current
          const dprM = maskDprRef.current
          const key = [g.pitch, g.alignX, g.alignY, g.piece, g.inset, g.radius, w.rotate, w.round, w.scale, w.spread, dprM].join(':')
          const moved = Math.abs(a.px - gen.px) >= 2 || Math.abs(a.py - gen.py) >= 2 || Math.abs(a.radius - gen.r) >= 2
          // One encode in flight at a time; the next build picks up the latest cursor.
          if (!warpEncodingRef.current && now - warpLastStartRef.current >= WARP_MASK_INTERVAL && (moved || gen.key !== key)) {
            revealCanvasRef.current ??= document.createElement('canvas')
            const px = a.px, py = a.py, r = a.radius
            const box = buildRevealMask(revealCanvasRef.current, px, py, r, g, w, dprM)
            gen.px = px; gen.py = py; gen.r = r; gen.key = key
            const token = ++warpTokenRef.current
            warpEncodingRef.current = true
            warpLastStartRef.current = now
            ;(box ? canvasToDataUrl(revealCanvasRef.current) : Promise.resolve(null)).then((url) => {
              warpEncodingRef.current = false
              // Dropped if the warp was cleared or the effect re-ran meanwhile.
              if (!running || token !== warpTokenRef.current) return
              const fix = fixLayerRef.current
              const cover = coverRef.current
              // Cover and reveal move together, on the cursor the mask was built for.
              if (cover) {
                cover.style.clipPath = buildWholeTileCircleClip(px, py, pixelCircleRadius(r, g.pitch), g.pitch, g.alignX, g.alignY, a.cw, a.ch)
                cover.style.visibility = 'visible'
              }
              if (fix) {
                if (url && box) {
                  const m = { image: `url(${url})`, pos: `${box.x}px ${box.y}px`, size: `${box.w}px ${box.h}px` }
                  fix.style.maskImage = m.image; fix.style.webkitMaskImage = m.image
                  fix.style.maskPosition = m.pos; fix.style.webkitMaskPosition = m.pos
                  fix.style.maskSize = m.size; fix.style.webkitMaskSize = m.size
                  fix.style.visibility = 'visible'
                } else fix.style.visibility = 'hidden'
              }
              startLoop()
            })
          }
        } else if (gen.r !== -1) {
          warpGenRef.current = { px: -1, py: -1, r: -1, key: '' }
          warpTokenRef.current++
          if (fixEl) fixEl.style.visibility = 'hidden'
          if (coverRef.current) coverRef.current.style.visibility = 'hidden'
        }
      }

      if (a.radius > 0.5 || a.hovering) a.rafId = requestAnimationFrame(animate)
    }

    // Listen on the section: the copy sits above the field and would
    // otherwise swallow every move over the headline.
    const target = el.closest('section') ?? el
    target.addEventListener('mousemove', handleMove)
    target.addEventListener('mouseleave', handleLeave)
    return () => {
      running = false
      if (hoverAnim.current.rafId) cancelAnimationFrame(hoverAnim.current.rafId)
      hoverAnim.current.rafId = 0
      if (hoverReleaseTimer.current) {
        clearTimeout(hoverReleaseTimer.current)
        hoverReleaseTimer.current = 0
      }
      target.removeEventListener('mousemove', handleMove)
      target.removeEventListener('mouseleave', handleLeave)
    }
  }, [hover.enabled])

  // Leaving the 'mask' path (template or renderer change) drops a stale cover.
  useEffect(() => {
    if (hoverPath === 'mask') return
    warpGenRef.current = { px: -1, py: -1, r: -1, key: '' }
    warpTokenRef.current++
    if (coverRef.current) coverRef.current.style.visibility = 'hidden'
  }, [hoverPath])

  // ── GPU tile field (Point sizes, snapped colour, and the warp on top) ──
  // One WebGL2 canvas drawn from a rAF loop that reads refs: drift, field time,
  // hover. No React commit, no PNG mask, no mask-image swap per frame.
  const tileCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tileFieldFailed, setTileFieldFailed] = useState(false)
  // Frame builder — rebuilt each render so it closes over the latest config;
  // everything that moves is read from refs at call time.
  const buildTileFrameRef = useRef<() => TileFieldFrame | null>(() => null)
  buildTileFrameRef.current = () => {
    const w = containerSize.w, h = containerSize.h
    if (!w || !h) return null
    const d = driftRef.current
    const flowX = (d.offsetX + d.loopX + d.waveOriginX) * POINT_FLOW_CELLS
    const flowY = (d.offsetY + d.loopY + d.waveOriginY) * POINT_FLOW_CELLS
    const field = (layers: { color: string; opacity: number }[]) => ({
      layers: layers.map(({ color, opacity }) => ({ color, opacity })),
      mapScale: snapColorMode ? c.scale + d.scale : anim.tileSizeNoise * (1 + d.scale),
      flowX, flowY,
      rotationDeg: snapColorMode ? c.rotation + d.rotation : d.rotation,
    })
    const posPct = (edge.position / 100) * h
    const a = hoverAnim.current
    const w2 = warpShapeRef.current
    return {
      w, h,
      grid: { pitch: grid.pitch, gap: grid.gap, radius: grid.radius, alignX: grid.alignX, alignY: tileAlignY },
      t: maskAnimTRef.current * spatialMotionScale,
      colorPhase: d.colorPhase,
      spread: pointSizeMode ? anim.tileSizeSpread : 0,
      base: field(c.alphaLayers),
      fix: field(hover.hoverLayers),
      edge: {
        mode: edge.mode,
        // The solid copy background starts at the measured content top; clamp
        // the band to it so no dot is flat-cut.
        posPx: contentTop != null ? Math.min(posPct, contentTop) : posPct,
        dissolveDepth: edge.dissolveDepth,
        dissolveSeed: edge.dissolveSeed,
        textBlendMotion: edge.textBlendMotion,
        topInset: edge.topInset,
        fullPadding: edge.fullPadding,
      },
      rects: textRects,
      warp: hover.enabled && a.radius > 0 && a.cw > 0 ? {
        px: a.px, py: a.py, r: a.radius,
        rotateDeg: w2.rotate, round: w2.round, scale: w2.scale, spread: Math.min(1.5, w2.spread),
        basePiece: grid.piece, baseRadius: grid.radius,
      } : null,
    }
  }
  // Any committed config change needs one fresh frame even when nothing moves.
  useEffect(() => { tileDirtyRef.current = true })
  useEffect(() => {
    const canvas = tileCanvasRef.current
    if (!pointCanvasMode || !canvas) return
    let renderer: TileFieldRenderer
    try {
      renderer = new TileFieldRenderer(canvas)
    } catch (err) {
      // ponytail: no WebGL2 → plain hero background, no tiles (ADR 0001).
      console.warn('[hero] tile field unavailable:', err)
      setTileFieldFailed(true)
      return
    }
    setTileFieldFailed(false)
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      const a = hoverAnim.current
      const moving = anim.playing || a.radius > 0 || a.hovering
      if (!moving && !tileDirtyRef.current) return
      // Clear the flag only once a frame is drawn: right after load the host
      // can still be 0×0, and a paused hero would otherwise stay blank.
      const f = buildTileFrameRef.current()
      if (!f) return
      tileDirtyRef.current = false
      renderer.render(f, Math.min(2, Math.max(1, window.devicePixelRatio || 1)))
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); renderer.dispose() }
  }, [pointCanvasMode, anim.playing, glEpoch])

  // ── Paper uniforms from refs ── written straight to each mount by the drift
  // loop, never from a render. data-sx/sy/fx/fy carry each layer's spread.
  pushPaperUniformsRef.current = () => {
    const host = shaderContainerRef.current
    if (!host || pointCanvasMode) return
    const d = driftRef.current
    const offX = (d.offsetX + d.loopX) * problemMotionBoost
    const offY = (d.offsetY + d.loopY) * problemMotionBoost
    const rot = c.rotation + d.rotation * problemMotionBoost
    const scale = c.scale + d.scale * problemMotionBoost
    for (const el of host.querySelectorAll<HTMLElement>('[data-pk]')) {
      const mount = (el as HTMLElement & { paperShaderMount?: { setUniforms: (u: Record<string, number>) => void } }).paperShaderMount
      if (!mount) continue
      const sx = Number(el.dataset.sx || 0), sy = Number(el.dataset.sy || 0)
      const fx = Number(el.dataset.fx || 0), fy = Number(el.dataset.fy || 0)
      mount.setUniforms({
        u_offsetX: offX + fx,
        u_offsetY: offY + fy,
        u_rotation: rot,
        u_scale: scale,
        u_originX: 0.5 + d.waveOriginX + sx,
        u_originY: 0.5 + d.waveOriginY + sy,
      })
    }
  }

  // Shared Paper props (base config + drift). Transparent black back + screen
  // blend: each layer adds only its dots over the section background.
  const sharedProps = {
    colorBack: '#000000',
    type: c.type,
    size: paperCell,
    fit: 'cover',
    offsetX: effectiveOffsetX,
    offsetY: effectiveOffsetY,
    rotation: effectiveRotation,
    scale: effectiveScale,
    speed: effectiveSpeed,
    maxPixelCount: paperMaxPixelCount,
    minPixelRatio: 1,
  } as const

  /** One screen-blended Paper layer per colour layer. */
  const paperLayers = (layers: typeof c.alphaLayers, colorFor: (color: string) => string, withRefs: boolean) =>
    layers.map((layer, i) => {
      // A fully transparent layer gets no WebGL context or draw pass.
      if (layer.opacity <= 0) return null
      const spread = c.alphaSpread * i
      return (
        <div
          key={i}
          ref={withRefs ? (el) => { alphaWrapperRefs.current[i] = el } : undefined}
          className="absolute inset-0"
          style={{ opacity: layer.opacity, mixBlendMode: 'screen' }}
        >
          <Dithering
            {...sharedProps}
            data-pk="" data-sx={spread * 0.8} data-sy={spread * 0.6} data-fx={spread * 2} data-fy={spread * 1.5}
            colorFront={colorFor(layer.color)}
            shape={layer.shape}
            originX={0.5 + drift.waveOriginX + spread * 0.8}
            originY={0.5 + drift.waveOriginY + spread * 0.6}
            offsetX={effectiveOffsetX + spread * 2}
            offsetY={effectiveOffsetY + spread * 1.5}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )
    })

  const containerStyle = restMaskStyle
  // The cover only ever shows on the 'mask' path; the reveal escapes the
  // dissolve band, so the hover works over the whole hero, text included.
  const maskBase: React.CSSProperties = { maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }
  // A terminal theme reveals one themed colour instead of the other state's layers.
  const revealColor = (color: string) => (activeTheme ? responseColor : color)
  const textUnderScene = edge.mode === 'full'
  const textReadabilityStyle: React.CSSProperties | undefined = textUnderScene
    ? { textShadow: `0 2px 28px ${c.colorBack}, 0 1px 6px ${c.colorBack}, 0 0 1px ${c.colorBack}` }
    : undefined

  return (
    <section className="min-h-svh flex flex-col relative overflow-hidden" style={{ backgroundColor: c.colorBack }}>
      <div ref={shaderContainerRef} className="absolute inset-0" style={containerStyle}>
        {pointCanvasMode && !tileFieldFailed && (
          <canvas
            key={`tile-gl${glEpoch}`}
            ref={tileCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Resting field — stacked colour layers, screen blended */}
        {!pointCanvasMode && (
          <div key={`base-gl${glEpoch}`} className="absolute inset-0" style={{ backgroundColor: c.colorBack }}>
            {paperLayers(c.alphaLayers, (color) => color, true)}
          </div>
        )}

      </div>

      {/* Copy background: ends the resting field above the copy. Under the
          hover layers, so the reveal shows over the copy area too. */}
      {!textUnderScene && contentTop != null && (
        <div className="absolute inset-x-0 bottom-0 z-[5] pointer-events-none" style={{ top: contentTop, backgroundColor: c.colorBack }} aria-hidden="true" />
      )}

      {/* Hover cover — hides the resting tiles under the cursor ('mask' path) */}
      {hover.enabled && hoverPath === 'mask' && (
        <div ref={coverRef} className="absolute inset-0 z-[6] pointer-events-none" style={{ visibility: 'hidden', backgroundColor: c.colorBack }} aria-hidden="true" />
      )}

      {/* Reveal — the other state's layers, mounted on first hover. Outside the
          resting mask, so it is not cut by the dissolve band. */}
      {hover.enabled && hoverActive && !pointCanvasMode && (
        <div key={`hover-gl${glEpoch}`} className="absolute inset-0 z-[6] pointer-events-none" aria-hidden="true">
          <div
            ref={fixLayerRef}
            className="absolute inset-0"
            style={{ visibility: 'hidden', backgroundColor: c.colorBack, ...(hoverPath === 'mask' ? maskBase : {}) }}
          >
            {paperLayers(hover.hoverLayers, revealColor, false)}
          </div>
        </div>
      )}


      {/* Warp-reveal tooltip — short log fragments below the cursor. The pool
          follows orientation: fix at rest → errors; problem at rest → recovery
          lines. Sibling of the shader container so the masks never clip it. */}
      {hover.enabled && hover.warpErrorText && tip && tip.r > 8 && (() => {
        const snippets = initialState === 'problem' ? warpFixSnippets : warpErrorSnippets
        const accent = activeTheme ? responseColor : hover.hoverLayers[0]?.color
        const cellW = Math.max(64, gridPitch * 4)
        const idx = Math.floor(tileThreshold(Math.round(tip.px / cellW), Math.round(tip.py / cellW), 7) * snippets.length)
        const lineA = snippets[idx % snippets.length]
        const lineB = snippets[(idx + 3) % snippets.length]
        // Keep the tooltip fully inside the section (overflow-hidden would cut
        // it): clamp horizontally and flip above the cursor near the bottom.
        const estW = Math.max(lineA.length, lineB.length) * 7.6 + 28
        const estH = 2 * 12.5 * 1.55 + 20
        const halfW = estW / 2 + 12
        const left = Math.round(Math.min(Math.max(tip.px, halfW), Math.max(halfW, containerSize.w - halfW)))
        const below = tip.py + tip.r + 16
        const top = Math.round(Math.max(8, below + estH > containerSize.h - 8 ? tip.py - tip.r - 16 - estH : below))

        return (
          <div
            /* z-40: above the copy block (z-10) and baseline guides (z-30) —
               in Full mode the reveal happens right next to the headline and
               the tooltip must never disappear behind the text. */
            className="absolute z-40 pointer-events-none"
            style={{
              left,
              top,
              transform: 'translateX(-50%)',
              opacity: Math.min(1, tip.r / Math.max(40, hover.radius * 0.7)),
              // Follow the active headline font so the tooltip always matches
              // the hero's voice, whatever face is picked in the panel.
              fontFamily: copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)',
              fontSize: 12.5,
              lineHeight: 1.55,
              padding: '9px 14px',
              borderRadius: 10,
              // Site background + a neutral stroke just lighter than the pill
              // itself — the tooltip reads as part of the page, not a colored
              // overlay.
              backgroundColor: c.colorBack,
              border: `1px solid color-mix(in oklch, white 14%, ${c.colorBack})`,
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.4)',
              textAlign: 'left',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ color: accent }}>{lineA}</div>
            <div style={{ color: 'rgba(255, 255, 255, 0.62)' }}>{lineB}</div>
          </div>
        )
      })()}

      {/* Baseline guides — magenta lines across the section at every text
          baseline, so headline/sub/response/CTA alignment reads at a glance. */}
      {layout.showBaselines && baselineGuides.length > 0 && (
        <div className="absolute inset-0 z-30 pointer-events-none" aria-hidden="true">
          {baselineGuides.map((y) => (
            <div
              key={y}
              className="absolute left-0 right-0"
              style={{ top: y, height: 1, background: 'rgba(255, 45, 150, 0.6)' }}
            />
          ))}
        </div>
      )}

      {/* Layout guides — the copy container's column grid and content edges.
          z-[45] sits above the fixed header (z-40) so the nav row is checked
          against the same left/right edges as the copy. */}
      {layout.showGuides && (
        <div className="absolute inset-0 z-[45] pointer-events-none" aria-hidden="true">
          <div className="relative h-full max-w-[1440px] mx-auto w-full px-5 sm:px-8 xl:px-16">
            <div
              className={`relative h-full grid grid-cols-4 ${copy.layout === 'problem' && stackTablet ? 'lg:grid-cols-12' : 'md:grid-cols-12'}`}
              style={{ columnGap: layout.gutter, boxShadow: 'inset 1px 0 0 rgba(0, 220, 255, 0.85), inset -1px 0 0 rgba(0, 220, 255, 0.85)' }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  className={i < 4 ? '' : (copy.layout === 'problem' && stackTablet ? 'hidden lg:block' : 'hidden md:block')}
                  style={{ background: 'rgba(0, 220, 255, 0.07)', boxShadow: 'inset 1px 0 0 rgba(0, 220, 255, 0.22), inset -1px 0 0 rgba(0, 220, 255, 0.22)' }}
                />
              ))}
            </div>
          </div>
          {edgeGuides.map((g) => (
            <div key={g.label} className="absolute left-0 right-0" style={{ top: g.y, height: 1, background: 'rgba(255, 184, 0, 0.8)' }}>
              <span className="absolute right-1 -top-[14px] text-[10px] leading-none font-mono" style={{ color: 'rgba(255, 184, 0, 0.95)' }}>{g.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom content section */}
      <div ref={contentRef} className="relative z-10 mt-auto">
        {/* The copy's solid background is drawn by copyBg (section level) once
            measured, so the hover reveal can sit between it and the text. */}
        <div style={{ backgroundColor: textUnderScene || contentTop != null ? 'transparent' : c.colorBack }}>
          {/* Mobile spacing follows proximity: the copy block's OUTER padding
              (40px) is larger than any gap INSIDE it (12–16px), so the text
              reads as one unit separated from the shader rather than glued to
              it. The old 12px top was smaller than its own internal gaps. */}
          <div ref={copyBoxRef} className="max-w-[1440px] mx-auto w-full px-5 sm:px-8 xl:px-16 pb-10 md:pb-20 pt-10 md:pt-8">
            {copy.layout === 'problem' ? (
              <div
                className={`grid grid-cols-4 items-end [--hl-cols:7] [--rsp-cols:5] xl:[--hl-cols:var(--hl-cols-panel)] xl:[--rsp-cols:var(--rsp-cols-panel)] ${stackTablet ? 'lg:grid-cols-12' : 'md:grid-cols-12'}`}
                style={{ columnGap: layout.gutter, '--hl-cols-panel': layout.headlineCols, '--rsp-cols-panel': layout.responseCols } as React.CSSProperties}
              >
                {/* Panel col spans apply only once the two-column grid is on —
                    below that both blocks stack full-width (span 8/4 would
                    overflow the 4-col grid). Where that starts is per-variant:
                    a monospace headline in a 7/12 tablet column fragments into
                    ragged lines and strands the response beside an empty upper
                    quadrant, so those variants delay the split to lg. */}
                <div className={`col-span-4 min-w-0 ${stackTablet ? 'lg:[grid-column:span_var(--hl-cols)_/_span_var(--hl-cols)]' : 'md:[grid-column:span_var(--hl-cols)_/_span_var(--hl-cols)]'}`}>
                  <h1
                    ref={lockHeadlineRef}
                    className="text-balance break-words [overflow-wrap:anywhere]"
                    style={{
                      color: headlineColor,
                      fontFamily: copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)',
                      fontWeight: copy.headlineWeight ?? 900,
                      fontSize: `var(--hl-fit-size, min(${copy.headlineSize || 'clamp(2.5rem, 3.5vw + 1rem, 4rem)'}, 8.5vw))`,
                      letterSpacing: copy.headlineTracking ?? '-0.03em',
                      lineHeight: copy.headlineLeading || '0.95',
                      fontStretch: copy.headlineFont ? undefined : 'var(--font-display-stretch, normal)',
                      ...textReadabilityStyle,
                    }}
                  >
                    {copy.headline}
                  </h1>
                  {copy.sub && (
                    <p ref={lockSubRef} className="mt-3 md:mt-6 text-[17px] md:text-[20px] max-w-[65ch] text-pretty leading-[1.55] break-words [overflow-wrap:anywhere]" style={{ color: sublineColor, ...(copy.subFont ? { fontFamily: copy.subFont } : {}), ...(baselineNudge.subGap > 0 ? { marginTop: 24 + baselineNudge.subGap } : {}), ...textReadabilityStyle }}>
                      {copy.sub}
                    </p>
                  )}
                </div>
                <div className={`col-span-4 min-w-0 flex flex-col items-start justify-end ${copy.responsePin === 'cta' ? 'gap-4 md:gap-6' : (copy.response?.replace(/\s+/g, ' ').length ?? 0) <= 30 ? 'gap-4 md:gap-14' : 'gap-4 md:gap-8'} pb-[2px] mt-4 [container-type:inline-size] [--rsp-cap:6vw] xl:[--rsp-cap:999px] ${stackTablet ? 'lg:mt-0 lg:[grid-column:span_var(--rsp-cols)_/_span_var(--rsp-cols)] lg:[--rsp-cap:9.7cqw]' : 'md:mt-0 md:[grid-column:span_var(--rsp-cols)_/_span_var(--rsp-cols)] md:[--rsp-cap:9.7cqw]'}`}>
                  {copy.response && (
                    <div
                      ref={lockResponseWrapRef}
                      className="flex flex-col items-start gap-4"
                      style={copy.responsePin !== 'cta' && baselineNudge.response !== 0 ? { transform: `translateY(${baselineNudge.response}px)` } : undefined}
                    >
                      {/* Separator */}
                      {copy.responseSeparator && copy.responseSeparator !== 'none' && (
                        <div className="w-full" style={{
                          ...(copy.responseSeparator === 'line' ? {
                            height: '1px',
                            backgroundColor: `color-mix(in oklch, ${responseColor} 25%, transparent)`,
                          } : copy.responseSeparator === 'dots' ? {
                            height: '2px',
                            backgroundImage: `radial-gradient(circle, ${`color-mix(in oklch, ${responseColor} 35%, transparent)`} 1px, transparent 1px)`,
                            backgroundSize: '8px 2px',
                          } : copy.responseSeparator === 'fade' ? {
                            height: '1px',
                            background: `linear-gradient(to right, ${`color-mix(in oklch, ${responseColor} 30%, transparent)`}, transparent)`,
                          } : {}),
                        }} />
                      )}
                      {/* Response text with optional bubble */}
                      <p
                        className="text-balance break-words [overflow-wrap:anywhere]"
                        style={{
                          color: responseColor,
                          fontFamily: copy.responseFontMode === 'headline'
                            ? (copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)')
                            : (copy.responseFont || 'var(--font-display, Instrument Serif, Georgia, serif)'),
                          fontStyle: copy.responseFontMode === 'headline'
                            ? (copy.responseFontStyle || 'normal')
                            : (copy.responseFontStyle || (copy.responseFont ? undefined : 'var(--font-display-hl-style, italic)' as string)),
                          fontWeight: copy.responseWeight ?? 400,
                          // Cap against the viewport so fixed panel sizes (36px…)
                          // can't dwarf a 390px screen; no-op from ~tablet up.
                          fontSize: `min(${copy.responseSize || '48px'}, var(--rsp-cap, 999px))`,
                          lineHeight: copy.responseLeading || '1.1',
                          letterSpacing: copy.responseTracking ?? '0em',
                          fontStretch: copy.responseFontMode === 'headline' && !copy.headlineFont
                            ? 'var(--font-display-stretch, normal)' : undefined,
                          ...(copy.responseBubble ? {
                            backgroundColor: copy.responseBubbleColor ?? 'rgba(255,255,255,0.07)',
                            borderRadius: copy.responseBubbleRadius ?? '16px',
                            padding: '12px 24px',
                            border: `1px solid color-mix(in oklch, ${responseColor} 12%, transparent)`,
                          } : {}),
                          ...textReadabilityStyle,
                        }}
                      >
                        {copy.response}
                      </p>
                    </div>
                  )}
                  <a
                    ref={lockCtaRef}
                    href="#"
                    className="inline-flex items-center justify-center whitespace-nowrap px-7 py-3 text-[16px] xl:px-10 xl:py-4 xl:text-[18px] font-semibold tracking-wide transition-colors"
                    style={{
                      backgroundColor: CTA_BG,
                      color: ctaTextColor,
                      // The hero CTA is the primary action: it carries the
                      // template's display face like the header CTAs do, unless
                      // that face goes weak at button size (see copy.ctaFont).
                      fontFamily: copy.ctaFont || copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)',
                      ...ctaStyle,
                      textTransform: ctaTextTransform,
                      ...(copy.responsePin !== 'cta' && baselineNudge.cta !== 0 ? { transform: `translateY(${baselineNudge.cta}px)` } : {}),
                    }}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') e.currentTarget.style.backgroundColor = CTA_BG_HOVER }}
                    onPointerLeave={(e) => { e.currentTarget.style.backgroundColor = CTA_BG }}
                  >
                    {copy.cta}
                  </a>
                </div>
              </div>
            ) : (
              <div
                className="grid grid-cols-4 md:grid-cols-12 items-end [--hl-cols:7] [--rsp-cols:5] xl:[--hl-cols:var(--hl-cols-panel)] xl:[--rsp-cols:var(--rsp-cols-panel)]"
                style={{ columnGap: layout.gutter, '--hl-cols-panel': layout.headlineCols, '--rsp-cols-panel': layout.responseCols } as React.CSSProperties}
              >
                <div className="col-span-4 min-w-0 md:[grid-column:span_var(--hl-cols)_/_span_var(--hl-cols)]">
                  <h1
                    ref={lockHeadlineRef}
                    className="text-balance break-words [overflow-wrap:anywhere]"
                    style={{
                      color: headlineColor,
                      fontFamily: copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)',
                      fontWeight: copy.headlineWeight ?? 900,
                      fontSize: `var(--hl-fit-size, min(${copy.headlineSize || 'clamp(2.5rem, 3.5vw + 1rem, 4rem)'}, 8.5vw))`,
                      letterSpacing: copy.headlineTracking ?? '-0.03em',
                      lineHeight: copy.headlineLeading || '0.95',
                      fontStretch: copy.headlineFont ? undefined : 'var(--font-display-stretch, normal)',
                      ...textReadabilityStyle,
                    }}
                  >
                    {copy.headline}
                  </h1>
                </div>
                <div className="col-span-4 min-w-0 flex flex-col items-start justify-end gap-5 md:gap-8 pb-[2px] mt-6 md:mt-0 md:[grid-column:span_var(--rsp-cols)_/_span_var(--rsp-cols)] [container-type:inline-size] [--rsp-cap:6vw] md:[--rsp-cap:9.7cqw] xl:[--rsp-cap:999px]">
                  {copy.sub && (
                    <p className="text-[17px] md:text-[20px] max-w-[65ch] text-pretty leading-[1.55] break-words [overflow-wrap:anywhere]" style={{ color: sublineColor, ...(copy.subFont ? { fontFamily: copy.subFont } : {}) }}>
                      {copy.sub}
                    </p>
                  )}
                  <a
                    href="#"
                    className="inline-flex items-center justify-center whitespace-nowrap px-7 py-3 text-[16px] xl:px-10 xl:py-4 xl:text-[18px] font-semibold tracking-wide transition-colors"
                    style={{ backgroundColor: CTA_BG, color: ctaTextColor, ...ctaStyle, textTransform: ctaTextTransform }}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') e.currentTarget.style.backgroundColor = CTA_BG_HOVER }}
                    onPointerLeave={(e) => { e.currentTarget.style.backgroundColor = CTA_BG }}
                  >
                    {copy.cta}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
