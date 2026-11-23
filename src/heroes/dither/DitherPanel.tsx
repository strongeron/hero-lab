import { useState, type ReactNode } from 'react'
import {
  useDitherStore,
  setHoverConfig,
  setInitialState,
  setAlphaLayer,
  setAnimationConfig,
  setShaderConfig,
  setCopyVariant,
  setLayoutConfig,
  setButtonConfig,
  setComposition,
  setEdgeConfig,
  setPalette,
  setTypePair,
  setGrain,
  setGap,
  applyHeroTemplate,
  batchDitherUpdates,
  heroTemplates,
  copyVariants,
  copyVariantIds,
  palettes,
  paletteIds,
  typePairs,
  typePairIds,
  grainIds,
  grainPitch,
  grainDot,
  gapIds,
  gapFor,
  gridPitch,
  warpFeels,
  warpModeIds,
  warpModeLabel,
  warpModeTitle,
  warpFeelIds,
  resolveCopy,
  heroCtaColors,
  speedStops,
  speedStop,
  problemLayers,
  fixLayers,
  clearanceStops,
  rimStops,
  rimMotionStops,
  type CompositionId,
  type DitheringShape,
  type TypePairId,
} from './ditherStore'
import Segmented from '../../lab/ui/Segmented'
import SliderRow from '../../lab/ui/SliderRow'
import SectionLabel from '../../lab/ui/SectionLabel'
import Toggle from '../../lab/ui/Toggle'
import LivePreview from '../../lab/ui/LivePreview'
import { pickTile } from '../../lab/ui/pickTile'
import { boundingRect, bridgeTextRects, centredCopyLines, drawClearance, drawCopyBars, drawField, drawHero, drawPointField, previewWarp, type SketchLayer } from './panelSketch'

/* The Design Panel offers curated choices only: every option keeps the resting
   state and the hover intact. Renderer, edge, scene and hover mode belong to
   the templates (docs/architecture/2026-11-21-state-machines.md); free colour,
   size and font values are replaced by checked presets in ditherStore. */

const SHAPES: DitheringShape[] = ['simplex', 'warp', 'dots', 'wave', 'ripple', 'swirl', 'sphere']
const GRAIN_LABELS = { fine: 'Fine', medium: 'Medium', coarse: 'Coarse', chunky: 'Chunky' }
/** The hero size the Shape previews stand for (CSS px). */
const HERO = { w: 1440, h: 900 }
const GAP_LABELS = { none: 'No gap', tight: 'Tight', open: 'Open' }

const hint = 'text-lab-xs leading-snug text-lab-fg-subtle'
/** Header actions sit in the same track as a `box` Segmented, so they read as
 *  one control group, not three loose pills. Not Segmented itself: these are
 *  commands, not a choice, so they carry no aria-pressed. */
const actionTrack = 'flex items-center rounded-lg p-0.5 gap-0.5 bg-lab-fill border border-lab-border'
const action =
  'min-h-6 shrink-0 px-2.5 rounded-md border-0 bg-transparent text-lab-xs font-medium cursor-pointer transition-[color,background-color,scale] motion-safe:active:scale-[0.96] lab-focus'
/** A pickable tile: palette, template, shape, type pair, copy. */
const card = `${pickTile} p-1.5`

/** Text that swaps without changing the button's width: every label sits in
 *  one grid cell, only the shown one is visible. */
function Stable({ labels, show }: { labels: string[]; show: number }) {
  return (
    <span className="grid">
      {labels.map((l, i) => (
        <span key={l} aria-hidden={i !== show} className={`col-start-1 row-start-1 ${i === show ? '' : 'invisible'}`}>{l}</span>
      ))}
    </span>
  )
}

function Group({ title, value, children }: { title: string; value?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 pt-3 first:pt-0">
      <SectionLabel level={4} action={value ? <span className="text-lab-xs text-lab-fg-subtle tabular-nums">{value}</span> : undefined}>{title}</SectionLabel>
      {children}
    </section>
  )
}

