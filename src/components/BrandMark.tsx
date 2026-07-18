/** Generative brand mark — a 28px Dithering shader that rolls a new formation
 *  every visit.
 *
 *  The lab's whole thesis is "one scene, many formations", so the logo is the
 *  thesis at 28px: same shader, same palettes, different draw each load. The
 *  seed is module-level, so every mount in a page shares one formation (the
 *  header and the favicon can't disagree), and `?logo=<hex>` pins it when a
 *  screenshot needs to be reproducible.
 *
 *  Cost note: this is a real WebGL context. The main window can afford one; the
 *  gallery/breakpoint iframes cannot (they already run the hero's own shader
 *  layers, several frames at a time), so those get `static` — a seeded SVG dot
 *  formation drawn from the same generator. Same vocabulary, no GL. */
import { useState } from 'react'
import { Dithering } from '@paper-design/shaders-react'

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

/** mulberry32 — small, fast, good enough for picking a look. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A visit's seed: `?logo=8f3a` pins it, otherwise it's fresh per page load. */
function readSeed(): number {
  const pinned = new URLSearchParams(window.location.search).get('logo')
  if (pinned) {
    const parsed = parseInt(pinned, 16)
    if (Number.isFinite(parsed)) return parsed >>> 0
  }
  return (Math.random() * 0xffffffff) >>> 0
}

/** Short hex label for the current formation — shown in the tooltip so a look
 *  you like can be pinned back via `?logo=`. */
function seedLabel(seed: number): string {
  return (seed >>> 16).toString(16).padStart(4, '0')
}

// ─── Formation ────────────────────────────────────────────────────────────────

/** The hero's two color families, so the mark reads as the same system as the
 *  scene behind it rather than a stray accent. */
const PALETTES = [
  { back: '#08150F', colors: ['#2DD4A8', '#3ECF8E', '#1A8A70'] },
  { back: '#170811', colors: ['#E6307A', '#FF6B2B', '#FF3366'] },
] as const

/** Shapes that still read as *structure* at 28px. Checked by rolling ~40 seeds
 *  into a contact sheet: `sphere`/`ripple`/`dots`/`wave` all collapse to a flat
 *  wash once the viewport is this small — a solid block, not a mark. These three
 *  keep visible grain at every scale in the range below. */
const SHAPES = ['simplex', 'warp', 'swirl'] as const

/** `random` is excluded — at this size it's noise, not a mark. */
const TYPES = ['2x2', '4x4', '8x8'] as const

interface Formation {
  seed: number
  shape: (typeof SHAPES)[number]
  type: (typeof TYPES)[number]
  colorBack: string
  colorFront: string
  accent: string
  size: number
  scale: number
  rotation: number
  offsetX: number
  offsetY: number
  speed: number
  frame: number
}

function makeFormation(seed: number, reducedMotion: boolean): Formation {
  const r = rng(seed)
  const pal = PALETTES[Math.floor(r() * PALETTES.length)]
  const colors = pal.colors
  const front = colors[Math.floor(r() * colors.length)]
  const accent = colors[Math.floor(r() * colors.length)]
  return {
    seed,
    shape: SHAPES[Math.floor(r() * SHAPES.length)],
    type: TYPES[Math.floor(r() * TYPES.length)],
    colorBack: pal.back,
    colorFront: front,
    accent,
    // Dot size floor of 2: at 1.5-ish the field goes faint enough to read as an
    // empty box at 28px, which is a broken-looking logo.
    size: 2 + r() * 1,
    // Floor at 0.6: below that the field zooms past the 28px frame and renders
    // as one flat color. Ceiling at 1.3 keeps the grain from turning to noise.
    scale: 0.6 + r() * 0.7,
    rotation: Math.floor(r() * 360),
    // Held at origin. Offsetting can park the 28px frame on a null patch of the
    // field (notably with `warp`), which renders as an empty box; rotation and
    // scale already give the formations plenty of spread.
    offsetX: 0,
    offsetY: 0,
    // Faster than the hero's 0.12: at 28px there are only a few dozen visible
    // cells, so slow motion reads as a still image. Reduced motion keeps the
    // generative payoff (a unique formation) but freezes it at a random frame.
    speed: reducedMotion ? 0 : 0.22 + r() * 0.18,
    frame: reducedMotion ? Math.floor(r() * 10000) : 0,
  }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** This page load's formation. Module-level so header + favicon agree. */
export const visitFormation = makeFormation(readSeed(), prefersReducedMotion())

// ─── Static fallback ──────────────────────────────────────────────────────────

/** Seeded 5×5 dot grid — the mark's vocabulary without a GL context. Used in
 *  preview iframes and as the favicon. */
function staticMarkSvg(f: Formation, px = 28): string {
  const r = rng(f.seed ^ 0x9e3779b9)
  const cells = 5
  const pitch = px / cells
  let dots = ''
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const v = r()
      if (v < 0.28) continue
      const d = pitch * (0.28 + v * 0.5)
      const cx = x * pitch + pitch / 2
      const cy = y * pitch + pitch / 2
      const fill = v > 0.78 ? f.accent : f.colorFront
      dots += `<rect x="${(cx - d / 2).toFixed(2)}" y="${(cy - d / 2).toFixed(2)}" width="${d.toFixed(2)}" height="${d.toFixed(2)}" rx="${(d / 2.6).toFixed(2)}" fill="${fill}"/>`
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}"><rect width="${px}" height="${px}" rx="${(px / 4).toFixed(2)}" fill="${f.colorBack}"/>${dots}</svg>`
}

