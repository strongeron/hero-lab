/**
 * DitherBackground — an animated dither field for hero sections.
 *
 * Copy this one file into your project. Its only dependency is
 * `@paper-design/shaders-react` (tested with 0.0.71) and React 19.
 * It loads no fonts and no CSS: it fills its positioned parent and the text
 * you put next to it keeps your page's own font.
 *
 * Two renderers:
 * - grid on  → a 2D canvas draws whole tiles (flat colour or sized dots).
 * - grid off → Paper's WebGL <Dithering>, one canvas per colour layer,
 *              screen-blended.
 *
 * Motion never goes through React state. One rAF loop writes Paper uniforms
 * through refs (or redraws the 2D canvas) at 24 fps, so the page around the
 * background does not re-render per frame. The loop stops while the
 * background is off screen and when the user asks for reduced motion.
 */
import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from 'react'
import { Dithering } from '@paper-design/shaders-react'

/* ─── Public types ─── */

export type DitherShape = 'simplex' | 'warp' | 'dots' | 'wave' | 'ripple' | 'swirl' | 'sphere'

export interface DitherLayer {
  /** Hex colour (#rgb or #rrggbb). */
  color: string
  /** 0..1. A layer at 0 mounts nothing. */
  opacity: number
  /** Paper pattern for this layer (WebGL renderer only). */
  shape: DitherShape
}

/** A motion recipe. Pass any subset; missing fields are 0. */
export interface DitherScene {
  /** Paper's own pattern speed. */
  speed: number
  /** How fast colour moves between layers (cycles/s). */
  colorCycleSpeed: number
  /** Pan in offset units/s. */
  driftX: number
  driftY: number
  /** deg/s */
  rotationDrift: number
  /** Scale breathing amplitude and Hz. */
  pulseAmount: number
  pulseSpeed: number
  /** Back-and-forth scan. 0 = off (drift pans instead). */
  scanAmplitude: number
  scanSpeed: number
  scanAngle: number
  /** Origin sweep. 0 = off. */
  waveAmplitude: number
  waveSpeed: number
  waveAngle: number
  /** Grid gap breathing in px, and its Hz. */
  gapPulse: number
  gapPulseSpeed: number
  /** Non-repeating motion on top, so the loop never reads as a loop. */
  loopBreak: 'none' | 'rotate' | 'drift' | 'orbit' | 'wander'
  loopBreakAmount: number
  /** Points renderer: dot size spread (0..1), speed (Hz), noise scale. */
  tileSizeSpread: number
  tileSizeSpeed: number
  tileSizeNoise: number
}

export interface DitherGrid {
  /** Tile pitch in px. */
  size?: number
  /** Gap between tiles in px. */
  gap?: number
  /** Corner radius in px; half the tile makes circles. */
  radius?: number
}

export interface DitherReveal {
  /** Layers shown under the cursor. */
  layers?: DitherLayer[]
  /** Reveal radius in px. */
  radius?: number
}

export interface DitherBackgroundProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Colour layers, screen-blended over `background`. */
  layers?: DitherLayer[]
  /** Page colour behind the dots. */
  background?: string
  /** A preset name or your own recipe. */
  scene?: DitherSceneId | Partial<DitherScene>
  /** Pixel grid. `true` uses the defaults, `false` shows the free WebGL dither. */
  grid?: boolean | DitherGrid
  /** Grid only: flat tiles ('color') or dots sized by the field ('points'). */
  renderer?: 'color' | 'points'
  /** Hover reveal. Listens on the parent element, so copy laid over the
   *  background does not block it. */
  reveal?: boolean | DitherReveal
  /** Freeze motion. Reduced-motion users get this automatically. */
  paused?: boolean
}

/* ─── Defaults ─── */

export const problemLayers: DitherLayer[] = [
  { color: '#E6307A', opacity: 0.9, shape: 'simplex' },
  { color: '#FF6B2B', opacity: 0.7, shape: 'warp' },
  { color: '#FF3366', opacity: 0.55, shape: 'dots' },
]