/* Previews: every pick shows what it does in a small live canvas
   (LivePreview + panelSketch). They are 2D sketches of the field, not the
   shader; one shared loop runs them and stops when the panel is off screen. */
const TEMPLATE_LOOK: Record<string, { pitch: number; gap: number; round: number; band?: number }> = {
  'full-bleed': { pitch: 5, gap: 1, round: 1 },
  problem: { pitch: 6, gap: 2, round: 0, band: 0.5 },
  'fine-grain': { pitch: 2, gap: 0, round: 0, band: 0.55 },
}
const COMPOSITIONS: { id: CompositionId; label: string }[] = [
  { id: 'split', label: 'Split' },
  { id: 'centered', label: 'Centered' },
]
const recolor = (layers: SketchLayer[], colors: readonly string[]) => layers.map((l, i) => ({ ...l, color: colors[i] ?? l.color }))
/** Two white bars where the headline sits, so a template preview reads as a hero. */
function headline(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#fff'
  ctx.fillRect(Math.round(W * 0.1), Math.round(H * 0.62), Math.round(W * 0.55), Math.max(2, Math.round(H * 0.09)))
  ctx.fillRect(Math.round(W * 0.1), Math.round(H * 0.77), Math.round(W * 0.36), Math.max(2, Math.round(H * 0.09)))
  ctx.globalAlpha = 1
}

/** A palette swatch's copy, laid out like the picked Layout and coloured as
 *  the hero paints it.
 *  - Split: title and sub bars top left in the title colour; the response
 *    line and the CTA pill at the bottom in the palette's accent.
 *  - Centered: a centred title, sub and CTA pill (the hero has no response
 *    line there), each cleared to the background like the clearance mask. */
function paletteAccents(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number,
  o: { title: string; cta: { bg: string; text: string }; back: string; centered: boolean }) {
  const u = Math.max(2, Math.round(2 * dpr)), x = Math.round(5 * dpr)
  const ph = Math.round(9 * dpr), pw = Math.round(W * 0.22), r = Math.round(2 * dpr)
  const pill = (px: number, py: number) => {
    ctx.fillStyle = o.cta.bg
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, r); ctx.fill()
    ctx.fillStyle = o.cta.text
    ctx.fillRect(px + Math.round(pw * 0.2), py + Math.round((ph - u) / 2), Math.round(pw * 0.6), u)
  }
  if (o.centered) {
    const pad = Math.round(2 * dpr)
    const bars: [number, number, number, number][] = [
      [W * 0.5, 6 * dpr, u + dpr, 1], [W * 0.34, 13 * dpr, u, 0.7],
    ]
    const py = Math.round(H * 0.5 + 2 * dpr)
    ctx.fillStyle = o.back
    for (const [w, y, hgt] of bars) ctx.fillRect(Math.round((W - w) / 2) - pad, Math.round(y) - pad, Math.round(w) + 2 * pad, Math.round(hgt) + 2 * pad)
    ctx.fillRect(Math.round((W - pw) / 2) - pad, py - pad, pw + 2 * pad, ph + 2 * pad)
    ctx.fillStyle = o.title
    for (const [w, y, hgt, alpha] of bars) {
      ctx.globalAlpha = alpha
      ctx.fillRect(Math.round((W - w) / 2), Math.round(y), Math.round(w), Math.round(hgt))
    }
    ctx.globalAlpha = 1
    pill(Math.round((W - pw) / 2), py)
    return
  }
  ctx.fillStyle = o.title
  ctx.fillRect(x, Math.round(5 * dpr), Math.round(W * 0.42), u + Math.round(dpr))
  ctx.globalAlpha = 0.7
  ctx.fillRect(x, Math.round(11 * dpr), Math.round(W * 0.28), u)
  ctx.globalAlpha = 1
  const py = H - ph - Math.round(4 * dpr)
  ctx.fillStyle = o.cta.bg
  ctx.fillRect(x, py + Math.round((ph - u) / 2), Math.round(W * 0.3), u)
  pill(W - pw - x, py)
}

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]