/** The static mark as a data URI — used for the favicon and the no-GL fallback,
 *  which keeps the SVG out of innerHTML entirely. */
export function staticMarkDataUri(f: Formation, px = 28): string {
  return `data:image/svg+xml,${encodeURIComponent(staticMarkSvg(f, px))}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrandMark({
  size = 28,
  static: isStatic = false,
  interactive = true,
}: {
  size?: number
  /** Skip WebGL — render the seeded SVG formation only. */
  static?: boolean
  /** Click to roll a new formation. */
  interactive?: boolean
}) {
  const [formation, setFormation] = useState(visitFormation)

  const mark = (
    <span
      className="relative block overflow-hidden rounded-lg border border-t-border-strong"
      // `isolation` confines the shader's screen blend to this box. Without it
      // the canvas blends against the page — which on a light header washes the
      // whole mark out to nothing.
      style={{ width: size, height: size, background: formation.colorBack, isolation: 'isolate' }}
    >
      {/* The floor — a seeded dot formation under the live shader.
          The dither field oscillates through *empty* as it animates, so on its
          own the mark blinks out of existence a few seconds per cycle. Tried a
          flat tint instead so the shader alone would be the mark; at 28px the
          field is sparse often enough that it degraded to a muddy colored box.
          The dot formation holds the shape, and the shader (running faster than
          the hero's, see `speed`) screen-blends live grain across it. Slightly
          held back so the motion on top stays legible. */}
      <span
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url("${staticMarkDataUri(formation, size)}")`,
          opacity: isStatic ? 1 : 0.72,
        }}
      />
      {!isStatic && (
        <Dithering
          // Black back + screen blend = the empty parts of the field composite
          // away, letting the underlay show through. Same trick the hero uses
          // to stack its alpha layers.
          colorBack="#000000"
          colorFront={formation.colorFront}
          shape={formation.shape}
          type={formation.type}
          size={formation.size}
          scale={formation.scale}
          rotation={formation.rotation}
          offsetX={formation.offsetX}
          offsetY={formation.offsetY}
          speed={formation.speed}
          frame={formation.frame}
          fit="cover"
          worldWidth={1}
          worldHeight={1}
          maxPixelCount={size * size * 4}
          minPixelRatio={1}
          style={{ width: '100%', height: '100%', display: 'block', mixBlendMode: 'screen', position: 'relative' }}
        />
      )}
      {/* Inner hairline — keeps the mark crisp against a light header. */}
      <span className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10" />
    </span>
  )

  if (!interactive) return mark

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setFormation(makeFormation((Math.random() * 0xffffffff) >>> 0, prefersReducedMotion()))
      }}
      title={`Formation ${seedLabel(formation.seed)} — ${formation.shape}/${formation.type}. Click to reroll.`}
      aria-label={`Reroll the generative logo. Current formation ${seedLabel(formation.seed)}.`}
      className="block cursor-pointer border-0 bg-transparent p-0 leading-none transition-transform duration-200 hover:scale-105 active:scale-95"
    >
      {mark}
    </button>
  )
}