export const fixLayers: DitherLayer[] = [
  { color: '#2DD4A8', opacity: 0.9, shape: 'swirl' },
  { color: '#3ECF8E', opacity: 0.7, shape: 'wave' },
  { color: '#1A8A70', opacity: 0.55, shape: 'dots' },
]

const ZERO_SCENE: DitherScene = {
  speed: 0, colorCycleSpeed: 0, driftX: 0, driftY: 0, rotationDrift: 0,
  pulseAmount: 0, pulseSpeed: 0, scanAmplitude: 0, scanSpeed: 0, scanAngle: 0,
  waveAmplitude: 0, waveSpeed: 0, waveAngle: 0, gapPulse: 0, gapPulseSpeed: 0,
  loopBreak: 'none', loopBreakAmount: 0, tileSizeSpread: 0, tileSizeSpeed: 0, tileSizeNoise: 1,
}

/** The five scenes that look different from each other (Hero Lab's Layers view). */
export const ditherScenes = {
  'gentle-drift': {
    speed: 0.1, colorCycleSpeed: 0.15, driftX: 0.035, driftY: 0.05, pulseAmount: 0.02, pulseSpeed: 0.12,
    gapPulse: 1.5, gapPulseSpeed: 0.08, loopBreak: 'drift', loopBreakAmount: 0.5,
    tileSizeSpread: 0.42, tileSizeSpeed: 0.08, tileSizeNoise: 1.6,
  },
  'orbit': {
    speed: 0.18, colorCycleSpeed: 0.32, driftX: 0.025, driftY: 0.018, rotationDrift: 4, pulseAmount: 0.028, pulseSpeed: 0.16,
    gapPulse: 3, gapPulseSpeed: 0.14, loopBreak: 'orbit', loopBreakAmount: 0.5,
    tileSizeSpread: 0.52, tileSizeSpeed: 0.1, tileSizeNoise: 1.4,
  },
  'living-texture': {
    speed: 0.09, colorCycleSpeed: 0.3, rotationDrift: 0.8, pulseAmount: 0.04, pulseSpeed: 0.12,
    gapPulse: 5, gapPulseSpeed: 0.15, loopBreak: 'rotate', loopBreakAmount: 0.5,
    tileSizeSpread: 0.72, tileSizeSpeed: 0.13, tileSizeNoise: 0.9,
  },
  'radar-scan': {
    speed: 0.16, colorCycleSpeed: 0.22, pulseAmount: 0.02, pulseSpeed: 0.16,
    scanAmplitude: 0.6, scanSpeed: 0.13, waveAmplitude: 0.18, waveSpeed: 0.16,
    gapPulse: 3, gapPulseSpeed: 0.14, loopBreak: 'wander', loopBreakAmount: 0.5,
    tileSizeSpread: 0.65, tileSizeSpeed: 0.16, tileSizeNoise: 1.2,
  },
  'still': {
    speed: 0.025, pulseAmount: 0.006, pulseSpeed: 0.06, gapPulse: 0.25, gapPulseSpeed: 0.04,
    tileSizeSpread: 0.28, tileSizeSpeed: 0.04, tileSizeNoise: 2,
  },
} satisfies Record<string, Partial<DitherScene>>

export type DitherSceneId = keyof typeof ditherScenes

/* Shader look. Edit these in your copy if you want a different texture. */
const SHADER = { type: '8x8', size: 16, fit: 'cover', scale: 0.21, rotation: 8, layerSpread: 0.04 } as const
const DEFAULT_GRID: Required<DitherGrid> = { size: 24, gap: 6, radius: 12 }
const DEFAULT_REVEAL_RADIUS = 100
/** Motion writes per second. Uniform writes each cost Paper one draw. */
const PAINT_FPS = 24
const FLOW_CELLS = 6

/* ─── Component ─── */

