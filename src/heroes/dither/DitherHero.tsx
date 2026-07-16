import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { Dithering } from '@paper-design/shaders-react'
import { useWebHaptics } from 'web-haptics/react'
import { useDitherStore, copyVariants, warpErrorSnippets, warpFixSnippets, type EdgeMode, type HoverShape, type DitherEdgeConfig, type DitherPixelGridConfig } from './ditherStore'
import { getThemeById } from '../../themes/terminalThemes'
import { getAccessibleCtaPair } from '../../utils/colorContrast'

/** Build CSS mask based on edge mode + position. 'dissolve' is handled at the
 *  container level (combined with the tiles), so no per-layer mask here. */
function buildMask(mode: EdgeMode, pos: number): string | undefined {
  if (mode === 'overlap' || mode === 'ripple' || mode === 'dissolve') return undefined
  if (mode === 'sharp') return `linear-gradient(to bottom, black 0%, black ${pos}%, transparent ${pos}%)`
  const fadeStart = Math.max(0, pos - 15)
  return `linear-gradient(to bottom, black 0%, black ${fadeStart}%, transparent ${pos + 5}%)`
}


/** Piece pitch = tile size / divisions, in whole pixels. The master tile is
 *  divided into `divisions` equal pieces, so the piece grid always tiles the
 *  master exactly (aligned). This pitch is the mask repeat AND the dither-dot
 *  size the shader locks to. */
function pixelGridPitch(cfg: DitherPixelGridConfig): number {
  const cell = Math.max(1, Math.round(cfg.cell))
  const divisions = Math.max(1, Math.round(cfg.divisions))
  return Math.max(2, Math.round(cell / divisions))
}

function positiveModulo(value: number, base: number): number {
  return ((value % base) + base) % base
}

/** Metrics derived from Pixel Grid — single source for static + animated masks. */
interface PixelGridMetrics {
  pitch: number
  gap: number
  /** Resting piece = pitch − gap (matches buildTileMaskUrl). */
  maxPiece: number
  inset: number
  radius: number
  alignX: number
  alignY: number
}

function clampTileRadius(radius: number, piece: number): number {
  return Math.max(0, Math.min(Math.round(radius), piece / 2))
}

function pixelGridMetrics(cfg: DitherPixelGridConfig): PixelGridMetrics {
  const pitch = pixelGridPitch(cfg)
  const gap = Math.max(0, Math.min(Math.round(cfg.gap), pitch - 1))
  const maxPiece = pitch - gap
  return {
    pitch,
    gap,
    maxPiece,
    inset: gap / 2,
    radius: clampTileRadius(cfg.radius, maxPiece),
    alignX: cfg.alignX,
    alignY: cfg.alignY,
  }
}

/** Per-cell piece size from spread + noise — pitch locked, inset derived so
 *  piece + 2×inset = pitch (same geometry as the repeating tile SVG). */
function scaledGridPiece(
  grid: PixelGridMetrics, spread: number, noise: number,
): { piece: number; inset: number; radius: number } {
  const minScale = spread <= 0
    ? 1
    : Math.max(grid.gap / Math.max(1, grid.maxPiece), 1 - Math.min(1, spread))
  const scale = minScale + (1 - minScale) * noise
  const piece = grid.maxPiece * scale
  const inset = (grid.pitch - piece) / 2
  const radius = clampTileRadius(grid.radius, piece)
  return { piece, inset, radius }
}

/** Build a repeating rounded-piece CSS mask. Each piece fills its pitch minus
 *  the gap, centered so the gap splits equally on all four sides; the corner
 *  radius is clamped so rounding is always respected. At gap 0 the piece fills
 *  its pitch with no seam. Pieces tile the master exactly (pitch = cell /
 *  divisions). Returns undefined when disabled. */