export default function DitherPanel() {
  const state = useDitherStore()
  const c = state.shader
  const pg = state.pixelGrid
  const a = state.animation
  const h = state.hover
  const mode = h.mode ?? 'hover'
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [layer, setLayer] = useState(0)

  const otherState = state.initialState === 'fix' ? 'problem' : 'fix'
  const pitch = gridPitch(pg)
  const grain = grainIds.find((g) => (pg.enabled ? grainPitch[g] === pitch : grainDot[g] === c.size)) ?? null
  const gap = gapIds.find((g) => gapFor(g, pitch) === pg.gap) ?? null
  const speed = speedStop(a)?.value ?? null
  const feel = warpFeelIds.find((f) => {
    const w = warpFeels[f]
    return w.warpRotate === h.warpRotate && w.warpRound === h.warpRound && w.warpJitter === h.warpJitter
  }) ?? null
  /** GPU tile field (points, or snapped colour): it samples its own noise, so layer shapes do not reach it. */
  const gpuPath = pg.enabled && (a.tileDisplay === 'points' || pg.snap)
  /** Preview clock rate: the hero's speed, 0 while paused. */
  const tempo = a.playing ? a.speed : 0
  // The hero's shape clock, as DitherHero computes it: Paper's u_time runs at
  // shader.speed × Speed (× 1.8 for a playing scene at rest on Problem), and
  // the shape reads half of it. Scene scan and drift are not drawn here.
  const sceneBoost = state.initialState === 'problem' && a.tileDisplay === 'color' && state.activeScene != null && state.activeScene !== 'solid-classic' ? 1.8 : 1
  const shapeRate = 0.5 * c.speed * sceneBoost * tempo
  /** The hero's tiles in CSS px: pitch, gap and corner radius. */
  const tile = pg.enabled
    ? { pitch, gap: pg.gap, radius: a.tileDisplay === 'points' ? pitch / 2 : pg.radius }
    : { pitch: c.size, gap: 0, radius: 0 }
  /** Point sizes: the hero is the GPU field, which ignores the layer shapes.
   *  Previews then draw drawPointField on the hero's own clocks: field time
   *  runs at tileSizeSpeed × Speed, colour phase at colorCycleSpeed × Speed. */
  const pointMode = pg.enabled && a.tileDisplay === 'points'
  const pointField = (time: number) => ({
    t: 1.3 + time * a.tileSizeSpeed,
    phase: time * c.colorCycleSpeed,
    spread: a.tileSizeSpread,
    contrast: a.tileSizeContrast ?? 0,
    mapScale: a.tileSizeNoise,
  })
  /** Palette strips wear the hero's tile look, scaled down: dots for Point
   *  sizes, the grid's corner radius otherwise, and the grid's gap share. */
  const swatchPitch = pg.enabled ? Math.round(Math.min(8, Math.max(4, pitch / 4))) : 3
  const swatchTile = {
    pitch: swatchPitch,
    gap: pg.enabled ? Math.round((swatchPitch * pg.gap) / pitch) : 0,
    round: !pg.enabled ? 0 : a.tileDisplay === 'points' ? 1 : Math.min(1, (2 * pg.radius) / pitch),
  }
  // The hero lifts centred shapes to the middle of its visible band (see
  // shapeLift in DitherHero). ponytail: a fixed 24% of the height stands in
  // for the measured band (header to copy top, ~0.26 of 900px on desktop);
  // pass the hero's measured value if the copy block moves a lot.
  const centered = state.composition.mode === 'centered'
  const lift = state.edge.mode === 'full' || state.composition.mode === 'centered' ? 0 : HERO.h * 0.24
  const heroSketch = { lift, back: c.colorBack, scale: c.scale, rotation: c.rotation, spread: c.alphaSpread, heroW: HERO.w, heroH: HERO.h, ...tile }
  /** Layout previews: the field at preview pitch `pp` (device px), point
   *  sizes or the template's tile look. Returns the lattice origin, so a
   *  clearance drawn on top hits whole tiles. */
  const layoutField = (ctx: CanvasRenderingContext2D, W: number, H: number, time: number, pp: number, bandTo?: number) => {
    if (pointMode && bandTo == null) {
      drawPointField(ctx, W, H, { back: c.colorBack, layers: c.alphaLayers, pitch: pp, gap: Math.round((pp * pg.gap) / pitch), ...pointField(time) })
      return { ox: (W - Math.floor(W / pp) * pp) / 2, oy: (H - Math.floor(H / pp) * pp) / 2 }
    }
    drawField(ctx, W, H, {
      back: c.colorBack, layers: c.alphaLayers, t: time, pitch: pp, bandTo,
      gap: pg.enabled ? Math.round((pp * pg.gap) / pitch) : 0,
      round: pointMode ? 1 : pg.enabled ? Math.min(1, (2 * pg.radius) / pitch) : 0,
    })
    return { ox: 0, oy: 0 }
  }
  const layoutRate = pointMode ? tempo : 0.6 * tempo
  const pairShown = typePairs[state.typePair ?? 'editorial']
  const copyFace = resolveCopy(state.copyVariant, null).headlineFont
  const headlineMode = resolveCopy(state.copyVariant, null).headlineColorMode

  async function copyConfig() {
    const { activeTemplate, initialState, activeScene, palette, typePair, composition, shader, edge, hover, pixelGrid, animation, layout, button, copyVariant } = state
    try {
      // navigator.clipboard is undefined on a non-secure origin; the optional
      // call then throws into the catch like a refused write.
      await navigator.clipboard.writeText(JSON.stringify(
        { _ditherConfig: 3, activeTemplate, initialState, activeScene, palette, typePair, composition, copyVariant, shader, edge, hover, pixelGrid, animation, layout, button },
        null, 2,
      ))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 1500)
    }
  }

  function shuffle() {
    batchDitherUpdates(() => {
      setInitialState(pick(['problem', 'fix'] as const))
      setPalette(pick(paletteIds))
      setGrain(pick(grainIds))
      if (pg.enabled) setGap(pick(gapIds))
      setHoverConfig({ ...warpFeels[pick(warpFeelIds)], radius: pick([100, 140, 180, 220]) })
      for (let i = 0; i < 3; i++) setAlphaLayer(i, { shape: pick(SHAPES) })
      setCopyVariant(pick(copyVariantIds))
      setTypePair(pick([null, ...typePairIds]))
      setButtonConfig({ radius: pick([0, 12, 999]) })
    })
  }

  return (
    <div>
      <div className="px-3 py-2 border-b border-lab-border">
        <SectionLabel
          level={3}
          action={
            <div role="group" aria-label="Panel actions" className={actionTrack}>
              <button type="button" onClick={shuffle} title="A random mix of the presets" className={`${action} text-lab-fg-muted hover:text-lab-fg hover:bg-lab-fill-hover`}>Shuffle</button>
              <button type="button" onClick={copyConfig} title="Copy the settings as JSON" className={`${action} text-lab-fg-muted hover:text-lab-fg hover:bg-lab-fill-hover`} aria-live="polite">
                <Stable labels={['Copy', 'Copied', 'Failed']} show={copied ? 1 : copyFailed ? 2 : 0} />
              </button>
              <button
                type="button"
                onClick={() => applyHeroTemplate(state.activeTemplate ?? heroTemplates[0].id)}
                title="Back to the template as authored"
                className={`${action} text-lab-danger hover:bg-lab-fill-hover`}
              >
                Reset
              </button>
            </div>
          }
        >
          Dither
        </SectionLabel>
      </div>

      <div className="px-3 py-3 space-y-1">
        <Group title="Start from">
          <div className="grid grid-cols-3 gap-1.5">
            {heroTemplates.map((t) => {
              const look = TEMPLATE_LOOK[t.id] ?? TEMPLATE_LOOK['full-bleed']
              const layers = t.initialState === 'fix' ? fixLayers : problemLayers
              return (
                <button key={t.id} type="button" aria-pressed={state.activeTemplate === t.id} onClick={() => applyHeroTemplate(t.id)} className={`${card} grid gap-1 p-1`}>
                  <LivePreview className="w-full h-10 rounded-sm" rate={0.6} draw={(ctx, time, W, H, dpr) => {
                    drawField(ctx, W, H, { back: palettes.signal.back, layers, t: time, pitch: look.pitch * dpr, gap: look.gap * dpr, round: look.round, bandTo: look.band })
                    headline(ctx, W, H)
                  }} />
                  <span className="truncate px-0.5 text-lab-xs font-medium">{t.name}</span>
                </button>
              )
            })}
          </div>
        </Group>

        <Group title="Layout" value={COMPOSITIONS.find((x) => x.id === state.composition.mode)?.label}>
          <div role="group" aria-label="Layout" className="grid grid-cols-2 gap-1.5">
            {COMPOSITIONS.map(({ id, label }) => (
              <button key={id} type="button" aria-pressed={state.composition.mode === id} onClick={() => setComposition(id)} className={`${card} grid gap-1 p-1`}>
                <LivePreview className="w-full h-10 rounded-sm" rate={layoutRate} draw={(ctx, time, W, H, dpr) => {
                  const pp = 3 * dpr
                  if (id === 'split') {
                    layoutField(ctx, W, H, time, pp, 0.55)
                    headline(ctx, W, H)
                    return
                  }
                  const o = layoutField(ctx, W, H, time, pp)
                  const lines = centredCopyLines(W, H)
                  drawClearance(ctx, W, H, [boundingRect(lines.slice(0, 2)), lines[2], lines[3]], { back: c.colorBack, pitch: pp, ...o, pad: dpr, rim: 2 * pp })
                  drawCopyBars(ctx, lines)
                }} />
                <span className="truncate px-0.5 text-lab-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </Group>

        {state.composition.mode === 'centered' && (
          <Group title="Clearance" value={`${clearanceStops.find((x) => x.value === state.edge.fullPadding)?.label ?? `${state.edge.fullPadding}px`} · ${state.edge.textRectMode === 'lines' ? 'one shape' : 'one block'}`}>
            <>
              {/* The 'full' edge that shapes Centered, at a 2× crop of the
                  hero's middle: tiles, clearance and rim to one scale. */}
              <LivePreview className="w-full h-24 rounded-md border border-lab-border" rate={layoutRate} draw={(ctx, time, W, H, dpr) => {
                const heroPitch = pg.enabled ? pitch : c.size
                const pp = Math.max(3 * dpr, Math.round((heroPitch * W) / (HERO.w / 2)))
                const u = pp / heroPitch
                const o = layoutField(ctx, W, H, time, pp)
                const lines = centredCopyLines(W, H)
                drawClearance(ctx, W, H, state.edge.textRectMode === 'lines' ? bridgeTextRects(lines) : [boundingRect(lines)], {
                  back: c.colorBack, pitch: pp, ...o,
                  pad: state.edge.fullPadding * u,
                  rim: Math.max(1, Math.round(state.edge.dissolveDepth)) * pp,
                  motion: gpuPath ? state.edge.textBlendMotion : 0,
                  t: time,
                })
                drawCopyBars(ctx, lines)
              }} />
              <Segmented size="xs" stretch label="Clearance" value={state.edge.fullPadding} onChange={(fullPadding) => setEdgeConfig({ fullPadding })}
                options={clearanceStops.map((x) => ({ value: x.value, label: `${x.label} ${x.value}px` }))} />
              <Segmented size="xs" stretch label="Rim" value={state.edge.dissolveDepth} onChange={(dissolveDepth) => setEdgeConfig({ dissolveDepth })}
                options={rimStops.map((x) => ({ value: x.value, label: x.label }))} />
              {gpuPath && (
                <Segmented size="xs" stretch label="Rim motion" value={state.edge.textBlendMotion} onChange={(textBlendMotion) => setEdgeConfig({ textBlendMotion })}
                  options={rimMotionStops.map((x) => ({ value: x.value, label: x.label }))} />
              )}
              <Segmented size="xs" stretch label="Clear round" value={state.edge.textRectMode} onChange={(textRectMode) => setEdgeConfig({ textRectMode })}
                options={[{ value: 'lines', label: 'Hug lines' }, { value: 'box', label: 'One block' }]} />
              {pointMode && <p className={hint}>Centered raises Size contrast (Grid) so dots swing between specks and full pieces.</p>}
            </>
          </Group>
        )}

        <Group title="At rest" value={`hover reveals ${otherState}`}>
          <Segmented size="xs" stretch label="State at rest" value={state.initialState} onChange={setInitialState}
            options={[{ value: 'problem', label: 'Problem' }, { value: 'fix', label: 'Fix' }]} />
        </Group>

        <Group title="Palette" value="rest, hover reveals">
          <div className="grid grid-cols-2 gap-1.5">
            {paletteIds.map((id) => {
              const p = palettes[id]
              const cta = heroCtaColors(id)
              const title = headlineMode === 'white' ? '#FFFFFF' : p.problem[0]
              return (
                <button key={id} type="button" aria-pressed={state.palette === id} onClick={() => setPalette(id)} className={`${card} grid gap-1 p-1`}>
                  {/* The picked look in this palette's colours: the layer shapes
                      move at the hero's pace (still while paused), tiles follow
                      the grid, and one reveal glides across in the hover colours. */}
                  <LivePreview className="w-full h-12 rounded-sm" rate={pointMode ? tempo : 0.35 * tempo} draw={(ctx, time, W, H, dpr) => {
                    if (pointMode) {
                      drawPointField(ctx, W, H, { back: p.back, layers: recolor(c.alphaLayers, p[state.initialState]), pitch: swatchTile.pitch * dpr, gap: swatchTile.gap * dpr, ...pointField(time) })
                      paletteAccents(ctx, W, H, dpr, { title, cta, back: p.back, centered })
                      return
                    }
                    drawField(ctx, W, H, {
                      back: p.back, t: 1.3 + time, pitch: swatchTile.pitch * dpr, gap: swatchTile.gap * dpr, round: swatchTile.round, zoom: 0.9,
                      layers: recolor(c.alphaLayers, p[state.initialState]),
                      warp: { x: W * (0.5 + 0.4 * Math.sin(time)), y: H / 2, r: H * 0.75, layers: recolor(h.hoverLayers, p[otherState]), rotate: 0, round: swatchTile.round, jitter: 0 },
                    })
                    paletteAccents(ctx, W, H, dpr, { title, cta, back: p.back, centered })
                  }} />
                  <span className="flex min-w-0 items-baseline justify-between gap-1 px-0.5">
                    <span className="truncate text-lab-xs font-medium">{p.label}</span>
                    <span className="truncate text-lab-xs text-lab-fg-subtle">{p.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Group>

        <Group title="Grid"
          value={pg.enabled ? `${pitch}px tiles · ${pg.gap}px gap` : `${c.size}px dots`}>
          <LivePreview className="w-full h-20 rounded-md border border-lab-border" rate={pointMode ? tempo : shapeRate} draw={(ctx, time, W, H, dpr) => {
            // 1:1 crop of the hero's top band, whole tiles only, centred.
            if (pointMode) {
              drawPointField(ctx, W, H, { back: c.colorBack, layers: c.alphaLayers, pitch: pitch * dpr, gap: pg.gap * dpr, ...pointField(time) })
              return
            }
            drawHero(ctx, W, H, dpr, { ...heroSketch, layers: c.alphaLayers, t: time, zoom: 1, cy: HERO.h / 2 - 80, whole: true })
          }} />
          <Segmented size="xs" stretch label="Tile size" value={grain} onChange={setGrain}
            options={grainIds.map((g) => ({ value: g, label: GRAIN_LABELS[g] }))} />
          {pg.enabled && (
            <Segmented size="xs" stretch label="Gap" value={gap} onChange={setGap}
              options={gapIds.map((g) => ({ value: g, label: GAP_LABELS[g] }))} />
          )}
          {pointMode && (
            <SliderRow label="Size contrast" value={a.tileSizeContrast ?? 0} min={0} max={1} step={0.05}
              onChange={(v) => setAnimationConfig({ tileSizeContrast: v })} />
          )}
        </Group>

        {/* Shapes change nothing on a template that draws its own point sizes
            (gpuPath), so the group only shows where a shape pick is visible. */}
        {!gpuPath && (
          <Group title="Shape">
            <div className="space-y-1">
              <LivePreview className="w-full h-20 rounded-md border border-lab-border" rate={shapeRate} draw={(ctx, time, W, H, dpr) => {
                // The whole hero width, top first: what the hero shows, all layers.
                const zoom = W / dpr / HERO.w
                drawHero(ctx, W, H, dpr, { ...heroSketch, layers: c.alphaLayers, t: time, zoom, cy: HERO.h / 2 - H / dpr / zoom / 2 })
              }} />
              <p className={hint}>The hero, all layers. Tiles below: the picked layer alone.</p>
            </div>
            <div role="group" aria-label="Layer" className="grid grid-cols-3 gap-1.5">
              {c.alphaLayers.map((l, i) => (
                <button key={i} type="button" aria-pressed={layer === i} onClick={() => setLayer(i)} className={`${card} flex min-h-7 items-center gap-1.5 px-1.5 py-1`}>
                  <i className="block size-3 shrink-0 rounded-[3px]" style={{ background: l.color }} />
                  <span className="truncate text-lab-xs"><span className="text-lab-fg-subtle">{i + 1}</span> {l.shape}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {SHAPES.map((s) => (
                <button key={s} type="button" aria-pressed={c.alphaLayers[layer]?.shape === s} onClick={() => setAlphaLayer(layer, { shape: s })} className={`${card} grid gap-1 p-1`}>
                  <LivePreview className="w-full aspect-[8/5] rounded-sm" rate={shapeRate} draw={(ctx, time, W, H, dpr) => {
                    const l = c.alphaLayers[layer]
                    drawHero(ctx, W, H, dpr, { ...heroSketch, layers: [{ color: l?.color ?? '#fff', shape: s, opacity: 1 }], t: time, zoom: W / dpr / HERO.w })
                  }} />
                  <span className="truncate px-0.5 text-lab-xs">{s}</span>
                </button>
              ))}
            </div>
            <SliderRow label="Shape size" value={c.scale} min={0.1} max={2} step={0.05} suffix="×" onChange={(v) => setShaderConfig({ scale: v })} />
          </Group>
        )}

        <Group title="Speed" value={speed === 0 ? 'paused' : `${a.speed}×`}>
          <Segmented size="xs" stretch label="Speed" value={speed}
            onChange={(v) => setAnimationConfig(v === 0 ? { playing: false } : { playing: true, speed: v })}
            options={speedStops.map((s) => ({ value: s.value, label: s.label }))} />
        </Group>

        <Group title="Hover · warp">
          <Segmented size="xs" stretch label="Warp mode" value={mode} onChange={(m) => setHoverConfig({ mode: m })}
            options={warpModeIds.map((m) => ({ value: m, label: warpModeLabel[m], title: warpModeTitle[m] }))} />
          <SliderRow label="Size" value={h.radius} min={40} max={400} step={10} suffix="px" onChange={(v) => setHoverConfig({ radius: v })} />
          {pg.enabled ? (
            <div role="group" aria-label="Warp feel" className="grid grid-cols-4 gap-1.5">
              {warpFeelIds.map((f) => {
                const wf = warpFeels[f]
                return (
                  <button key={f} type="button" aria-pressed={feel === f} onClick={() => { const { label: _, ...w } = wf; setHoverConfig(w) }} className={`${card} grid gap-1 p-1`}>
                    <LivePreview className="w-full aspect-square rounded-sm" rate={0.8} draw={(ctx, time, W, H, dpr) => {
                      drawField(ctx, W, H, {
                        back: c.colorBack, layers: c.alphaLayers, t: 1.3, pitch: 7 * dpr, gap: dpr, round: 0.3,
                        warp: { ...previewWarp(mode, time, W, H, H * (0.18 + 0.32 * (h.radius - 40) / 360), { rotate: wf.warpRotate, round: wf.warpRound }), layers: h.hoverLayers, jitter: wf.warpJitter },
                      })
                    }} />
                    <span className="truncate px-0.5 text-lab-xs">{wf.label}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <>
              <LivePreview className="w-full h-16 rounded-md border border-lab-border" rate={0.8} draw={(ctx, time, W, H, dpr) => {
                drawField(ctx, W, H, {
                  back: c.colorBack, layers: c.alphaLayers, t: 1.3, pitch: 2 * dpr, gap: 0,
                  warp: { ...previewWarp(mode, time, W, H, H * (0.2 + 0.3 * (h.radius - 40) / 360), { rotate: 0, round: 0 }), layers: h.hoverLayers, jitter: 0 },
                })
              }} />
              <p className={hint}>Without tiles the warp reveals whole dots of the field itself.</p>
            </>
          )}
        </Group>

        <Group title="Copy">
          <div role="group" aria-label="Copy" className="grid grid-cols-2 gap-1.5">
            {copyVariantIds.map((id) => {
              const v = copyVariants[id]
              // Each card reads its headline in the copy's own face, so the
              // pick shows the words and the voice, not a cut-off name.
              return (
                <button key={id} type="button" aria-pressed={state.copyVariant === id} onClick={() => setCopyVariant(id)} className={`${card} grid content-start gap-1 text-left`}>
                  <span className="truncate text-lab-xs text-lab-fg-subtle">{v.label}</span>
                  <span className="line-clamp-2 text-lab-md leading-tight text-lab-fg text-pretty" style={{ fontFamily: v.headlineFont, fontWeight: v.headlineWeight }}>{v.headline}</span>
                </button>
              )
            })}
          </div>
        </Group>

        <Group title="Type pair" value={state.typePair ? pairShown.hint : 'the copy’s own'}>
          <div className="grid grid-cols-3 gap-1.5">
            {([null, ...typePairIds] as (TypePairId | null)[]).map((id) => {
              const p = id ? typePairs[id] : null
              // Scoped exception to "tokens only": "Aa" is a type specimen, drawn
              // at display size in the pair's own face, not lab UI text.
              return (
                <button key={id ?? 'auto'} type="button" aria-pressed={state.typePair === id} onClick={() => setTypePair(id)} className={`${card} grid gap-0.5`}>
                  <span className="text-[22px] leading-none text-lab-fg" style={{ fontFamily: p?.headlineFont ?? copyFace, fontWeight: p?.headlineWeight, letterSpacing: p?.headlineTracking }}>Aa</span>
                  <span className="truncate text-lab-xs">{p?.label ?? 'Auto'}</span>
                </button>
              )
            })}
          </div>
        </Group>

        <Group title="Button">
          <Segmented size="xs" stretch label="Button shape"
            value={state.button.radius === 0 || state.button.radius === 12 || state.button.radius === 999 ? state.button.radius : null}
            onChange={(r) => setButtonConfig({ radius: r })}
            options={[{ value: 0, label: 'Square' }, { value: 12, label: 'Rounded' }, { value: 999, label: 'Pill' }]} />
        </Group>

        {state.composition.mode !== 'centered' && (
          <Group title="CTA aligns to sub">
            <Segmented size="xs" stretch label="CTA aligns to sub"
              value={state.layout.ctaAlign}
              onChange={(v) => setLayoutConfig({ ctaAlign: v })}
              options={[{ value: 'first', label: 'First line' }, { value: 'middle', label: 'Middle' }, { value: 'last', label: 'Last line' }]} />
          </Group>
        )}

        <Group title="Guides">
          <div className="flex gap-3">
            <Toggle inline label="Layout guides" on={state.layout.showGuides} onChange={(on) => setLayoutConfig({ showGuides: on })}>Layout</Toggle>
            <Toggle inline label="Baseline guides" on={state.layout.showBaselines} onChange={(on) => setLayoutConfig({ showBaselines: on })}>Baselines</Toggle>
            <Toggle inline label="Box guides" on={state.layout.showBoxes} onChange={(on) => setLayoutConfig({ showBoxes: on })}>Boxes</Toggle>
          </div>
        </Group>
      </div>
    </div>
  )
}