export function DitherBackground({
  layers = problemLayers,
  background = '#0A1714',
  scene = 'gentle-drift',
  grid = true,
  renderer = 'color',
  reveal = false,
  paused = false,
  className,
  style,
  ref,
  ...rest
}: DitherBackgroundProps) {
  const reducedMotion = usePrefersReducedMotion()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const inView = useInView(hostRef)

  const motion: DitherScene = { ...ZERO_SCENE, ...(typeof scene === 'string' ? ditherScenes[scene] : scene) }
  const gridCfg = grid === false ? null : { ...DEFAULT_GRID, ...(grid === true ? {} : grid) }
  const revealCfg = reveal === false ? null : {
    layers: (reveal === true ? undefined : reveal.layers) ?? fixLayers,
    radius: (reveal === true ? undefined : reveal.radius) ?? DEFAULT_REVEAL_RADIUS,
  }
  const playing = !paused && !reducedMotion && inView

  // Everything the loops read lives in refs, so a parent re-render with new
  // props updates the next frame without restarting the loop.
  const cfg = useRef({ motion, layers, gridCfg, renderer, revealCfg, background })
  cfg.current = { motion, layers, gridCfg, renderer, revealCfg, background }

  const drift = useRef<Drift>({ ...ZERO_DRIFT })
  const fieldT = useRef(0)
  const size = useRef({ w: 0, h: 0 })
  const hover = useRef({ x: 0, y: 0, r: 0, target: 0, active: false })

  const baseCanvas = useRef<HTMLCanvasElement | null>(null)
  const revealCanvas = useRef<HTMLCanvasElement | null>(null)
  const revealLayer = useRef<HTMLDivElement | null>(null)
  // Stable per-index ref callbacks: an inline ref would break Paper's memo,
  // re-render <Dithering> and reset its uniforms to the props for a frame.
  const [baseMounts, baseMountRef] = useSlots<PaperElement>()
  const [revealMounts, revealMountRef] = useSlots<PaperElement>()
  const [baseWrappers, baseWrapperRef] = useSlots<HTMLDivElement>()
  const playingRef = useRef(playing)
  playingRef.current = playing
  // The WebGL reveal stack holds one context per layer; mount it on first
  // hover and drop it 2 s after the pointer leaves (browsers cap ~16 contexts).
  const [revealMounted, setRevealMounted] = useState(false)

  const paint = useRef<(revealOnly?: boolean) => void>(() => {})
  paint.current = (revealOnly = false) => {
    const { motion: m, layers: ls, gridCfg: g, renderer: rd, revealCfg: rv } = cfg.current
    const d = drift.current
    const { w, h } = size.current
    if (!w || !h) return
    if (g) {
      const points = rd === 'points'
      const pitch = Math.max(2, Math.round(g.size))
      const gap = points ? g.gap : Math.max(0, Math.min(pitch - 1, g.gap + d.gap))
      const geo: GridGeometry = { pitch, gap, radius: g.radius, alignX: mod(w / 2, pitch), alignY: mod(h / 2, pitch) }
      const draw = (canvas: HTMLCanvasElement | null, drawLayers: DitherLayer[]) => {
        if (!canvas) return
        drawTiles(canvas, w, h, geo, {
          t: fieldT.current,
          spread: points ? m.tileSizeSpread : 0,
          mapScale: points ? m.tileSizeNoise * (1 + d.scale) : SHADER.scale + d.scale,
          flowX: (d.offsetX + d.loopX + d.waveOriginX) * FLOW_CELLS,
          flowY: (d.offsetY + d.loopY + d.waveOriginY) * FLOW_CELLS,
          colorPhase: d.colorPhase,
          rotation: points ? d.rotation : SHADER.rotation + d.rotation,
        }, drawLayers)
      }
      if (!revealOnly) draw(baseCanvas.current, ls)
      if (rv && hover.current.r > 0) draw(revealCanvas.current, rv.layers)
      return
    }
    // WebGL: write the moving uniforms straight into each Paper mount.
    const write = (mounts: (PaperElement | null)[]) => mounts.forEach((el, i) => {
      const spread = SHADER.layerSpread * i
      el?.paperShaderMount?.setUniforms({
        u_offsetX: d.offsetX + d.loopX + spread * 2,
        u_offsetY: d.offsetY + d.loopY + spread * 1.5,
        u_originX: 0.5 + d.waveOriginX + spread * 0.8,
        u_originY: 0.5 + d.waveOriginY + spread * 0.6,
        u_rotation: SHADER.rotation + d.rotation,
        u_scale: SHADER.scale + d.scale,
      })
    })
    if (!revealOnly) write(baseMounts.current)
    if (hover.current.r > 0) write(revealMounts.current)
  }

  // Size: measured once per resize, read by the loops.
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      size.current = { w: el.clientWidth, h: el.clientHeight }
      paint.current()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Frozen field: redraw once per render so prop changes still show.
  useEffect(() => {
    if (!playingRef.current) paint.current()
  })

  // Motion loop. Reruns only when play state or the renderer changes.
  const isGrid = gridCfg != null
  useEffect(() => {
    paint.current()
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastPaint = 0
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const { motion: m, layers: ls, gridCfg: g, renderer: rd } = cfg.current
      stepDrift(drift.current, m, dt, now / 1000)
      fieldT.current += dt * (g && rd === 'points' ? m.tileSizeSpeed : fieldRate(m))
      // Colour shimmer on the WebGL layers: opacity only, every frame (cheap).
      if (!g && m.colorCycleSpeed > 0) shimmer(baseWrappers.current, ls, drift.current.colorPhase)
      if (now - lastPaint >= 1000 / PAINT_FPS) {
        lastPaint = now
        paint.current()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [playing, isGrid])

  // Hover reveal: the pointer moves a clip on the reveal layer. No React
  // state per move — only mount/unmount of the WebGL reveal stack.
  const hasReveal = revealCfg != null
  useEffect(() => {
    if (!hasReveal) return
    const host = hostRef.current
    const target = host?.parentElement
    if (!host || !target) return
    let raf = 0
    let release = 0
    const step = () => {
      raf = 0
      const hv = hover.current
      const { gridCfg: g } = cfg.current
      hv.r += (hv.target - hv.r) * 0.08
      if (hv.target === 0 && hv.r < 1) hv.r = 0
      const layer = revealLayer.current
      if (layer) {
        const { w, h } = size.current
        const opening = hv.r > 0 && layer.style.visibility !== 'visible'
        if (opening || !playingRef.current) paint.current(true)
        if (hv.r <= 0) {
          layer.style.visibility = 'hidden'
        } else if (g) {
          // Whole tiles only: each tile is fully in or out of the circle.
          const pitch = Math.max(2, Math.round(g.size))
          const r = Math.round(hv.r / pitch) * pitch
          layer.style.clipPath = wholeTileCircle(hv.x, hv.y, r, pitch, mod(w / 2, pitch), mod(h / 2, pitch), w, h)
          layer.style.visibility = 'visible'
        } else {
          const mask = `radial-gradient(circle ${hv.r}px at ${hv.x}px ${hv.y}px, #000 100%, transparent 100%)`
          layer.style.maskImage = mask
          layer.style.setProperty('-webkit-mask-image', mask)
          layer.style.visibility = 'visible'
        }
      }
      if (hv.active || hv.r > 0) raf = requestAnimationFrame(step)
    }
    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      const hv = hover.current
      hv.x = e.clientX - rect.left
      hv.y = e.clientY - rect.top
      hv.target = cfg.current.revealCfg?.radius ?? 0
      hv.active = true
      clearTimeout(release)
      setRevealMounted(true)
      if (!raf) raf = requestAnimationFrame(step)
    }
    const onLeave = () => {
      hover.current.target = 0
      hover.current.active = false
      release = window.setTimeout(() => setRevealMounted(false), 2000)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(release)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerleave', onLeave)
    }
  }, [hasReveal])

  // Initial uniforms for Paper (motion values are overwritten by the loop).
  const speed = playing ? motion.speed : 0
  const shaderProps = {
    colorBack: '#000000',
    type: SHADER.type,
    size: SHADER.size,
    fit: SHADER.fit,
    scale: SHADER.scale,
    rotation: SHADER.rotation,
    speed,
    maxPixelCount: 500_000,
    minPixelRatio: 1,
    style: FILL,
  } as const
  const glStack = (stack: DitherLayer[], mountRef: SlotRef<PaperElement>, wrapperRef?: SlotRef<HTMLDivElement>) =>
    stack.map((layer, i) => layer.opacity > 0 && (
      <div
        key={i}
        ref={wrapperRef?.(i)}
        style={{ ...FILL, opacity: layer.opacity, mixBlendMode: 'screen' }}
      >
        <Dithering
          {...shaderProps}
          ref={mountRef(i)}
          colorFront={layer.color}
          shape={layer.shape}
        />
      </div>
    ))

  return (
    <div
      {...rest}
      ref={(el) => {
        hostRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', backgroundColor: background, ...style }}
    >
      {gridCfg ? <canvas ref={baseCanvas} style={FILL} /> : glStack(layers, baseMountRef, baseWrapperRef)}
      {revealCfg && (
        <div ref={revealLayer} style={{ ...FILL, visibility: 'hidden', backgroundColor: background }}>
          {gridCfg
            ? <canvas ref={revealCanvas} style={FILL} />
            : revealMounted && glStack(revealCfg.layers, revealMountRef)}
        </div>
      )}
    </div>
  )
}

export default DitherBackground

/* ─── Hooks ─── */

type SlotRef<T> = (i: number) => (el: T | null) => void

function useSlots<T>(): [React.RefObject<(T | null)[]>, SlotRef<T>] {
  const items = useRef<(T | null)[]>([])
  const fns = useRef<((el: T | null) => void)[]>([])
  return [items, (i) => (fns.current[i] ??= (el) => { items.current[i] = el })]
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return inView
}

/* ─── Motion ─── */

interface PaperElement extends HTMLElement {
  paperShaderMount?: { setUniforms: (u: Record<string, number>) => void }
}

interface Drift {
  offsetX: number; offsetY: number; rotation: number; scale: number; colorPhase: number
  waveOriginX: number; waveOriginY: number; gap: number; loopX: number; loopY: number
}

const ZERO_DRIFT: Drift = { offsetX: 0, offsetY: 0, rotation: 0, scale: 0, colorPhase: 0, waveOriginX: 0, waveOriginY: 0, gap: 0, loopX: 0, loopY: 0 }

const wrap = (v: number) => (v > 2 ? v - 4 : v < -2 ? v + 4 : v)

/** Same integration as Hero Lab's DitherHero drift loop. */
function stepDrift(d: Drift, m: DitherScene, dt: number, t: number) {
  if (m.scanAmplitude > 0) {
    const a = m.scanAngle * Math.PI / 180
    const v = m.scanAmplitude * Math.sin(t * m.scanSpeed * Math.PI * 2)
    d.offsetX = v * Math.cos(a)
    d.offsetY = v * Math.sin(a)
  } else {
    d.offsetX = wrap(d.offsetX + m.driftX * dt)
    d.offsetY = wrap(d.offsetY + m.driftY * dt)
  }
  if (m.waveAmplitude > 0) {
    const a = m.waveAngle * Math.PI / 180
    const v = m.waveAmplitude * Math.sin(t * m.waveSpeed * Math.PI * 2)
    d.waveOriginX = v * Math.cos(a)
    d.waveOriginY = v * Math.sin(a)
  }
  d.rotation += m.rotationDrift * dt
  d.scale = m.pulseAmount * Math.sin(t * m.pulseSpeed * Math.PI * 2)
  d.colorPhase += m.colorCycleSpeed * dt
  d.gap = m.gapPulse * (0.5 + 0.5 * Math.sin(t * m.gapPulseSpeed * Math.PI * 2))

  const amt = m.loopBreak === 'none' ? 0 : m.loopBreakAmount
  const PAN = 0.06
  if (m.loopBreak === 'rotate' || m.loopBreak === 'orbit') d.rotation += amt * 8 * dt
  if (m.loopBreak === 'drift' || m.loopBreak === 'orbit') d.loopX = wrap(d.loopX + amt * PAN * dt)
  if (m.loopBreak === 'wander') {
    const a = t * 0.06
    d.loopX = wrap(d.loopX + Math.cos(a) * amt * PAN * dt)
    d.loopY = wrap(d.loopY + Math.sin(a) * amt * PAN * dt)
    d.rotation += amt * 2.5 * dt
  }
}

/** Snapped colour tiles advance with the fastest motion in the scene. */
function fieldRate(m: DitherScene) {
  return Math.max(
    m.speed,
    m.colorCycleSpeed * 0.25,
    Math.abs(m.driftX) + Math.abs(m.driftY),
    Math.abs(m.rotationDrift) * 0.01,
    m.pulseAmount > 0 ? m.pulseSpeed : 0,
    m.waveAmplitude > 0 ? m.waveSpeed : 0,
  )
}

/** Layers trade emphasis while their summed opacity stays as authored, so
 *  the field never brightens and dims once per cycle. */
function shimmer(wrappers: (HTMLDivElement | null)[], layers: DitherLayer[], phase: number) {
  const total = layers.reduce((s, l) => s + l.opacity, 0)
  const animated = layers.map((l, i) => l.opacity * (1 + 0.1 * Math.sin(phase * Math.PI * 2 + (i / layers.length) * Math.PI * 2)))
  const sum = animated.reduce((s, v) => s + v, 0)
  const k = sum > 0 ? total / sum : 1
  animated.forEach((v, i) => {
    const el = wrappers[i]
    if (el) el.style.opacity = String(Math.min(1, v * k))
  })
}

/* ─── Tile renderer (2D canvas) ─── */

interface GridGeometry { pitch: number; gap: number; radius: number; alignX: number; alignY: number }

interface FieldSample {
  t: number; spread: number; mapScale: number
  flowX: number; flowY: number; colorPhase: number; rotation: number
}

const FILL: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

function drawTiles(canvas: HTMLCanvasElement, w: number, h: number, g: GridGeometry, f: FieldSample, layers: DitherLayer[]) {
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  const cw = Math.round(w * dpr)
  const ch = Math.round(h * dpr)
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw
    canvas.height = ch
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const src = layers.filter((l) => l.opacity > 0)
  if (!src.length) return

  const { pitch, alignX, alignY } = g
  const gap = Math.max(0, Math.min(g.gap, pitch - 1))
  const maxPiece = pitch - gap
  const spread = Math.max(0, Math.min(1, f.spread)) * 0.65
  const minScale = spread <= 0 ? 1 : Math.max(gap / Math.max(1, maxPiece), 1 - spread)
  const cos = Math.cos(f.rotation * Math.PI / 180)
  const sin = Math.sin(f.rotation * Math.PI / 180)
  const colLo = Math.floor(-alignX / pitch) - 1
  const colHi = Math.ceil((w - alignX) / pitch) + 1
  const rowLo = Math.floor(-alignY / pitch) - 1
  const rowHi = Math.ceil((h - alignY) / pitch) + 1

  for (let row = rowLo; row <= rowHi; row++) {
    const y = alignY + row * pitch
    for (let col = colLo; col <= colHi; col++) {
      const x = alignX + col * pitch
      const sc = col * cos - row * sin
      const sr = col * sin + row * cos
      const sizeValue = tileSize(sc, sr, f.t, f.mapScale, f.flowX, f.flowY)
      const alpha = tileAlpha(sc, sr, f.t, f.mapScale, f.flowX, f.flowY)
      const piece = maxPiece * (minScale + (1 - minScale) * sizeValue)
      if (piece < 0.5) continue
      const inset = (pitch - piece) / 2
      const radius = Math.max(0, Math.min(Math.round(g.radius), piece / 2))
      // Blend between neighbouring layers as the phase moves: a hard layer
      // index would flash at each threshold.
      const pos = mod(hash(col, row, 701) * src.length + f.colorPhase * src.length, src.length)
      const i = Math.floor(pos)
      const a = src[i] ?? src[0]
      const b = src[(i + 1) % src.length] ?? a
      const k = smooth(pos - i)
      ctx.globalAlpha = Math.max(0, Math.min(0.95, (0.28 + alpha * 0.72) * (a.opacity + (b.opacity - a.opacity) * k)))
      ctx.fillStyle = mixColor(a.color, b.color, k)
      if (radius < 0.5) ctx.fillRect(x + inset, y + inset, piece, piece)
      else {
        ctx.beginPath()
        ctx.roundRect(x + inset, y + inset, piece, piece, radius)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1
}

function tileSize(col: number, row: number, t: number, scale: number, fx: number, fy: number) {
  const c = col + fx
  const r = row + fy
  const s = 0.095 / Math.max(0.4, Math.min(3, scale))
  const organic = fbm(c * s, r * s, t * 0.8, 2401)
  const wave = 0.5 + 0.5 * Math.sin(c * 0.33 + r * 0.21 + t * Math.PI * 2 * 0.55)
  return 0.18 + 0.82 * smooth(Math.max(0, Math.min(1, organic * 0.72 + wave * 0.28)))
}

function tileAlpha(col: number, row: number, t: number, scale: number, fx: number, fy: number) {
  const c = col + fx
  const r = row + fy
  const s = 0.08 / Math.max(0.4, Math.min(3, scale))
  const n = fbm(c * s + 19, r * s - 7, t * 0.55, 3119)
  const wave = 0.5 + 0.5 * Math.sin(c * 0.16 - r * 0.27 + t * Math.PI * 1.2)
  return Math.max(0, Math.min(1, n * 0.65 + wave * 0.35))
}

/** Staircased circle of whole tiles as a clip-path polygon (px). */
function wholeTileCircle(px: number, py: number, r: number, pitch: number, ax: number, ay: number, cw: number, ch: number) {
  const EMPTY = 'polygon(0 0, 0 0, 0 0)'
  if (r < pitch * 0.5) return EMPTY
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v))
  const right: string[] = []
  const left: string[] = []
  for (let row = Math.floor((py - r - ay) / pitch); row <= Math.ceil((py + r - ay) / pitch); row++) {
    const dy = ay + (row + 0.5) * pitch - py
    if (Math.abs(dy) > r) continue
    const dx = Math.sqrt(r * r - dy * dy)
    const lo = Math.ceil((px - dx - ax) / pitch - 0.5)
    const hi = Math.floor((px + dx - ax) / pitch - 0.5)
    if (hi < lo) continue
    const xL = clamp(ax + lo * pitch, cw)
    const xR = clamp(ax + (hi + 1) * pitch, cw)
    const yT = clamp(ay + row * pitch, ch)
    const yB = clamp(ay + (row + 1) * pitch, ch)
    right.push(`${xR}px ${yT}px`, `${xR}px ${yB}px`)
    left.unshift(`${xL}px ${yB}px`, `${xL}px ${yT}px`)
  }
  return right.length ? `polygon(${right.concat(left).join(', ')})` : EMPTY
}

/* ─── Small maths ─── */

const mod = (v: number, b: number) => ((v % b) + b) % b
const smooth = (t: number) => t * t * (3 - 2 * t)

function hash(x: number, y: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// ponytail: same fade as Hero Lab (`+ 1`) so both render the same field. A true
// quintic fade is `+ 10`; switch both together if the look is signed off.
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 1)

function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = fade(x - ix)
  const fy = fade(y - iy)
  const a = hash(ix, iy, seed)
  const b = hash(ix + 1, iy, seed)
  const c = hash(ix, iy + 1, seed)
  const d = hash(ix + 1, iy + 1, seed)
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy
}

function fbm(x: number, y: number, t: number, seed: number) {
  return noise(x + t * 0.4, y + t * 0.25, seed) * 0.55
    + noise(x * 2.1 + t * 0.7, y * 2.1, seed + 1) * 0.3
    + noise(x * 4.3, y * 4.3 + t * 0.35, seed + 2) * 0.15
}

function mixColor(a: string, b: string, t: number) {
  const ca = rgb(a)
  const cb = rgb(b)
  if (!ca || !cb) return t < 0.5 ? a : b
  const m = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${m(ca[0], cb[0])} ${m(ca[1], cb[1])} ${m(ca[2], cb[2])})`
}

function rgb(color: string): [number, number, number] | null {
  const raw = color.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}