function buildTileMaskUrl(cfg: DitherPixelGridConfig): string {
  const g = pixelGridMetrics(cfg)
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${g.pitch}' height='${g.pitch}'>` +
    `<rect x='${g.inset}' y='${g.inset}' width='${g.maxPiece}' height='${g.maxPiece}' rx='${g.radius}' ry='${g.radius}' fill='black'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function buildPixelGridMask(cfg: DitherPixelGridConfig): React.CSSProperties | undefined {
  if (!cfg.enabled) return undefined
  const pitch = pixelGridPitch(cfg)
  const url = buildTileMaskUrl(cfg)
  const size = `${pitch}px ${pitch}px`
  const pos = `${cfg.alignX}px ${cfg.alignY}px`
  return {
    maskImage: url,
    WebkitMaskImage: url,
    maskRepeat: 'repeat',
    WebkitMaskRepeat: 'repeat',
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: pos,
    WebkitMaskPosition: pos,
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
  return t * t * t * (t * (t * 6 - 15) + 1)
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

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

const TILE_SIZE_EFFECT_STRENGTH = 0.65
const TILE_SIZE_MIN_VALUE = 0.18

/** Smooth proportional size map for tile-size mode.
 *  Every grid cell stays in place; only the rounded piece size changes. */
function tileSizeMapValue(
  col: number,
  row: number,
  t: number,
  scale: number,
): number {
  const phase = t * Math.PI * 2
  const width = Math.max(0.4, Math.min(3, scale))
  const spatial = 0.095 / width
  const organic = fbmNoise(col * spatial, row * spatial, t * 0.8, 2401)
  const wave = 0.5 + 0.5 * Math.sin(col * 0.33 + row * 0.21 + phase * 0.55)
  const value = easeInOut(Math.max(0, Math.min(1, organic * 0.72 + wave * 0.28)))
  return TILE_SIZE_MIN_VALUE + (1 - TILE_SIZE_MIN_VALUE) * value
}

function tilePointAlpha(col: number, row: number, t: number, scale: number): number {
  const width = Math.max(0.4, Math.min(3, scale))
  const spatial = 0.08 / width
  const n = fbmNoise(col * spatial + 19, row * spatial - 7, t * 0.55, 3119)
  const wave = 0.5 + 0.5 * Math.sin(col * 0.16 - row * 0.27 + t * Math.PI * 1.2)
  return Math.max(0, Math.min(1, n * 0.65 + wave * 0.35))
}

function pointEdgeVisibility(
  col: number,
  row: number,
  cy: number,
  h: number,
  pitch: number,
  t: number,
  edgeCfg: DitherEdgeConfig,
  solidTopPx?: number,
): number {
  // The solid copy background starts at the measured content top — when it
  // sits above the Position line, clamp the band to it so no dot is ever
  // flat-cut by the copy block. With Scene-behind-text the bg is transparent
  // and dots may pass behind, so no clamp.
  const posPct = (edgeCfg.position / 100) * h
  const posPx = solidTopPx != null && !edgeCfg.textBlend
    ? Math.min(posPct, solidTopPx)
    : posPct
  const depthPx = Math.max(pitch, Math.round(edgeCfg.dissolveDepth) * pitch)
  const extendPx = edgeCfg.textBlend ? Math.max(0, edgeCfg.shaderExtend) : 0
  const edgeMotion = edgeCfg.textBlendMotion > 0
    ? (fbmNoise(col * 0.33, row * 0.33, t * 0.8, edgeCfg.dissolveSeed + 89) - 0.5) * edgeCfg.textBlendMotion * 0.55
    : 0
  const threshold = Math.max(0, Math.min(1, tileThreshold(col, row, edgeCfg.dissolveSeed) + edgeMotion))
  // Judge the band by the cell BOTTOM, not its center — a cell straddling the
  // Position line would survive the center test and get flat-cut by the solid
  // copy background below. Whole shapes only.
  const cellBottom = cy + pitch / 2

  if (cellBottom <= posPx - depthPx) return 1

  if (cellBottom <= posPx) {
    if (edgeCfg.mode === 'sharp') return 1
    if (edgeCfg.mode === 'fade') return Math.max(0, Math.min(1, (posPx - cellBottom) / depthPx))
    const density = Math.max(0, Math.min(1, (posPx - cellBottom) / depthPx))
    return density > threshold ? 1 : 0
  }

  if (extendPx <= 0 || (edgeCfg.mode !== 'dissolve' && edgeCfg.mode !== 'overlap')) return 0

  const overflow = (cellBottom - posPx) / extendPx
  if (overflow >= 1) return 0
  const density = Math.pow(1 - overflow, 1.55) * 0.62
  return density > threshold ? density : 0
}

interface TextRect { x: number; y: number; w: number; h: number }

/** Viewport-space baseline of an element's LAST rendered text line —
 *  line-box top + half-leading + ~0.8em ascent. Null when nothing renders. */
function lastLineBaseline(el: Element): number | null {
  const fontSize = parseFloat(getComputedStyle(el).fontSize)
  const range = document.createRange()
  range.selectNodeContents(el)
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 4 && r.height > fontSize * 0.5)
  if (!rects.length) return null
  const r = rects[rects.length - 1]
  return r.top + (r.height - fontSize) / 2 + fontSize * 0.8
}

/** 'full' edge mode — whole-tile exclusion around measured text blocks.
 *  A cell whose piece would touch a padded text rect is dropped entirely
 *  (never cut); cells inside the rim dissolve organically, dimming as they
 *  approach the text. Returns the visibility/alpha factor for the cell. */
function fullEdgeVisibility(
  cellX: number, cellY: number, pitch: number,
  col: number, row: number, t: number,
  exclusions: TextRect[], padding: number, rimPx: number,
  edgeCfg: DitherEdgeConfig,
): number {
  let minD = Infinity
  const cx = cellX + pitch / 2
  const cy = cellY + pitch / 2
  for (const r of exclusions) {
    const rx0 = r.x - padding
    const ry0 = r.y - padding
    const rx1 = r.x + r.w + padding
    const ry1 = r.y + r.h + padding
    if (cellX + pitch > rx0 && cellX < rx1 && cellY + pitch > ry0 && cellY < ry1) return 0
    const dx = Math.max(rx0 - cx, 0, cx - rx1)
    const dy = Math.max(ry0 - cy, 0, cy - ry1)
    const d = Math.hypot(dx, dy)
    if (d < minD) minD = d
  }
  if (minD >= rimPx) return 1
  const g = minD / rimPx
  const edgeMotion = edgeCfg.textBlendMotion > 0
    ? (fbmNoise(col * 0.33, row * 0.33, t * 0.8, edgeCfg.dissolveSeed + 89) - 0.5) * edgeCfg.textBlendMotion * 0.55
    : 0
  const threshold = Math.max(0, Math.min(1, tileThreshold(col, row, edgeCfg.dissolveSeed) + edgeMotion))
  return g > threshold ? Math.max(0.45, g) : 0
}

function drawPointSizeCanvas(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  cfg: DitherPixelGridConfig,
  t: number,
  spread: number,
  mapScale: number,
  layers: Array<{ color: string; opacity: number }>,
  fallbackColor: string,
  edgeCfg: DitherEdgeConfig,
  exclusions?: TextRect[],
  solidTopPx?: number,
): boolean {
  if (!w || !h || spread <= 0) return false
  const grid = pixelGridMetrics(cfg)
  const effectiveSpread = Math.max(0, Math.min(1, spread)) * TILE_SIZE_EFFECT_STRENGTH
  const { pitch, alignX, alignY } = grid
  const dpr = Math.min(2, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  const canvasW = Math.max(1, Math.round(w * dpr))
  const canvasH = Math.max(1, Math.round(h * dpr))
  if (canvas.width !== canvasW || canvas.height !== canvasH) {
    canvas.width = canvasW
    canvas.height = canvasH
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const sourceLayers = layers.length ? layers : [{ color: fallbackColor, opacity: 0.9 }]
  // Top start places the WHOLE field, not just a crop: shift the grid's
  // vertical phase so the first row begins exactly at the inset line —
  // the slider moves the full block of shapes 1:1.
  const alignYEff = edgeCfg.topInset > 0
    ? alignY + positiveModulo(edgeCfg.topInset - alignY, pitch)
    : alignY
  const colLo = Math.floor((0 - alignX) / pitch) - 1
  const colHi = Math.ceil((w - alignX) / pitch) + 1
  const rowLo = Math.floor((0 - alignYEff) / pitch) - 1
  const rowHi = Math.ceil((h - alignYEff) / pitch) + 1
  const fullMode = edgeCfg.mode === 'full'
  const rimPx = Math.max(pitch, Math.round(edgeCfg.dissolveDepth) * pitch)

  for (let row = rowLo; row <= rowHi; row++) {
    const cellY = alignYEff + row * pitch
    if (edgeCfg.topInset > 0 && cellY < edgeCfg.topInset - 0.5) continue
    // Same whole-shape rule at the bottom: a row whose cell would be clipped
    // by the canvas edge is dropped, so the field ends on full shapes.
    if (cellY + pitch > h + 0.5) continue
    const cy = cellY + pitch / 2

    for (let col = colLo; col <= colHi; col++) {
      const cellX = alignX + col * pitch
      const edgeAlpha = fullMode
        ? (exclusions && exclusions.length
            ? fullEdgeVisibility(cellX, cellY, pitch, col, row, t, exclusions, edgeCfg.fullPadding, rimPx, edgeCfg)
            : 1)
        : pointEdgeVisibility(col, row, cy, h, pitch, t, edgeCfg, solidTopPx)
      if (edgeAlpha <= 0) continue
      const sizeValue = tileSizeMapValue(col, row, t, mapScale)
      const alphaValue = tilePointAlpha(col, row, t, mapScale)
      const { piece, inset, radius } = scaledGridPiece(grid, effectiveSpread, sizeValue)
      if (piece < 0.5) continue

      const layer = sourceLayers[Math.floor(tileThreshold(col, row, 701) * sourceLayers.length)] ?? sourceLayers[0]
      ctx.globalAlpha = Math.max(0.08, Math.min(0.95, (0.28 + alphaValue * 0.72) * layer.opacity * edgeAlpha))
      ctx.fillStyle = layer.color
      if (radius < 0.5) {
        ctx.fillRect(cellX + inset, cellY + inset, piece, piece)
      } else {
        roundRectPath(ctx, cellX + inset, cellY + inset, piece, piece, radius)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1
  return true
}

/** Build a dither edge mask (Photoshop-dissolve style): a white→black gradient
 *  where each tile is kept while the gradient value exceeds its fixed random
 *  threshold. The gradient runs to the edge `positionPct`; with a `wave` it
 *  follows the ripple, otherwise it's a flat horizontal band. Aligned to the
 *  tile grid, in px. Returns undefined until measured. */
function buildDissolveMaskUrl(
  positionPct: number, depthRows: number, pitch: number,
  w: number, h: number, alignY: number, seed: number,
  wave?: { ampVh: number; freq: number; phase: number },
  motion?: { t: number; strength: number; scale: number },
  extendPx = 0,
): string | undefined {
  if (!w || !h || pitch < 2) return undefined
  const snap = (y: number) => Math.round((y - alignY) / pitch) * pitch + alignY
  const posPx = (positionPct / 100) * h
  const ampPx = wave ? (wave.ampVh / 100) * h : 0
  const bandH = Math.max(pitch, Math.round(depthRows) * pitch)
  const minEdge = posPx - ampPx
  const maxEdge = Math.min(h, posPx + ampPx)
  const solidBottom = Math.max(0, snap(minEdge - bandH))
  const extendEnd = extendPx > 0 ? Math.min(h, snap(posPx + extendPx)) : posPx
  const rects: string[] = []
  if (solidBottom > 0) rects.push(`<rect x='0' y='0' width='${w}' height='${solidBottom}'/>`)

  const addTile = (x: number, y: number, g: number) => {
    const cx = Math.round(x / pitch)
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
    for (let x = 0; x < w; x += pitch) {
      const xMid = x + pitch / 2
      const edgeY = wave
        ? posPx + ampPx * Math.sin((xMid / w) * wave.freq * Math.PI * 2 + wave.phase)
        : posPx
      addTile(x, y, (edgeY - y) / bandH)
    }
  }

  // Shader extend — solid tiles below Position, soft fade at the bottom rim.
  if (extendPx > 0 && extendEnd > posPx) {
    const extBandH = Math.max(pitch, Math.round(depthRows) * pitch)
    const extSolidEnd = Math.max(posPx + pitch, extendEnd - extBandH)
    for (let y = snap(posPx); y < extSolidEnd; y += pitch) {
      for (let x = 0; x < w; x += pitch) addTile(x, y, 1)
    }
    for (let y = extSolidEnd; y < extendEnd; y += pitch) {
      for (let x = 0; x < w; x += pitch) {
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
function buildDissolveContainerStyle(cfg: DitherPixelGridConfig, dissolveUrl: string): React.CSSProperties {
  const tileUrl = buildTileMaskUrl(cfg)
  const pitch = pixelGridPitch(cfg)
  const imgs = `${tileUrl}, ${dissolveUrl}`
  return {
    maskImage: imgs,
    WebkitMaskImage: imgs,
    maskRepeat: 'repeat, no-repeat',
    WebkitMaskRepeat: 'repeat, no-repeat',
    maskSize: `${pitch}px ${pitch}px, 100% 100%`,
    WebkitMaskSize: `${pitch}px ${pitch}px, 100% 100%`,
    maskPosition: `${cfg.alignX}px ${cfg.alignY}px, 0px 0px`,
    WebkitMaskPosition: `${cfg.alignX}px ${cfg.alignY}px, 0px 0px`,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  }
}

/** Full-viewport mask — every grid cell gets a piece sized from Pixel Grid
 *  (pitch, gap, radius). Section edge uses row-based visibility (full width).
 *  Draws into the given canvas; the caller exports it (toBlob) off the render
 *  path. Returns false when there is nothing to draw. */
function drawTileSizeMask(
  canvas: HTMLCanvasElement, w: number, h: number, cfg: DitherPixelGridConfig,
  t: number, spread: number, noiseScale: number,
  section?: { positionPct: number; depthRows: number; extendPx: number; seed: number },
  topInset = 0,
): boolean {
  if (!w || !h || spread <= 0) return false
  const grid = pixelGridMetrics(cfg)
  const effectiveSpread = Math.max(0, Math.min(1, spread)) * TILE_SIZE_EFFECT_STRENGTH
  const { pitch, alignX, alignY } = grid
  const dpr = Math.min(2, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  const canvasW = Math.max(1, Math.round(w * dpr))
  const canvasH = Math.max(1, Math.round(h * dpr))
  if (canvas.width !== canvasW || canvas.height !== canvasH) {
    canvas.width = canvasW
    canvas.height = canvasH
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#fff'

  const posPx = section ? (section.positionPct / 100) * h : h
  const bandH = section ? Math.max(pitch, Math.round(section.depthRows) * pitch) : 0
  const extendEnd = section && section.extendPx > 0
    ? Math.min(h, posPx + section.extendPx)
    : h
  const snapY = (y: number) => Math.round((y - alignY) / pitch) * pitch + alignY
  const bandTop = section ? Math.max(0, snapY(posPx - bandH)) : 0

  const colLo = Math.floor((0 - alignX) / pitch) - 1
  const colHi = Math.ceil((w - alignX) / pitch) + 1
  const rowLo = Math.floor((0 - alignY) / pitch) - 1
  const rowHi = Math.ceil((h - alignY) / pitch) + 1
  for (let row = rowLo; row <= rowHi; row++) {
    const rowTop = alignY + row * pitch
    if (topInset > 0 && rowTop < topInset) continue
    if (rowTop + pitch > h + 0.5) continue
    const cy = rowTop + pitch / 2
    if (section) {
      if (cy < bandTop - pitch / 2) continue
      if (cy > extendEnd + pitch / 2) continue
      if (cy < posPx) {
        const g = (posPx - cy) / bandH
        if (g <= 0) continue
        if (g < 1) {
          const rowT = tileThreshold(0, row, section.seed)
          if (g <= rowT) continue
        }
      }
    }
    const cellY = alignY + row * pitch
    for (let col = colLo; col <= colHi; col++) {
      const cellX = alignX + col * pitch
      const n = tileSizeMapValue(col, row, t, noiseScale)
      const { piece, inset, radius } = scaledGridPiece(grid, effectiveSpread, n)
      if (piece < 0.5) continue
      if (radius < 0.5) {
        ctx.fillRect(cellX + inset, cellY + inset, piece, piece)
      } else {
        roundRectPath(ctx, cellX + inset, cellY + inset, piece, piece, radius)
        ctx.fill()
      }
    }
  }
  return true
}

function buildSizeMaskContainerStyle(sizeUrl: string, dissolveUrl?: string): React.CSSProperties {
  // sizeUrl is a bare blob URL — must be wrapped in url() to be valid CSS,
  // else the browser rejects the assignment and keeps the previous mask.
  const cssUrl = `url(${sizeUrl})`
  if (dissolveUrl) {
    const imgs = `${cssUrl}, ${dissolveUrl}`
    return {
      maskImage: imgs,
      WebkitMaskImage: imgs,
      maskRepeat: 'no-repeat, no-repeat',
      WebkitMaskRepeat: 'no-repeat, no-repeat',
      maskSize: '100% 100%, 100% 100%',
      WebkitMaskSize: '100% 100%, 100% 100%',
      maskPosition: '0 0, 0 0',
      WebkitMaskPosition: '0 0, 0 0',
      maskComposite: 'intersect',
      WebkitMaskComposite: 'source-in',
    }
  }
  return {
    maskImage: cssUrl,
    WebkitMaskImage: cssUrl,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskPosition: '0 0',
    WebkitMaskPosition: '0 0',
  }
}

/** Generate SVG clip-path polygon for ripple edge */
function buildRippleSvg(pos: number, amp: number, freq: number, phase: number): string {
  const steps = 120
  const points: string[] = ['0,0', '100,0']
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * 100
    const wave = Math.sin((i / steps) * freq * Math.PI * 2 + phase) * amp
    const y = pos + wave
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `polygon(${points.map((p) => p.split(',').map((v) => v + '%').join(' ')).join(', ')})`
}

/** Pixelated ripple: a blocky tile-wave. The wave is sampled once per tile
 *  column and its y snapped to the tile grid, so the edge is a staircase of
 *  whole tiles — the ripple is "built from dots" like the rest of the scene.
 *  Works in px (matches the tile mask). Returns undefined until measured. */
function buildPixelRippleClip(
  pos: number, amp: number, freq: number, phase: number,
  pitch: number, w: number, h: number, alignY: number,
): string | undefined {
  if (!w || !h || pitch < 2) return undefined
  const posPx = (pos / 100) * h
  const ampPx = (amp / 100) * h
  const cols = Math.ceil(w / pitch)
  const snap = (y: number) => {
    const snapped = Math.round((y - alignY) / pitch) * pitch + alignY
    return Math.max(0, Math.min(h, snapped))
  }
  const pts: string[] = ['0px 0px', `${w}px 0px`]
  // Bottom staircase, right → left, flat tile-width tops at grid-snapped y.
  for (let i = cols - 1; i >= 0; i--) {
    const xR = Math.min((i + 1) * pitch, w)
    const xL = i * pitch
    const xMid = (xL + xR) / 2
    const y = snap(posPx + ampPx * Math.sin((xMid / w) * freq * Math.PI * 2 + phase))
    pts.push(`${xR}px ${y}px`, `${xL}px ${y}px`)
  }
  return `polygon(${pts.join(', ')})`
}

/** Per-layer config: different shapes create distinct dot patterns; screen blend makes black areas transparent */
const COLOR_LAYERS = [
  { opacity: 0.8, shape: 'warp' as const },
  { opacity: 0.75, shape: 'dots' as const },
  { opacity: 0.7, shape: 'wave' as const },
]

const DEFAULT_CTA_BG = '#1A8A70'
const DEFAULT_CTA_BG_HOVER = '#22A080'

/** Animation drift offsets — accumulated over time */
interface AnimDrift {
  offsetX: number
  offsetY: number
  rotation: number
  scale: number
  frame: number
  colorPhase: number
  /** Wave sweep — origin offset */
  waveOriginX: number
  waveOriginY: number
  /** Gap breathing — px offset added to the pixel-grid gap */
  gap: number
}

const zeroDrift: AnimDrift = { offsetX: 0, offsetY: 0, rotation: 0, scale: 0, frame: 0, colorPhase: 0, waveOriginX: 0, waveOriginY: 0, gap: 0 }

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

/** Whole-tile hover test: tile center is fully in or fully out — no partial
 *  warps at the boundary. Radius defines the zone; every included tile gets
 *  the same full transform. Pixel ◯ snaps radius to whole-tile rings. */
function tileInHoverArea(
  tcx: number, tcy: number, px: number, py: number,
  rx: number, ry: number, hoverShape: HoverShape, pitch: number,
  squareBounds?: { x0: number; x1: number; y0: number; y1: number },
): boolean {
  if (hoverShape === 'square' && squareBounds) {
    return tcx >= squareBounds.x0 && tcx <= squareBounds.x1
      && tcy >= squareBounds.y0 && tcy <= squareBounds.y1
  }
  if (hoverShape === 'square') {
    const dx = Math.abs(tcx - px)
    const dy = Math.abs(tcy - py)
    return (rx <= 0 || dx <= rx) && (ry <= 0 || dy <= ry)
  }
  const r = hoverShape === 'pixel-circle' && pitch > 1
    ? Math.round(rx / pitch) * pitch
    : rx
  return Math.hypot(tcx - px, tcy - py) <= r
}

function snapSquareHoverBounds(
  px: number, py: number, rx: number, ry: number, pitch: number, alignX: number, alignY: number,
): { x0: number; x1: number; y0: number; y1: number } {
  const snapLo = (v: number, phase: number) => Math.floor((v - phase) / pitch) * pitch + phase
  const snapHi = (v: number, phase: number) => Math.ceil((v - phase) / pitch) * pitch + phase
  return {
    x0: snapLo(px - rx, alignX),
    x1: snapHi(px + rx, alignX),
    y0: snapLo(py - ry, alignY),
    y1: snapHi(py + ry, alignY),
  }
}

/** Normalized center-distance in [0,∞). Used only for reveal-reach cutoff. */
function tileHoverDistance(
  tcx: number, tcy: number, px: number, py: number,
  rx: number, ry: number, hoverShape: HoverShape, pitch: number,
): number {
  if (hoverShape === 'square') {
    const dx = Math.abs(tcx - px)
    const dy = Math.abs(tcy - py)
    return Math.max(rx > 0 ? dx / rx : 0, ry > 0 ? dy / ry : 0)
  }
  const r = hoverShape === 'pixel-circle' && pitch > 1
    ? Math.round(rx / pitch) * pitch
    : rx
  return r > 0 ? Math.hypot(tcx - px, tcy - py) / r : 0
}

function applyWarpSizeRange(
  basePiece: number, scale: number, spread: number,
  col: number, row: number, seed: number,
): number {
  const maxSz = basePiece * Math.max(0, Math.min(1, scale))
  if (spread <= 0) return maxSz
  const minSz = maxSz * Math.max(0, 1 - Math.min(1.5, spread))
  const t = tileThreshold(col, row, seed)
  const u = Math.pow(t, 1 / (1 + spread * 1.25))
  return minSz + (maxSz - minSz) * u
}

/** Cursor-directional WARP mask for the actual scene. Uses the pixel-grid tile
 *  shape (rounded rect from gap + radius) at rest and transforms it under the
 *  cursor. Tile size never exceeds the scene piece (pitch − gap) so gaps stay
 *  open. Size Spread randomizes each warped tile big→small within that cap. */
function buildWarpMask(
  canvas: HTMLCanvasElement, cw: number, ch: number,
  px: number, py: number, rx: number, ry: number, hoverShape: HoverShape, pitch: number,
  alignX: number, alignY: number, basePiece: number,
  rotateDeg: number, round: number, scale: number,
  spread: number, baseRadius: number,
  insideOnly = false, recolorCutoff?: number,
  snapSquare = false,
): string | null {
  if (pitch <= 1 || cw <= 0 || ch <= 0) return null
  const dpr = Math.min(2, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  const canvasW = Math.max(1, Math.round(cw * dpr))
  const canvasH = Math.max(1, Math.round(ch * dpr))
  if (canvas.width !== canvasW || canvas.height !== canvasH) {
    canvas.width = canvasW
    canvas.height = canvasH
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  ctx.fillStyle = '#000'
  const colLo = Math.floor((0 - alignX) / pitch) - 1
  const colHi = Math.ceil((cw - alignX) / pitch) + 1
  const rowLo = Math.floor((0 - alignY) / pitch) - 1
  const rowHi = Math.ceil((ch - alignY) / pitch) + 1
  const baseRound = clampTileRadius(baseRadius, basePiece)
  const maxWarpSz = basePiece * Math.max(0, Math.min(1, scale))
  const targetRound = baseRound + Math.max(0, Math.min(1, round)) * (basePiece / 2 - baseRound)
  const fullRot = rotateDeg * Math.PI / 180
  const effectiveSpread = Math.min(1.5, spread)
  const squareBounds = hoverShape === 'square' && snapSquare && pitch > 1
    ? snapSquareHoverBounds(px, py, rx, ry || rx, pitch, alignX, alignY)
    : undefined
  let drew = false
  for (let row = rowLo; row <= rowHi; row++) {
    const tcy = alignY + (row + 0.5) * pitch
    for (let col = colLo; col <= colHi; col++) {
      const tcx = alignX + (col + 0.5) * pitch
      const insideHover = tileInHoverArea(tcx, tcy, px, py, rx, ry || rx, hoverShape, pitch, squareBounds)
      if (insideOnly && !insideHover) continue
      if (recolorCutoff != null) {
        const t = tileHoverDistance(tcx, tcy, px, py, rx, ry || rx, hoverShape, pitch)
        if (t > recolorCutoff) continue
      }
      let sz: number
      let rot: number
      let rad: number
      if (insideHover) {
        sz = applyWarpSizeRange(basePiece, scale, effectiveSpread, col, row, 1337)
        rot = fullRot
        const desiredRad = maxWarpSz > 0
          ? baseRound + (targetRound - baseRound) * (sz / maxWarpSz)
          : baseRound
        rad = clampTileRadius(desiredRad, sz)
      } else {
        sz = basePiece
        rot = 0
        rad = clampTileRadius(baseRound, sz)
      }
      if (sz < 0.5) continue
      ctx.save()
      ctx.translate(tcx, tcy)
      if (rot) ctx.rotate(rot)
      roundRectPath(ctx, -sz / 2, -sz / 2, sz, sz, rad)
      ctx.fill()
      ctx.restore()
      drew = true
    }
  }
  return drew ? canvas.toDataURL() : null
}

export default function DitherHero() {
  const { shader: c, edge, copyVariant, hover, multiColor: mc, pixelGrid, animation: anim, layout, haptic: hap, terminalTheme: termThemeId, initialState } = useDitherStore()
  const copy = copyVariants[copyVariant]
  const activeTheme = termThemeId ? getThemeById(termThemeId) : undefined

  // APCA-safe CTA pair from terminal theme accent2.
  // If needed, background is nudged to keep CTA text readable.
  const ctaPair = activeTheme ? getAccessibleCtaPair(activeTheme.accent2, 60) : null
  const CTA_BG = ctaPair?.backgroundHex ?? DEFAULT_CTA_BG
  const CTA_BG_HOVER = activeTheme
    ? `oklch(from ${CTA_BG} calc(l + 0.08) c h)`
    : DEFAULT_CTA_BG_HOVER
  const ctaTextHex = ctaPair?.textHex ?? '#FFFFFF'
  const ctaTextColor = ctaTextHex
  const headlineColor = activeTheme
    ? activeTheme.fg
    : (copy.headlineColorMode === 'white' ? '#FFFFFF' : (copy.layout === 'problem' ? '#E6307A' : '#2DD4A8'))
  const responseColor = activeTheme
    ? CTA_BG
    : (copy.responseColorMode === 'white' ? '#FFFFFF' : '#2DD4A8')
  const sublineColor = activeTheme
    ? `oklch(from ${activeTheme.accent} calc(l + 0.15) calc(c * 0.6) h)`
    : `color-mix(in oklch, ${DEFAULT_CTA_BG} 45%, white)`

  // Hover dithering color — match response title color when themed
  const hoverFixColor = activeTheme ? responseColor : hover.fixColor

  // ── Web Haptics ──
  // On desktop (no navigator.vibrate), auto-enable debug audio so haptics are audible
  const hapticDebug = hap.debug || (hap.enabled && typeof navigator !== 'undefined' && !navigator.vibrate)
  const { trigger: hapticTrigger } = useWebHaptics({ debug: hapticDebug, showSwitch: false })
  const hapticDwellFired = useRef(false)

  const triggerHaptic = useCallback((pattern: string, options?: { intensity?: number }) => {
    if (!hap.enabled) return
    hapticTrigger(pattern, options)
  }, [hap.enabled, hapticTrigger])

  const edgeMask = useMemo(() => buildMask(edge.mode, edge.position), [edge.mode, edge.position])

  // When the pixel grid is on with snap, lock the dither to the tile grid:
  // axis-align it (rotation 0), collapse the per-layer spread to a single grid,
  // and size the dither dots to one-per-tile so cuts fall between shapes.
  const gridSnap = pixelGrid.enabled && pixelGrid.snap
  const gridPitch = pixelGridPitch(pixelGrid)
  // Shader `size` is authored in CSS px; the dot pitch tracks it ~1:1, so match
  // the tile pitch directly. Users can still nudge phase with Align X/Y.
  const snapDotSize = gridPitch
  const snapSpread = gridSnap ? 0 : null

  // ── Ripple edge animation ──
  const [ripplePhase, setRipplePhase] = useState(0)
  const rippleContainerRef = useRef<HTMLDivElement>(null)
  // Measured shader-container size, needed to build the pixelated ripple in px.
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  // The Paper dither shader pixelizes from the canvas center, not from 0,0.
  // Phase CSS/canvas masks to that same origin so rounded tiles do not reveal
  // off-grid shader fragments as thin slivers. Align X/Y remain manual nudges.
  const renderPixelGrid = useMemo(() => {
    if (!gridSnap || !containerSize.w || !containerSize.h) return pixelGrid
    return {
      ...pixelGrid,
      alignX: positiveModulo(containerSize.w / 2 + pixelGrid.alignX, gridPitch),
      alignY: positiveModulo(containerSize.h / 2 + pixelGrid.alignY, gridPitch),
    }
  }, [gridSnap, containerSize.w, containerSize.h, pixelGrid, gridPitch])

  useEffect(() => {
    if (edge.mode !== 'ripple') return
    if (edge.rippleSpeed === 0) return

    let running = true
    let last = performance.now()

    function tick(now: number) {
      if (!running) return
      const dt = (now - last) / 1000
      last = now
      setRipplePhase((p) => p + edge.rippleSpeed * dt * Math.PI * 2)
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    return () => { running = false }
  }, [edge.mode, edge.rippleSpeed])

  // Ripple dithers the wave (Photoshop dissolve) when its toggle is on; otherwise
  // it's a hard/pixelated clip. Quantize the animated phase so the dither SVG
  // doesn't regenerate every single frame.
  const sectionExtend = edge.shaderExtend > 0 || edge.textBlend
  const ditherWave = edge.mode === 'ripple' && edge.rippleDither && pixelGrid.enabled
  const ditherFlat = pixelGrid.enabled && (
    edge.mode === 'dissolve'
    || (edge.mode === 'overlap' && sectionExtend)
  )
  const ripplePixel = edge.mode === 'ripple' && edge.ripplePixelate && pixelGrid.enabled && !ditherWave
  const phaseQ = Math.round(ripplePhase * 3) / 3
  const [maskAnimT, setMaskAnimT] = useState(0)
  // Accumulated motion time lives in a ref so slider tweaks (which re-run the
  // rAF effect) resume from the current phase instead of snapping back to 0.
  const maskAnimTRef = useRef(0)
  const sizeMaskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rippleClip = useMemo(
    () => {
      if (edge.mode !== 'ripple' || ditherWave) return undefined
      if (ripplePixel) {
        return buildPixelRippleClip(
          edge.position, edge.rippleAmplitude, edge.rippleFrequency, ripplePhase,
          gridPitch, containerSize.w, containerSize.h, renderPixelGrid.alignY,
        )
      }
      return buildRippleSvg(edge.position, edge.rippleAmplitude, edge.rippleFrequency, ripplePhase)
    },
    [edge.mode, edge.position, edge.rippleAmplitude, edge.rippleFrequency, ripplePhase,
     ripplePixel, ditherWave, gridPitch, containerSize.w, containerSize.h, renderPixelGrid.alignY],
  )

  // ── Dither edge — Photoshop-style threshold dissolve. Flat band for
  // 'dissolve', or following the ripple wave when ripple+dither is on.
  // Mask regen rate is throttled at the rAF loop (12fps state updates) —
  // no extra time quantization here, so motion reads as continuous. ──
  const dissolveUrl = useMemo(
    () => {
      if (!(ditherFlat || ditherWave)) return undefined
      const wave = ditherWave
        ? { ampVh: edge.rippleAmplitude, freq: edge.rippleFrequency, phase: phaseQ }
        : undefined
      const motion = edge.textBlendMotion > 0 && (ditherFlat || ditherWave)
        ? { t: maskAnimT, strength: edge.textBlendMotion, scale: 1.5 }
        : undefined
      return buildDissolveMaskUrl(
        edge.position, edge.dissolveDepth, gridPitch,
        containerSize.w, containerSize.h, renderPixelGrid.alignY, edge.dissolveSeed, wave,
        motion,
        edge.shaderExtend > 0 ? edge.shaderExtend : 0,
      )
    },
    [ditherFlat, ditherWave, edge.position, edge.dissolveDepth, edge.dissolveSeed,
     edge.rippleAmplitude, edge.rippleFrequency, edge.textBlendMotion, edge.textBlend,
     edge.shaderExtend, phaseQ, maskAnimT,
     gridPitch, containerSize.w, containerSize.h, renderPixelGrid.alignY],
  )
  // ── Animation drift loop ──
  // Split into two update paths for performance:
  // 1. Opacity cycling → imperative DOM (60fps, smooth)
  // 2. Drift/scale/rotation → React state (24fps, sufficient for slow motion)
  const [drift, setDrift] = useState<AnimDrift>(zeroDrift)
  const driftRef = useRef<AnimDrift>({ ...zeroDrift })
  const colorCycleRef = useRef(c.colorCycleSpeed)
  colorCycleRef.current = c.colorCycleSpeed
  const alphaLayersRef = useRef(c.alphaLayers)
  alphaLayersRef.current = c.alphaLayers
  const alphaWrapperRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastTickRef = useRef(0)

  useEffect(() => {
    // Reset accumulated drift when animation config changes (e.g. scene template switch)
    driftRef.current = { ...zeroDrift }
    setDrift(zeroDrift)

    if (!anim.playing) {
      return
    }

    let running = true
    lastTickRef.current = performance.now()
    let lastReactUpdate = 0
    const REACT_INTERVAL = 1000 / 24 // 24fps for React state (drift props)

    const isOscillate = anim.scanMode === 'oscillate' && anim.scanAmplitude > 0
    const hasWave = anim.waveAmplitude > 0
    const hasGapPulse = anim.gapPulse > 0
    const hasLoopBreak = anim.loopBreak !== 'none' && anim.loopBreakAmount > 0
    const hasDrift = anim.driftX !== 0 || anim.driftY !== 0 || anim.rotationDrift !== 0 || anim.pulseAmount !== 0 || colorCycleRef.current > 0 || isOscillate || hasWave || hasGapPulse || hasLoopBreak

    if (!hasDrift) return

    const scanRad = anim.scanAngle * Math.PI / 180
    const waveRad = anim.waveAngle * Math.PI / 180

    function tick(now: number) {
      if (!running) return
      const rawDt = (now - lastTickRef.current) / 1000
      lastTickRef.current = now
      // Clamp dt to prevent jumps after tab-away
      const dt = Math.min(rawDt, 0.1)
      const d = driftRef.current
      const t = now / 1000

      // Offset motion — oscillating scan or continuous drift
      if (isOscillate) {
        const phase = t * anim.scanSpeed * Math.PI * 2
        const scanVal = anim.scanAmplitude * Math.sin(phase)
        d.offsetX = scanVal * Math.cos(scanRad)
        d.offsetY = scanVal * Math.sin(scanRad)
      } else {
        d.offsetY += anim.driftY * dt
        d.offsetX += anim.driftX * dt
        if (d.offsetY > 2) d.offsetY -= 4
        if (d.offsetY < -2) d.offsetY += 4
        if (d.offsetX > 2) d.offsetX -= 4
        if (d.offsetX < -2) d.offsetX += 4
      }

      // Wave sweep — oscillate origin for traveling wave effect
      if (hasWave) {
        const wavePhase = t * anim.waveSpeed * Math.PI * 2
        const waveVal = anim.waveAmplitude * Math.sin(wavePhase)
        d.waveOriginX = waveVal * Math.cos(waveRad)
        d.waveOriginY = waveVal * Math.sin(waveRad)
      }

      d.rotation += anim.rotationDrift * dt
      d.scale = anim.pulseAmount * Math.sin(t * anim.pulseSpeed * Math.PI * 2)
      d.colorPhase += colorCycleRef.current * dt
      if (hasGapPulse) d.gap = anim.gapPulse * (0.5 + 0.5 * Math.sin(t * anim.gapPulseSpeed * Math.PI * 2))

      // ── Loop break — non-looping motion layered on top of the scene ──
      if (hasLoopBreak) {
        const a2 = anim.loopBreakAmount
        const lb = anim.loopBreak
        if (lb === 'rotate' || lb === 'orbit') d.rotation += a2 * 8 * dt
        if (lb === 'drift' || lb === 'orbit') {
          d.offsetX += a2 * 0.03 * dt
          if (d.offsetX > 2) d.offsetX -= 4
          if (d.offsetX < -2) d.offsetX += 4
        }
        if (lb === 'wander') {
          const ang = t * 0.06 // direction slowly turns → organic, no clean cycle
          d.offsetX += Math.cos(ang) * a2 * 0.03 * dt
          d.offsetY += Math.sin(ang) * a2 * 0.03 * dt
          if (d.offsetX > 2) d.offsetX -= 4; else if (d.offsetX < -2) d.offsetX += 4
          if (d.offsetY > 2) d.offsetY -= 4; else if (d.offsetY < -2) d.offsetY += 4
          d.rotation += a2 * 2 * dt
        }
      }

      // Imperative opacity update — runs every frame for smooth color cycling
      if (colorCycleRef.current > 0) {
        const wrappers = alphaWrapperRefs.current
        const layers = alphaLayersRef.current
        const count = layers.length
        for (let i = 0; i < count; i++) {
          const el = wrappers[i]
          if (!el) continue
          const cycleOffset = (i / count) * Math.PI * 2
          const cycleFactor = 0.5 + 0.5 * Math.sin(d.colorPhase * Math.PI * 2 + cycleOffset)
          const opacity = Math.max(0.12, layers[i].opacity * (0.3 + 0.7 * cycleFactor))
          el.style.opacity = String(opacity)
        }
      }

      // Throttled React update for drift values (shader uniform props)
      if (now - lastReactUpdate >= REACT_INTERVAL) {
        lastReactUpdate = now
        setDrift({ ...d })
      }

      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    return () => { running = false }
  }, [anim.playing, anim.driftX, anim.driftY, anim.rotationDrift, anim.pulseAmount, anim.pulseSpeed, anim.scanMode, anim.scanAmplitude, anim.scanSpeed, anim.scanAngle, anim.waveAmplitude, anim.waveSpeed, anim.waveAngle, anim.gapPulse, anim.gapPulseSpeed, anim.loopBreak, anim.loopBreakAmount])

  // Sync hero colors to CSS custom properties so the header matches.
  // Must target the [data-palette] element — it overrides documentElement in the cascade.
  const THEME_VARS = [
    '--color-t-bg', '--color-t-bg-surface', '--color-t-headline', '--color-t-body',
    '--color-t-muted', '--color-t-cta-bg', '--color-t-cta-text', '--color-t-cta2-text',
    '--color-t-cta2-border', '--color-t-border', '--color-t-border-strong',
  ] as const
  useEffect(() => {
    const paletteEl = document.querySelector<HTMLElement>('[data-palette]')
    const target = paletteEl ?? document.documentElement
    target.style.setProperty('--color-t-bg', c.colorBack)

    if (activeTheme) {
      target.style.setProperty('--color-t-bg-surface', activeTheme.surface)
      target.style.setProperty('--color-t-headline', activeTheme.fg)
      target.style.setProperty('--color-t-body', `oklch(from ${activeTheme.fg} l c h / 0.65)`)
      target.style.setProperty('--color-t-muted', activeTheme.comment)
      target.style.setProperty('--color-t-cta-bg', CTA_BG)
      target.style.setProperty('--color-t-cta-text', ctaTextHex)
      target.style.setProperty('--color-t-cta2-text', `oklch(from ${activeTheme.fg} l c h / 0.8)`)
      target.style.setProperty('--color-t-cta2-border', `oklch(from ${activeTheme.fg} l c h / 0.15)`)
      target.style.setProperty('--color-t-border', `oklch(from ${activeTheme.fg} l c h / 0.1)`)
      target.style.setProperty('--color-t-border-strong', `oklch(from ${activeTheme.fg} l c h / 0.15)`)
    }

    return () => {
      for (const v of THEME_VARS) target.style.removeProperty(v)
    }
  }, [c.colorBack, activeTheme, CTA_BG, ctaTextHex])

  // Compose base config + drift
  const effectiveOffsetX = c.offsetX + drift.offsetX
  const effectiveOffsetY = c.offsetY + drift.offsetY
  const effectiveRotation = c.rotation + drift.rotation
  const effectiveScale = c.scale + drift.scale
  const effectiveSpeed = c.speed
  const effectiveFrame = c.frame || undefined

  // Animated pixel-grid gap (tile breathing) → rebuild the container mask with
  // the live gap. Cheap (tiny tile SVG); the dissolve mask is keyed on pitch so
  // it isn't regenerated by gap motion.
  const sizeMode = anim.tileDisplay === 'size' && pixelGrid.enabled && anim.tileSizeSpread > 0
  const pointSizeMode = anim.tileDisplay === 'points' && pixelGrid.enabled && anim.tileSizeSpread > 0
  const animGap = sizeMode || pointSizeMode
    ? renderPixelGrid.gap
    : Math.max(0, Math.round(renderPixelGrid.gap + drift.gap))
  const effGrid = animGap === renderPixelGrid.gap ? renderPixelGrid : { ...renderPixelGrid, gap: animGap }
  // Tile-size mask — drawn to a canvas, exported async via toBlob + object URL.
  // toDataURL was a sync PNG encode + a ~90KB base64 string through CSSOM on
  // every update, which dropped the whole page to ~30fps. The effect also keys
  // on scalars (not effGrid's identity, which changes every render during gap
  // pulse) so redraws happen at the 12fps motion rate, not the render rate.
  const [sizeMask, setSizeMask] = useState<{ url: string; w: number; h: number } | undefined>(undefined)
  const sizeMaskGenRef = useRef(0)
  const pointSizeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const gen = ++sizeMaskGenRef.current
    if (!sizeMode || !containerSize.w) {
      setSizeMask(undefined)
      return
    }
    if (!sizeMaskCanvasRef.current) sizeMaskCanvasRef.current = document.createElement('canvas')
    const canvas = sizeMaskCanvasRef.current
    const grid = animGap === renderPixelGrid.gap ? renderPixelGrid : { ...renderPixelGrid, gap: animGap }
    const drawn = drawTileSizeMask(
      canvas, containerSize.w, containerSize.h, grid,
      maskAnimT, anim.tileSizeSpread, anim.tileSizeNoise,
      undefined, edge.topInset,
    )
    if (!drawn) {
      setSizeMask(undefined)
      return
    }
    canvas.toBlob((blob) => {
      if (!blob || gen !== sizeMaskGenRef.current) return
      setSizeMask({ url: URL.createObjectURL(blob), w: containerSize.w, h: containerSize.h })
    })
  }, [sizeMode, containerSize.w, containerSize.h, renderPixelGrid, animGap, maskAnimT,
    anim.tileSizeSpread, anim.tileSizeNoise, edge.dissolveSeed, edge.topInset])

  // Revoke the replaced blob URL only after the new one has committed, so the
  // mask never points at a dead resource mid-paint.
  useEffect(() => {
    const url = sizeMask?.url
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [sizeMask])

  const sizeMaskUrl = sizeMask?.w === containerSize.w && sizeMask.h === containerSize.h
    ? sizeMask.url
    : undefined

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
  const [baselineNudge, setBaselineNudge] = useState({ response: 0, cta: 0 })
  useEffect(() => {
    const content = contentRef.current
    const host = shaderContainerRef.current
    if (!content || !host) return
    const isFull = edge.mode === 'full'
    const measure = () => {
      const hostRect = host.getBoundingClientRect()
      setContentTop((prev) => {
        const top = Math.round(content.getBoundingClientRect().top - hostRect.top)
        return prev === top ? prev : top
      })
      if (!isFull) return
      const rects: TextRect[] = []
      content.querySelectorAll('h1, p, a').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
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
  }, [edge.mode, copyVariant, layout, baselineNudge])

  // Baseline lock (problem layout) — the right column snaps to the left one:
  // the response's last line shares the headline's last baseline, the CTA
  // text sits on the sub's bottom baseline. Nudges accumulate incrementally
  // (target minus current, measured post-transform) so the lock converges and
  // then holds across font, size, and copy changes.
  useEffect(() => {
    if (copy.layout !== 'problem') return
    // Generous bound: at wide viewports the CTA's natural distance from the
    // sub's last baseline can exceed 50px — a tight clamp saturates just
    // short of the target and the lock visibly misses.
    const clampNudge = (v: number) => Math.max(-200, Math.min(200, Math.round(v * 2) / 2))
    const measure = () => {
      const h1El = lockHeadlineRef.current
      const respP = lockResponseWrapRef.current?.querySelector('p')
      const subEl = lockSubRef.current
      const ctaEl = lockCtaRef.current
      setBaselineNudge((prev) => {
        let { response, cta } = prev
        const hB = h1El && lastLineBaseline(h1El)
        const rB = respP && lastLineBaseline(respP)
        if (hB != null && rB != null && Math.abs(hB - rB) > 0.5) response = clampNudge(response + (hB - rB))
        const sB = subEl && lastLineBaseline(subEl)
        const cB = ctaEl && lastLineBaseline(ctaEl)
        if (sB != null && cB != null && Math.abs(sB - cB) > 0.5) cta = clampNudge(cta + (sB - cB))
        return response === prev.response && cta === prev.cta ? prev : { response, cta }
      })
    }
    measure()
    const content = contentRef.current
    const ro = content ? new ResizeObserver(measure) : null
    if (ro && content) ro.observe(content)
    // Viewport-height changes reposition the grid without resizing the
    // content box, so the ResizeObserver alone misses them.
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [copy.layout, copyVariant, layout.headlineCols, layout.responseCols, layout.gutter,
    containerSize.w, baselineNudge])

  // Baseline guides — debug overlay for alignment checks. One line per
  // rendered text line (headline, sub, response, CTAs), computed from the
  // line box: top + half-leading + ~0.8em ascent approximates the baseline.
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
        const fontSize = parseFloat(getComputedStyle(el).fontSize)
        const range = document.createRange()
        range.selectNodeContents(el)
        for (const r of range.getClientRects()) {
          if (r.width < 8 || r.height < fontSize * 0.5) continue
          lines.push(Math.round(r.top - hostTop + (r.height - fontSize) / 2 + fontSize * 0.8))
        }
      })
      const unique = [...new Set(lines)].sort((a, b) => a - b)
      setBaselineGuides((prev) => (JSON.stringify(prev) === JSON.stringify(unique) ? prev : unique))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(content)
    ro.observe(host)
    return () => ro.disconnect()
  }, [layout.showBaselines, copyVariant, layout, baselineNudge])

  useEffect(() => {
    if (!pointSizeMode || !containerSize.w || !pointSizeCanvasRef.current) return
    drawPointSizeCanvas(
      pointSizeCanvasRef.current,
      containerSize.w,
      containerSize.h,
      effGrid,
      maskAnimT,
      anim.tileSizeSpread,
      anim.tileSizeNoise,
      c.transparentBg ? c.alphaLayers : [{ color: c.colorFront, opacity: 0.9 }],
      c.colorFront,
      edge,
      textRects,
      contentTop ?? undefined,
    )
  }, [pointSizeMode, containerSize.w, containerSize.h, effGrid, maskAnimT,
    anim.tileSizeSpread, anim.tileSizeNoise, c.transparentBg, c.alphaLayers, c.colorFront, edge, textRects, contentTop])

  // Warp companion canvas — the fix-layer content drawn as the SAME dot field
  // (same geometry, size map, and Top-start phase) so tiles shown through the
  // warp masks match the resting dots 1:1. Reveal uses the alternate state's
  // hover-layer colors; Recolor keeps the base pattern and swaps the tint.
  // Without this the fix layer renders the WebGL dither, whose pattern does
  // not share the points grid — masked tiles read as cut half-dots.
  const revealPointsCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const warpPointsFix = pointSizeMode && hover.mode === 'warp'
    && (hover.warpRevealEnabled || hover.warpRecolorEnabled)
  useEffect(() => {
    if (!warpPointsFix || !containerSize.w || !revealPointsCanvasRef.current) return
    const layers = hover.warpRevealEnabled
      ? hover.hoverLayers.map((l) => ({ color: l.color, opacity: l.opacity }))
      : (c.transparentBg ? c.alphaLayers : [{ color: c.colorFront, opacity: 0.9 }])
          .map((l) => ({ color: hoverFixColor, opacity: l.opacity }))
    drawPointSizeCanvas(
      revealPointsCanvasRef.current,
      containerSize.w,
      containerSize.h,
      effGrid,
      maskAnimT,
      anim.tileSizeSpread,
      anim.tileSizeNoise,
      layers,
      hoverFixColor,
      edge,
      textRects,
      contentTop ?? undefined,
    )
  }, [warpPointsFix, hover.warpRevealEnabled, hover.hoverLayers, hoverFixColor,
    c.transparentBg, c.alphaLayers, c.colorFront,
    containerSize.w, containerSize.h, effGrid, maskAnimT, anim.tileSizeSpread, anim.tileSizeNoise, edge, textRects, contentTop])

  const finalContainerStyle = !pixelGrid.enabled
    ? undefined
    : pointSizeMode
      ? undefined
      : sizeMode && sizeMaskUrl
      ? buildSizeMaskContainerStyle(sizeMaskUrl, (ditherFlat || ditherWave) ? dissolveUrl : undefined)
      : ((ditherFlat || ditherWave) && dissolveUrl)
        ? buildDissolveContainerStyle(effGrid, dissolveUrl)
        : buildPixelGridMask(effGrid)

  useEffect(() => {
    const needsDissolveMotion = edge.textBlendMotion > 0 && edge.textBlendSpeed > 0
      && (edge.mode === 'dissolve' || edge.mode === 'ripple' || (edge.mode === 'overlap' && edge.textBlend))
    const needsSizeMotion = (anim.tileDisplay === 'size' || anim.tileDisplay === 'points') && anim.tileSizeSpread > 0 && anim.tileSizeSpeed > 0
    if (!anim.playing || (!needsDissolveMotion && !needsSizeMotion)) return

    let running = true
    let last = performance.now()
    let lastUpdate = 0
    const interval = 1000 / 12

    function tick(now: number) {
      if (!running) return
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (needsDissolveMotion) maskAnimTRef.current += dt * edge.textBlendSpeed
      else if (needsSizeMotion) maskAnimTRef.current += dt * anim.tileSizeSpeed
      if (now - lastUpdate >= interval) {
        lastUpdate = now
        setMaskAnimT(maskAnimTRef.current)
      }
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    return () => { running = false }
  }, [anim.playing, anim.tileDisplay, anim.tileSizeSpread, anim.tileSizeSpeed,
    edge.mode, edge.textBlend, edge.textBlendMotion, edge.textBlendSpeed])

  // ── Hover interaction ──
  // Performance: rAF loop only runs while hovering or radius is settling.
  // Mouse influence updates throttled to 10fps to avoid re-rendering all Dithering components.
  const shaderContainerRef = useRef<HTMLDivElement>(null)
  const fixLayerRef = useRef<HTMLDivElement>(null)
  const [hoverActive, setHoverActive] = useState(false)

  // Track the shader container's pixel size so the pixelated ripple can be
  // built in px (matching the tile grid).
  useEffect(() => {
    const el = shaderContainerRef.current
    if (!el) return
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const mouseRef = useRef({ nx: 0.5, ny: 0.5 })
  const [mouse, setMouse] = useState({ nx: 0.5, ny: 0.5 })
  const hoverAnim = useRef({ radius: 0, radiusY: 0, targetRadius: 0, targetRadiusY: 0, px: 0, py: 0, prevPx: 0, prevPy: 0, velocity: 0, hovering: false, rafId: 0, cw: 0, ch: 0, lastTime: 0, dwellRadius: 0 })
  const hoverShapeRef = useRef(hover.hoverShape)
  hoverShapeRef.current = hover.hoverShape
  // Hover masks must share the SAME row phase as the drawn field: points mode
  // shifts the grid vertically for Top start, so warp/recolor masks built on
  // the unshifted grid would clip every dot into partial slivers.
  const hoverAlignY = pointSizeMode && edge.topInset > 0
    ? renderPixelGrid.alignY + positiveModulo(edge.topInset - renderPixelGrid.alignY, gridPitch)
    : renderPixelGrid.alignY
  // Tile-snapping params for whole-tile recolor — the cursor rect snaps to this
  // grid so only complete tiles recolor (no partial tiles at the cursor edge).
  const tileSnapRef = useRef({ on: false, pitch: 1, alignX: 0, alignY: 0 })
  tileSnapRef.current = {
    on: hover.wholeTiles && pixelGrid.enabled,
    pitch: gridPitch,
    alignX: renderPixelGrid.alignX,
    alignY: hoverAlignY,
  }
  // Pixel-circle always fills whole tiles when the grid is on (independent of the
  // Whole-Tiles toggle, which gates the square recolor) — the grid params it needs.
  const pcGridRef = useRef({ enabled: false, pitch: 1, alignX: 0, alignY: 0 })
  pcGridRef.current = {
    enabled: pixelGrid.enabled,
    pitch: gridPitch,
    alignX: renderPixelGrid.alignX,
    alignY: hoverAlignY,
  }
  // Warp mode — config + a reused canvas + the resting container mask to restore.
  const hoverModeRef = useRef(hover.mode)
  hoverModeRef.current = hover.mode
  const warpRef = useRef({
    rotate: 0, round: 0, scale: 1, spread: 0, recolor: 0, recolorEnabled: true, overlayEnabled: false, revealEnabled: false,
    dynamicSpread: false, basePiece: 1, baseRadius: 0, snapSquare: false,
  })
  warpRef.current = {
    rotate: hover.warpRotate,
    round: hover.warpRound,
    scale: hover.warpScale,
    spread: hover.warpJitter,
    recolor: hover.warpRecolor,
    recolorEnabled: hover.warpRecolorEnabled,
    overlayEnabled: hover.warpOverlayEnabled,
    revealEnabled: hover.warpRevealEnabled,
    dynamicSpread: hover.dynamicSize,
    basePiece: pixelGridPitch(effGrid) - Math.max(0, Math.min(Math.round(effGrid.gap), pixelGridPitch(effGrid) - 1)),
    baseRadius: effGrid.radius,
    snapSquare: hover.wholeTiles && pixelGrid.enabled,
  }
  const warpCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const warpSceneCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const warpGenRef = useRef({ px: -1, py: -1, r: -1, ry: -1, velocity: -1, key: '' })
  const [warp, setWarp] = useState<{ url: string; sceneUrl: string | null; px: number; py: number; r: number } | null>(null)
  const dynamicSizeRef = useRef(hover.dynamicSize)
  dynamicSizeRef.current = hover.dynamicSize
  const baseRadiusRef = useRef(hover.radius)
  baseRadiusRef.current = hover.radius
  const baseRadiusYRef = useRef(hover.radiusY)
  baseRadiusYRef.current = hover.radiusY
  const hoverPreviewRef = useRef(hover.preview)
  hoverPreviewRef.current = hover.preview
  const hoverTriggerRef = useRef(hover.trigger)
  hoverTriggerRef.current = hover.trigger
  const dwellSpeedRef = useRef(hover.dwellSpeed)
  dwellSpeedRef.current = hover.dwellSpeed
  const dwellFadeBackRef = useRef(hover.dwellFadeBack)
  dwellFadeBackRef.current = hover.dwellFadeBack
  // Haptic refs for event handler closures
  const hapticConfigRef = useRef(hap)
  hapticConfigRef.current = hap
  const triggerHapticRef = useRef(triggerHaptic)
  triggerHapticRef.current = triggerHaptic

  useEffect(() => {
    if (!hover.enabled) return
    const el = shaderContainerRef.current
    if (!el) return

    let running = true
    let lastMouseUpdate = 0
    const MOUSE_INTERVAL = 100 // 10fps for React state (mouse influence)
    let wasHovering = false
    // Haptic: distance accumulator for texture-like ticks
    let hapticDistAccum = 0
    let prevDwellPct = 0

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
      mouseRef.current.nx = a.px / (rect.width || 1)
      mouseRef.current.ny = a.py / (rect.height || 1)
      if (!hoverActive) setHoverActive(true)

      // Haptic: trigger on first hover enter
      if (!wasHovering) {
        wasHovering = true
        hapticDwellFired.current = false
        hapticDistAccum = 0
        prevDwellPct = 0
        triggerHapticRef.current(hapticConfigRef.current.hoverEnter)
      }

      startLoop()
    }

    function handleLeave() {
      hoverAnim.current.targetRadius = 0
      hoverAnim.current.hovering = false
      wasHovering = false
      hapticDistAccum = 0
      // Haptic: trigger on leave
      triggerHapticRef.current(hapticConfigRef.current.hoverLeave)
    }

    function animate() {
      if (!running) return
      const a = hoverAnim.current
      a.rafId = 0
      const now = performance.now()
      const dt = Math.min((now - (a.lastTime || now)) / 1000, 0.1)
      a.lastTime = now

      // Track mouse velocity for dynamic sizing
      const dx = a.px - a.prevPx
      const dy = a.py - a.prevPy
      a.prevPx = a.px
      a.prevPy = a.py
      const speed = Math.sqrt(dx * dx + dy * dy)
      a.velocity += (speed - a.velocity) * 0.12

      // ── Haptic: animation-synced movement ticks ──
      // Accumulate pixel distance traveled — fire tick every N pixels
      // Like dragging your finger across a textured surface
      const hc = hapticConfigRef.current
      if (hc.enabled && a.hovering && hc.tickDistance > 0 && speed > 0.5) {
        hapticDistAccum += speed
        if (hapticDistAccum >= hc.tickDistance) {
          hapticDistAccum -= hc.tickDistance
          // Velocity-modulated intensity: faster = lighter touch, slower = heavier press
          const intensity = hc.velocityIntensity
            ? Math.min(0.2 + a.velocity / 12, 1)
            : undefined
          triggerHapticRef.current(hc.tickPattern, { intensity })
        }
      }

      const isDwell = hoverTriggerRef.current === 'dwell'

      if (isDwell) {
        // Dwell mode: radius grows linearly while hovering, shrinks on leave.
        // Ceiling = the configured Mask → Radius (capped at the screen diagonal),
        // so the size control is wired to dwell and Growth/Fade Back feel
        // responsive instead of crawling toward a full-screen target. Crank
        // Radius to its max for a full takeover.
        const diag = Math.sqrt(a.cw * a.cw + a.ch * a.ch)
        const cap = Math.max(baseRadiusRef.current, baseRadiusYRef.current ?? baseRadiusRef.current)
        const maxR = Math.min(diag, cap > 0 ? cap : diag)
        if (a.hovering) {
          a.dwellRadius = Math.min(a.dwellRadius + dwellSpeedRef.current * dt, maxR)

          // Haptic: progress ticks at percentage milestones
          if (hc.enabled && hc.dwellTickPercent > 0) {
            const pct = (a.dwellRadius / maxR) * 100
            const step = hc.dwellTickPercent
            if (Math.floor(pct / step) > Math.floor(prevDwellPct / step)) {
              const progressIntensity = Math.min(0.3 + (pct / 100) * 0.7, 1)
              triggerHapticRef.current(hc.tickPattern, { intensity: progressIntensity })
            }
            prevDwellPct = pct
          }

          // Haptic: fire once when dwell reaches full coverage
          if (a.dwellRadius >= maxR && !hapticDwellFired.current) {
            hapticDwellFired.current = true
            triggerHapticRef.current(hc.dwellComplete)
          }
        } else {
          a.dwellRadius = Math.max(a.dwellRadius - dwellSpeedRef.current * dwellFadeBackRef.current * dt, 0)
          prevDwellPct = maxR > 0 ? (a.dwellRadius / maxR) * 100 : 0
        }
        a.radius = a.dwellRadius
      } else {
        // Instant mode: fixed radius follows cursor
        if (a.hovering) {
          const base = baseRadiusRef.current
          const baseY = baseRadiusYRef.current ?? base
          if (dynamicSizeRef.current) {
            const factor = 0.35 + Math.min(a.velocity / 10, 1.65)
            a.targetRadius = base * factor
            a.targetRadiusY = baseY * factor
          } else {
            a.targetRadius = base
            a.targetRadiusY = baseY
          }
        }

        a.radius += (a.targetRadius - a.radius) * 0.08
        a.radiusY += (a.targetRadiusY - a.radiusY) * 0.08
        if (a.radius < 1 && a.targetRadius === 0) a.radius = 0
        if (a.radiusY < 1 && a.targetRadiusY === 0) a.radiusY = 0
      }

      const fixEl = fixLayerRef.current
      if (hoverModeRef.current === 'warp') {
        const g = pcGridRef.current
        const gen = warpGenRef.current
        if (g.enabled && g.pitch > 1 && a.cw > 0 && (a.radius > 0)) {
          if (fixEl) fixEl.style.visibility = 'visible'
          const wc = warpRef.current
          const velocitySpread = wc.dynamicSpread
            ? Math.min(a.velocity / 6, 0.75)
            : 0
          const spread = Math.min(1.5, wc.spread + velocitySpread)
          const spreadChanged = wc.dynamicSpread && Math.abs(a.velocity - gen.velocity) >= 0.75
          const shape = hoverShapeRef.current
          const maskKey = [
            shape, g.pitch, g.alignX, g.alignY, wc.basePiece, wc.baseRadius,
            wc.rotate, wc.round, wc.scale, spread, wc.recolor, wc.recolorEnabled,
            wc.overlayEnabled, wc.revealEnabled, wc.snapSquare,
          ].join(':')
          if (Math.abs(a.px - gen.px) >= 2 || Math.abs(a.py - gen.py) >= 2 || Math.abs(a.radius - gen.r) >= 2 || Math.abs(a.radiusY - gen.ry) >= 2 || spreadChanged || gen.key !== maskKey) {
            if (!warpCanvasRef.current) warpCanvasRef.current = document.createElement('canvas')
            const url = buildWarpMask(
              warpCanvasRef.current, a.cw, a.ch, a.px, a.py, a.radius, a.radiusY || a.radius, shape,
              g.pitch, g.alignX, g.alignY, wc.basePiece, wc.rotate, wc.round, wc.scale, spread, wc.baseRadius,
              false, undefined, wc.snapSquare,
            )
            let sceneUrl: string | null = null
            if (url && (wc.revealEnabled || (wc.recolorEnabled && wc.recolor > 0))) {
              // Reveal covers every warped tile (reach 1); recolor uses its reach.
              if (!warpSceneCanvasRef.current) warpSceneCanvasRef.current = document.createElement('canvas')
              sceneUrl = buildWarpMask(
                warpSceneCanvasRef.current, a.cw, a.ch, a.px, a.py, a.radius, a.radiusY || a.radius, shape,
                g.pitch, g.alignX, g.alignY, wc.basePiece, wc.rotate, wc.round, wc.scale, spread, wc.baseRadius,
                true, wc.revealEnabled ? 1 : wc.recolor, wc.snapSquare,
              )
            } else if (url && wc.overlayEnabled) {
              if (!warpSceneCanvasRef.current) warpSceneCanvasRef.current = document.createElement('canvas')
              sceneUrl = buildWarpMask(
                warpSceneCanvasRef.current, a.cw, a.ch, a.px, a.py, a.radius, a.radiusY || a.radius, shape,
                g.pitch, g.alignX, g.alignY, wc.basePiece, wc.rotate, wc.round, wc.scale, spread, wc.baseRadius,
                true, 1, wc.snapSquare,
              )
            }
            if (url) {
              gen.px = a.px; gen.py = a.py; gen.r = a.radius; gen.ry = a.radiusY; gen.velocity = a.velocity; gen.key = maskKey
              setWarp({ url, sceneUrl, px: a.px, py: a.py, r: a.radius })
            }
          }
        } else if (a.radius <= 0 && gen.r !== -1) {
          gen.px = -1; gen.py = -1; gen.r = -1; gen.ry = -1; gen.velocity = -1; gen.key = ''
          setWarp(null)
          if (fixEl) fixEl.style.visibility = 'hidden'
        } else if (fixEl && !hoverPreviewRef.current) {
          fixEl.style.visibility = 'hidden'
        }
      } else if (fixEl && !hoverPreviewRef.current) {
        // Left warp mode with a mask still up → clear it so React restores the grid.
        if (warpGenRef.current.r !== -1) { warpGenRef.current = { px: -1, py: -1, r: -1, ry: -1, velocity: -1, key: '' }; setWarp(null) }
        if (a.radius > 0 || a.radiusY > 0) {
          if (hoverShapeRef.current === 'square') {
            const ry = a.radiusY || a.radius
            // Cursor rect edges (absolute), optionally snapped to the tile grid
            // so the recolor covers only whole tiles.
            let x0 = a.px - a.radius, x1 = a.px + a.radius
            let y0 = a.py - ry, y1 = a.py + ry
            const ts = tileSnapRef.current
            if (ts.on && ts.pitch > 1) {
              const snapLo = (v: number, phase: number) => Math.floor((v - phase) / ts.pitch) * ts.pitch + phase
              const snapHi = (v: number, phase: number) => Math.ceil((v - phase) / ts.pitch) * ts.pitch + phase
              x0 = snapLo(x0, ts.alignX); x1 = snapHi(x1, ts.alignX)
              y0 = snapLo(y0, ts.alignY); y1 = snapHi(y1, ts.alignY)
            }
            const top = Math.max(0, y0)
            const right = Math.max(0, a.cw - x1)
            const bottom = Math.max(0, a.ch - y1)
            const left = Math.max(0, x0)
            fixEl.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`
            fixEl.style.maskImage = ''
            fixEl.style.webkitMaskImage = ''
          } else if (hoverShapeRef.current === 'pixel-circle') {
            const g = pcGridRef.current
            if (g.enabled && g.pitch > 1) {
              // Whole-tile pixel circle: every tile is fully filled or fully empty
              // (center-in-radius), so each pixel recolors/reveals COMPLETELY — no
              // tiles sliced mid-cell at the rim. A staircased circle of full tiles.
              // Snap the radius to whole-tile steps so the dwell GROWS in discrete
              // tile rings — a tile pops fully on/off, never caught half-swept by a
              // smoothly-advancing boundary. No semi-filled pixel at any frame.
              const rSnap = Math.round(a.radius / g.pitch) * g.pitch
              const clip = buildWholeTileCircleClip(
                a.px, a.py, rSnap, g.pitch, g.alignX, g.alignY, a.cw, a.ch,
              )
              fixEl.style.maskImage = ''
              fixEl.style.webkitMaskImage = ''
              fixEl.style.clipPath = clip
            } else {
              // No pixel grid → fall back to a hard-edged radial circle.
              const m = `radial-gradient(circle ${a.radius}px at ${a.px}px ${a.py}px, black 0%, black 100%, transparent 100%)`
              fixEl.style.clipPath = ''
              fixEl.style.maskImage = m
              fixEl.style.webkitMaskImage = m
            }
          } else {
            // Circle: hard single-size edge (no soft fade) — one crisp size.
            const m = `radial-gradient(circle ${a.radius}px at ${a.px}px ${a.py}px, black 0%, black 100%, transparent 100%)`
            fixEl.style.clipPath = ''
            fixEl.style.maskImage = m
            fixEl.style.webkitMaskImage = m
          }
          fixEl.style.visibility = 'visible'
        } else {
          fixEl.style.visibility = 'hidden'
        }
      }

      // Throttled mouse influence update
      if (a.hovering && now - lastMouseUpdate >= MOUSE_INTERVAL) {
        lastMouseUpdate = now
        setMouse({ ...mouseRef.current })
      }

      // Keep looping only while radius is non-zero or settling
      if (a.radius > 0.5 || a.hovering) {
        a.rafId = requestAnimationFrame(animate)
      }
    }

    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)

    return () => {
      running = false
      if (hoverAnim.current.rafId) cancelAnimationFrame(hoverAnim.current.rafId)
      hoverAnim.current.rafId = 0
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
    }
  }, [hover.enabled, hover.radius, hoverActive])

  // Clear clip-path/mask when entering preview mode
  useEffect(() => {
    const fixEl = fixLayerRef.current
    if (!fixEl) return
    if (hover.preview) {
      fixEl.style.clipPath = ''
      fixEl.style.maskImage = ''
      fixEl.style.webkitMaskImage = ''
      fixEl.style.visibility = 'visible'
    }
  }, [hover.preview])

  const baseOriginX = (hover.enabled
    ? c.originX + (mouse.nx - 0.5) * hover.mouseInfluence
    : c.originX) + drift.waveOriginX
  const baseOriginY = (hover.enabled
    ? c.originY + (mouse.ny - 0.5) * hover.mouseInfluence
    : c.originY) + drift.waveOriginY

  // Resolve shader colorBack — transparent mode uses black + screen blend (reliable)
  const shaderColorBack = c.transparentBg ? '#000000' : c.colorBack

  // Shared shader props (base config + drift).
  // In grid-snap mode we neutralise the sizing so the dither's pxSize maps 1:1
  // to tile-sized SOLID blocks (one block per tile): scale 1, full-res backing,
  // axis-aligned. That makes each tile a single flat color, so at gap 0 the
  // tiles are fully contiguous (no inter-dot lines from the dither).
  const sharedProps = {
    colorBack: shaderColorBack,
    type: c.type,
    size: gridSnap ? snapDotSize : c.size,
    fit: c.fit,
    worldWidth: c.worldWidth,
    worldHeight: c.worldHeight,
    offsetX: effectiveOffsetX,
    offsetY: effectiveOffsetY,
    // In snap mode the BASE rotation stays 0 (tiles axis-aligned) but the drift
    // rotation still spins the color source under the static tiles — the colors
    // sweep around, which breaks the looping feel without ragged edges.
    rotation: gridSnap ? drift.rotation : effectiveRotation,
    scale: effectiveScale,
    speed: effectiveSpeed,
    frame: effectiveFrame,
    maxPixelCount: 500000,
    minPixelRatio: 1,
  } as const

  // Hover layer shader props — inherit from base, apply per-layer overrides
  const hoverSharedProps = {
    ...sharedProps,
    ...(hover.fixType != null && { type: hover.fixType }),
    ...(hover.fixSize != null && { size: hover.fixSize }),
    ...(hover.fixSpeed != null && { speed: hover.fixSpeed }),
    ...(hover.fixScale != null && { scale: hover.fixScale + drift.scale }),
    ...(hover.fixRotation != null && { rotation: hover.fixRotation + drift.rotation }),
    ...(hover.fixOffsetX != null && { offsetX: hover.fixOffsetX + drift.offsetX }),
    ...(hover.fixOffsetY != null && { offsetY: hover.fixOffsetY + drift.offsetY }),
    // Grid snap wins over per-layer overrides so the reveal shares the tile grid.
    ...(gridSnap && { rotation: 0, size: snapDotSize }),
  }

  const warpActive = hover.mode === 'warp' && warp != null
  const containerStyle: React.CSSProperties | undefined = warpActive && warp
    ? {
        maskImage: `url(${warp.url})`, WebkitMaskImage: `url(${warp.url})`,
        maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
        maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
        maskPosition: '0 0', WebkitMaskPosition: '0 0',
      }
    : finalContainerStyle
  const warpSceneStyle: React.CSSProperties | undefined = warpActive && warp?.sceneUrl && (hover.warpRevealEnabled || hover.warpRecolorEnabled || hover.warpOverlayEnabled)
    ? {
        maskImage: `url(${warp.sceneUrl})`, WebkitMaskImage: `url(${warp.sceneUrl})`,
        maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
        maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
        maskPosition: '0 0', WebkitMaskPosition: '0 0',
      }
    : undefined
  const warpReveal = hover.mode === 'warp' && hover.warpRevealEnabled
  const fixLayerBg = hover.mode === 'overlay'
    ? hoverFixColor
    : (hover.mode === 'warp' && hover.warpOverlayEnabled && !hover.warpRecolorEnabled && !hover.warpRevealEnabled)
      ? hoverFixColor
      : c.colorBack
  const fixLayerOpacity = (hover.mode === 'overlay'
    || (hover.mode === 'warp' && hover.warpOverlayEnabled && !hover.warpRecolorEnabled && !hover.warpRevealEnabled))
    ? hover.overlayOpacity
    : undefined
  const fixLayerBlend = hover.mode === 'overlay' ? hover.overlayBlend : undefined
  const textUnderScene = edge.textBlend || edge.mode === 'full'
  const textReadabilityStyle: React.CSSProperties | undefined = textUnderScene
    ? { textShadow: `0 2px 28px ${c.colorBack}, 0 1px 6px ${c.colorBack}, 0 0 1px ${c.colorBack}` }
    : undefined

  return (
    <section className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: c.colorBack }}>
      <div ref={shaderContainerRef} className="absolute inset-0" style={containerStyle}>
        {pointSizeMode && (
          <canvas
            ref={pointSizeCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Base layer — alpha mode renders stacked color layers with screen blend */}
        {!pointSizeMode && (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: c.colorBack,
              ...(rippleClip
                ? { clipPath: rippleClip }
                : edgeMask
                  ? { maskImage: edgeMask, WebkitMaskImage: edgeMask }
                  : {}),
            }}
          >
            {c.transparentBg ? (
              c.alphaLayers.map((layer, i) => {
                const spread = snapSpread ?? c.alphaSpread * i
                return (
                  <div
                    key={i}
                    ref={(el) => { alphaWrapperRefs.current[i] = el }}
                    className="absolute inset-0"
                    style={{ opacity: layer.opacity, mixBlendMode: 'screen' }}
                  >
                    <Dithering
                      {...sharedProps}
                      colorBack="#000000"
                      colorFront={layer.color}
                      shape={layer.shape}
                      originX={baseOriginX + spread * 0.8}
                      originY={baseOriginY + spread * 0.6}
                      offsetX={effectiveOffsetX + spread * 2}
                      offsetY={effectiveOffsetY + spread * 1.5}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                )
              })
            ) : (
              <Dithering
                {...sharedProps}
                colorFront={c.colorFront}
                shape={c.shape}
                originX={baseOriginX}
                originY={baseOriginY}
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </div>
        )}

        {/* Multi-color error layers — semi-opacity with offset for natural variation */}
        {mc.enabled && !pointSizeMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={
              rippleClip
                ? { clipPath: rippleClip }
                : edgeMask
                  ? { maskImage: edgeMask, WebkitMaskImage: edgeMask }
                  : undefined
            }
          >
            {mc.colors.map((color, i) => {
              const layer = COLOR_LAYERS[i % COLOR_LAYERS.length]
              const spread = mc.layerSpread * (i + 1)
              return (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{
                    opacity: layer.opacity,
                    mixBlendMode: mc.blend,
                  }}
                >
                  <Dithering
                    {...sharedProps}
                    colorBack="#000000"
                    colorFront={color}
                    shape={layer.shape}
                    originX={baseOriginX + spread * 0.8}
                    originY={baseOriginY + spread * 0.6}
                    offsetX={effectiveOffsetX + spread * 3}
                    offsetY={effectiveOffsetY + spread * 2}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Hover layer — lazy-mounted on first hover (or always when preview) */}
        {hover.enabled && (hoverActive || hover.preview) && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={
              rippleClip
                ? { clipPath: rippleClip }
                : edgeMask
                  ? { maskImage: edgeMask, WebkitMaskImage: edgeMask }
                  : undefined
            }
          >
            <div
              ref={fixLayerRef}
              className="absolute inset-0"
              style={{
                visibility: hover.preview ? 'visible' : 'hidden',
                backgroundColor: fixLayerBg,
                opacity: fixLayerOpacity,
                mixBlendMode: fixLayerBlend,
                ...(warpSceneStyle ?? {}),
              }}
            >
              {warpPointsFix ? (
                /* Warp reveal/recolor in points mode — the fix state rendered
                   as the same dot field (matching geometry and phase), so
                   masked tiles match the resting aesthetic 1:1. */
                <canvas
                  ref={revealPointsCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden="true"
                />
              ) : hover.mode === 'warp' && !hover.warpRevealEnabled ? (
                hover.warpRecolorEnabled && c.transparentBg ? (
                  c.alphaLayers.map((layer, i) => {
                    const layerSpread = snapSpread ?? c.alphaSpread * i
                    return (
                      <div
                        key={i}
                        className="absolute inset-0"
                        style={{ opacity: layer.opacity, mixBlendMode: 'screen' }}
                      >
                        <Dithering
                          {...sharedProps}
                          colorBack="#000000"
                          colorFront={hoverFixColor}
                          shape={layer.shape}
                          originX={baseOriginX + layerSpread * 0.8}
                          originY={baseOriginY + layerSpread * 0.6}
                          offsetX={effectiveOffsetX + layerSpread * 2}
                          offsetY={effectiveOffsetY + layerSpread * 1.5}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                    )
                  })
                ) : hover.warpRecolorEnabled ? (
                  <Dithering
                    {...sharedProps}
                    colorFront={hoverFixColor}
                    shape={c.shape}
                    originX={baseOriginX}
                    originY={baseOriginY}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : hover.warpOverlayEnabled ? null : null
              ) : hover.mode === 'overlay' ? null
              : hover.mode === 'recolor' ? (
                /* Recolor: mirror the BASE layers exactly (same props), only
                   swapping the color — so the identical tiles you see at rest
                   change color under the cursor. No reveal-only overrides here. */
                c.transparentBg ? (
                  c.alphaLayers.map((layer, i) => {
                    const spread = snapSpread ?? c.alphaSpread * i
                    return (
                      <div
                        key={i}
                        className="absolute inset-0"
                        style={{ opacity: layer.opacity, mixBlendMode: 'screen' }}
                      >
                        <Dithering
                          {...sharedProps}
                          colorBack="#000000"
                          colorFront={hoverFixColor}
                          shape={layer.shape}
                          originX={baseOriginX + spread * 0.8}
                          originY={baseOriginY + spread * 0.6}
                          offsetX={effectiveOffsetX + spread * 2}
                          offsetY={effectiveOffsetY + spread * 1.5}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                    )
                  })
                ) : (
                  <Dithering
                    {...sharedProps}
                    colorFront={hoverFixColor}
                    shape={c.shape}
                    originX={baseOriginX}
                    originY={baseOriginY}
                    style={{ width: '100%', height: '100%' }}
                  />
                )
              ) : (
                /* Reveal: each hover layer carries its own color + shape + opacity,
                   so the revealed state is as art-directable as the base. When a
                   terminal theme is active, fall back to a single themed color. */
                c.transparentBg ? (
                  hover.hoverLayers.map((layer, i) => {
                    const spread = snapSpread ?? c.alphaSpread * i
                    return (
                      <div
                        key={i}
                        className="absolute inset-0"
                        style={{ opacity: layer.opacity, mixBlendMode: 'screen' }}
                      >
                        <Dithering
                          {...hoverSharedProps}
                          colorBack="#000000"
                          colorFront={activeTheme ? hoverFixColor : layer.color}
                          shape={layer.shape}
                          originX={baseOriginX + spread * 0.8}
                          originY={baseOriginY + spread * 0.6}
                          offsetX={(hover.fixOffsetX ?? effectiveOffsetX) + spread * 2}
                          offsetY={(hover.fixOffsetY ?? effectiveOffsetY) + spread * 1.5}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                    )
                  })
                ) : (
                  <Dithering
                    {...hoverSharedProps}
                    colorFront={hoverFixColor}
                    shape={hover.fixShape}
                    originX={baseOriginX}
                    originY={baseOriginY}
                    style={{ width: '100%', height: '100%' }}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Warp-reveal tooltip — short log fragments below the cursor, styled
          as a readable tooltip. The pool follows orientation: fix at rest →
          reveal shows errors; problem at rest → reveal shows recovery lines.
          Sibling of the shader container so the tile masks never clip it. */}
      {warpReveal && hover.warpErrorText && warp && warp.r > 8 && (() => {
        const snippets = initialState === 'problem' ? warpFixSnippets : warpErrorSnippets
        const accent = hover.hoverLayers[0]?.color ?? hoverFixColor
        const cellW = Math.max(64, gridPitch * 4)
        const idx = Math.floor(tileThreshold(Math.round(warp.px / cellW), Math.round(warp.py / cellW), 7) * snippets.length)
        const lineA = snippets[idx % snippets.length]
        const lineB = snippets[(idx + 3) % snippets.length]
        // Keep the tooltip fully inside the section (overflow-hidden would cut
        // it): clamp horizontally to its estimated half-width and flip above
        // the cursor when there is no room below.
        const estW = Math.max(lineA.length, lineB.length) * 7.6 + 28
        const estH = 2 * 12.5 * 1.55 + 20
        const halfW = estW / 2 + 12
        const left = Math.min(Math.max(warp.px, halfW), Math.max(halfW, containerSize.w - halfW))
        const below = warp.py + warp.r + 16
        const top = Math.max(8, below + estH > containerSize.h - 8
          ? warp.py - warp.r - 16 - estH
          : below)
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
              opacity: Math.min(1, warp.r / Math.max(40, hover.radius * 0.7)),
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

      {/* Bottom content section */}
      <div ref={contentRef} className="relative z-10 mt-auto">
        {edge.mode === 'fade' && !textUnderScene && (
          <div
            className="h-24 pointer-events-none"
            style={{ background: `linear-gradient(to bottom, transparent, ${c.colorBack})` }}
          />
        )}
        <div style={{ backgroundColor: textUnderScene ? 'transparent' : c.colorBack }}>
          <div className="max-w-[1440px] mx-auto w-full px-8 xl:px-16 pb-16 md:pb-20 pt-4 md:pt-8">
            {copy.layout === 'problem' ? (
              <div className="grid grid-cols-4 md:grid-cols-12 items-end" style={{ columnGap: layout.gutter }}>
                <div className="col-span-4 min-w-0" style={{ gridColumn: `span ${layout.headlineCols} / span ${layout.headlineCols}` }}>
                  <h1
                    ref={lockHeadlineRef}
                    className="text-balance break-words [overflow-wrap:anywhere]"
                    style={{
                      color: headlineColor,
                      fontFamily: copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)',
                      fontWeight: copy.headlineWeight ?? 900,
                      fontSize: copy.headlineSize || '64px',
                      letterSpacing: copy.headlineTracking ?? '-0.03em',
                      lineHeight: copy.headlineLeading || '0.95',
                      fontStretch: copy.headlineFont ? undefined : 'var(--font-display-stretch, normal)',
                      ...textReadabilityStyle,
                    }}
                  >
                    {copy.headline}
                  </h1>
                  {copy.sub && (
                    <p ref={lockSubRef} className="mt-6 text-[20px] max-w-[540px] leading-[1.55] break-words [overflow-wrap:anywhere]" style={{ color: sublineColor, ...textReadabilityStyle }}>
                      {copy.sub}
                    </p>
                  )}
                </div>
                <div className="col-span-4 min-w-0 flex flex-col items-start justify-end gap-8 pb-[2px] mt-8 md:mt-0" style={{ gridColumn: `span ${layout.responseCols} / span ${layout.responseCols}` }}>
                  {copy.response && (
                    <div
                      ref={lockResponseWrapRef}
                      className="flex flex-col items-start gap-4"
                      style={baselineNudge.response !== 0 ? { transform: `translateY(${baselineNudge.response}px)` } : undefined}
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
                          fontSize: copy.responseSize || '48px',
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
                    className="inline-flex items-center justify-center px-10 py-4 rounded-full text-[18px] font-semibold tracking-wide transition-colors"
                    style={{
                      backgroundColor: CTA_BG,
                      color: ctaTextColor,
                      ...(baselineNudge.cta !== 0 ? { transform: `translateY(${baselineNudge.cta}px)` } : {}),
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = CTA_BG_HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = CTA_BG)}
                  >
                    {copy.cta}
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 md:grid-cols-12 items-end" style={{ columnGap: layout.gutter }}>
                <div className="col-span-4 min-w-0" style={{ gridColumn: `span ${layout.headlineCols} / span ${layout.headlineCols}` }}>
                  <h1
                    className="text-balance break-words [overflow-wrap:anywhere]"
                    style={{
                      color: headlineColor,
                      fontFamily: copy.headlineFont || 'var(--font-display, Satoshi, sans-serif)',
                      fontWeight: copy.headlineWeight ?? 900,
                      fontSize: copy.headlineSize || '64px',
                      letterSpacing: copy.headlineTracking ?? '-0.03em',
                      lineHeight: copy.headlineLeading || '0.95',
                      fontStretch: copy.headlineFont ? undefined : 'var(--font-display-stretch, normal)',
                      ...textReadabilityStyle,
                    }}
                  >
                    {copy.headline}
                  </h1>
                </div>
                <div className="col-span-4 min-w-0 flex flex-col items-start justify-end gap-8 pb-[2px] mt-8 md:mt-0" style={{ gridColumn: `span ${layout.responseCols} / span ${layout.responseCols}` }}>
                  {copy.sub && (
                    <p className="text-[20px] max-w-[540px] leading-[1.55] break-words [overflow-wrap:anywhere]" style={{ color: sublineColor }}>
                      {copy.sub}
                    </p>
                  )}
                  <a
                    href="#"
                    className="inline-flex items-center justify-center px-10 py-4 rounded-full text-[18px] font-semibold tracking-wide transition-colors"
                    style={{ backgroundColor: CTA_BG, color: ctaTextColor }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = CTA_BG_HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = CTA_BG)}
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
