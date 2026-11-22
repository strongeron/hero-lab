import { useState, type ReactNode } from 'react'
import {
  useDitherStore,
  setHoverConfig,
  setInitialState,
  setAlphaLayer,
  setAnimationConfig,
  setCopyVariant,
  setLayoutConfig,
  setButtonConfig,
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
  warpFeelIds,
  resolveCopy,
  problemLayers,
  fixLayers,
  type DitheringShape,
  type TypePairId,
} from './ditherStore'
import Segmented from '../../lab/ui/Segmented'
import SliderRow from '../../lab/ui/SliderRow'
import SectionLabel from '../../lab/ui/SectionLabel'
import Toggle from '../../lab/ui/Toggle'
import LivePreview from '../../lab/ui/LivePreview'
import { drawField, loopPointer, type SketchLayer } from './panelSketch'

/* The Design Panel offers curated choices only: every option keeps the resting
   state and the hover intact. Renderer, edge, scene and hover mode belong to
   the templates (docs/architecture/2026-11-21-state-machines.md); free colour,
   size and font values are replaced by checked presets in ditherStore. */

const SHAPES: DitheringShape[] = ['simplex', 'warp', 'dots', 'wave', 'ripple', 'swirl', 'sphere']
const SPEEDS = [0, 0.5, 1, 2] as const
const SPEED_LABELS = ['Still', 'Calm', 'Live', 'Wild']
const GRAIN_LABELS = { fine: 'Fine', medium: 'Medium', coarse: 'Coarse', chunky: 'Chunky' }
const GAP_LABELS = { none: 'No gap', tight: 'Tight', open: 'Open' }

const hint = 'text-lab-xs leading-snug text-lab-fg-subtle'
const action =
  'min-h-6 shrink-0 px-2 rounded-md border border-lab-border bg-lab-fill text-lab-xs font-medium text-lab-fg-muted hover:text-lab-fg hover:bg-lab-fill-hover aria-pressed:bg-lab-fill-selected aria-pressed:text-lab-fg cursor-pointer transition-[color,background-color,border-color,transform] active:scale-[0.96] lab-focus'
/** A pickable tile: palette, template, shape, type pair, copy. */
const card =
  'min-w-0 rounded-md border border-lab-border bg-lab-fill p-1.5 text-left text-lab-fg-muted hover:bg-lab-fill-hover aria-pressed:border-lab-border-strong aria-pressed:bg-lab-fill-selected aria-pressed:text-lab-fg cursor-pointer transition-[color,background-color,border-color,transform] active:scale-[0.96] lab-focus'

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

function Group({ title, value, why, showWhy, children }: { title: string; value?: ReactNode; why?: ReactNode; showWhy: boolean; children: ReactNode }) {
  return (
    <section className="space-y-2 pt-3 first:pt-0">
      <SectionLabel level={4} action={value ? <span className="text-lab-xs text-lab-fg-subtle tabular-nums">{value}</span> : undefined}>{title}</SectionLabel>
      {showWhy && why && (
        <p className="rounded-md border border-lab-accent/20 bg-lab-accent/5 px-2 py-1.5 text-lab-xs leading-snug text-lab-fg-muted">{why}</p>
      )}
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
const recolor = (layers: SketchLayer[], colors: readonly string[]) => layers.map((l, i) => ({ ...l, color: colors[i] ?? l.color }))
/** Two white bars where the headline sits, so a template preview reads as a hero. */
function headline(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#fff'
  ctx.fillRect(Math.round(W * 0.1), Math.round(H * 0.62), Math.round(W * 0.55), Math.max(2, Math.round(H * 0.09)))
  ctx.fillRect(Math.round(W * 0.1), Math.round(H * 0.77), Math.round(W * 0.36), Math.max(2, Math.round(H * 0.09)))
  ctx.globalAlpha = 1
}

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]

export default function DitherPanel() {
  const state = useDitherStore()
  const c = state.shader
  const pg = state.pixelGrid
  const a = state.animation
  const h = state.hover
  const [copied, setCopied] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [layer, setLayer] = useState(0)

  const otherState = state.initialState === 'fix' ? 'problem' : 'fix'
  const pitch = gridPitch(pg)
  const grain = grainIds.find((g) => (pg.enabled ? grainPitch[g] === pitch : grainDot[g] === c.size)) ?? null
  const gap = gapIds.find((g) => gapFor(g, pitch) === pg.gap) ?? null
  const speed = SPEEDS.find((s) => s === (a.playing ? a.speed : 0)) ?? null
  const feel = warpFeelIds.find((f) => {
    const w = warpFeels[f]
    return w.warpRotate === h.warpRotate && w.warpRound === h.warpRound && w.warpJitter === h.warpJitter
  }) ?? null
  /** GPU tile field (points, or snapped colour): it samples its own noise, so layer shapes do not reach it. */
  const gpuPath = pg.enabled && (a.tileDisplay === 'points' || pg.snap)
  /** Preview clock rate: the hero's speed, 0 while paused. */
  const tempo = a.playing ? a.speed : 0
  const pairShown = typePairs[state.typePair ?? 'editorial']
  const copyFace = resolveCopy(state.copyVariant, null).headlineFont

  function copyConfig() {
    const { activeTemplate, initialState, activeScene, palette, typePair, shader, edge, hover, pixelGrid, animation, layout, button, copyVariant } = state
    navigator.clipboard.writeText(JSON.stringify(
      { _ditherConfig: 3, activeTemplate, initialState, activeScene, palette, typePair, copyVariant, shader, edge, hover, pixelGrid, animation, layout, button },
      null, 2,
    ))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
    <div className="border-b border-lab-border">
      <div className="px-3 py-2 border-b border-lab-border">
        <SectionLabel
          level={3}
          action={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setShowWhy(!showWhy)} aria-pressed={showWhy} title="Show why each section is safe" className={action}>Why</button>
              <button type="button" onClick={shuffle} title="A random mix of the presets" className={action}>Shuffle</button>
              <button type="button" onClick={copyConfig} className={action} aria-live="polite">
                <Stable labels={['Copy', 'Copied']} show={copied ? 1 : 0} />
              </button>
              <button
                type="button"
                onClick={() => applyHeroTemplate(state.activeTemplate ?? heroTemplates[0].id)}
                title="Back to the template as authored"
                className="min-h-6 px-1.5 rounded-md bg-transparent border-0 text-lab-xs font-medium text-lab-danger hover:text-lab-fg cursor-pointer transition-[color,background-color,border-color,transform] active:scale-[0.96] lab-focus"
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
        <Group title="Start from" showWhy={showWhy}
          why="A template sets renderer, edge and scene together. None of those sit in this panel, so nothing below can break the resting state.">
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

        <Group title="At rest" value={`hover reveals ${otherState}`} showWhy={showWhy}
          why="The resting palette shows first; the hover reveals the other one. Both are authored, so the hover always shows a real state.">
          <Segmented size="xs" stretch label="State at rest" value={state.initialState} onChange={setInitialState}
            options={[{ value: 'problem', label: 'Problem' }, { value: 'fix', label: 'Fix' }]} />
        </Group>

        <Group title="Palette" value="rest, hover reveals" showWhy={showWhy}
          why="Pairs, not pickers. Each of the three resting layers takes one colour of the pair; Prism and Aurora give every layer its own hue. Each pair is checked for contrast with the reveal and readable white text.">
          <div className="grid grid-cols-2 gap-1.5">
            {paletteIds.map((id) => {
              const p = palettes[id]
              return (
                <button key={id} type="button" aria-pressed={state.palette === id} onClick={() => setPalette(id)} className={`${card} grid gap-1 p-1`}>
                  <LivePreview className="w-full h-9 rounded-sm" rate={0.8} draw={(ctx, time, W, H, dpr) => {
                    const ptr = loopPointer(time, W, H)
                    drawField(ctx, W, H, {
                      back: p.back, t: time * 0.5, pitch: 3 * dpr, gap: dpr, layers: recolor(c.alphaLayers, p[state.initialState]),
                      warp: { ...ptr, r: H * 0.55, layers: recolor(h.hoverLayers, p[otherState]), rotate: 0, round: 0, jitter: 0 },
                    })
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

        <Group title="Grain" showWhy={showWhy}
          value={pg.enabled ? `${pitch}px pieces · ${pg.gap}px gap · 1:1` : `${c.size}px dots · 1:1`}
          why="Whole pixels only. Every size and gap is an integer, so tiles stay sharp at 1× and 2×. The strip shows the real size.">
          <LivePreview className="w-full h-12 rounded-md border border-lab-border" rate={tempo * 0.5} draw={(ctx, time, W, H, dpr) => {
            const p = (pg.enabled ? pitch : c.size) * dpr
            drawField(ctx, W, H, {
              back: c.colorBack, layers: c.alphaLayers, t: time, zoom: 1.2,
              pitch: p, gap: pg.enabled ? pg.gap * dpr : 0,
              round: pg.enabled ? (gpuPath && a.tileDisplay === 'points' ? 1 : Math.min(1, (pg.radius * 2) / pitch)) : 0,
            })
          }} />
          <Segmented size="xs" stretch label="Grain" value={grain} onChange={setGrain}
            options={grainIds.map((g) => ({ value: g, label: GRAIN_LABELS[g] }))} />
          {pg.enabled && (
            <Segmented size="xs" stretch label="Gap" value={gap} onChange={setGap}
              options={gapIds.map((g) => ({ value: g, label: GAP_LABELS[g] }))} />
          )}
        </Group>

        <Group title="Shape & speed" value={speed === 0 ? 'paused' : `${a.speed}×`} showWhy={showWhy}
          why="Each resting layer draws one shape; the big preview shows the picked layer on top of the others. Speed drives every loop, here and in the hero.">
          {gpuPath ? (
            <p className={hint}>
              This template draws point sizes from its own noise, so layer shapes do not change it. Start from Problem or Fine Grain to use shapes.
            </p>
          ) : (
            <>
              <div role="group" aria-label="Layer" className="grid grid-cols-3 gap-1.5">
                {c.alphaLayers.map((l, i) => (
                  <button key={i} type="button" aria-pressed={layer === i} onClick={() => setLayer(i)} className={`${card} flex min-h-7 items-center gap-1.5 px-1.5 py-1`}>
                    <i className="block size-3 shrink-0 rounded-[3px]" style={{ background: l.color }} />
                    <span className="truncate text-lab-xs"><span className="text-lab-fg-subtle">{i + 1}</span> {l.shape}</span>
                  </button>
                ))}
              </div>
              <LivePreview className="w-full h-16 rounded-md border border-lab-border" rate={tempo} draw={(ctx, time, W, H, dpr) => {
                drawField(ctx, W, H, {
                  back: c.colorBack, layers: c.alphaLayers, t: time, pitch: 3 * dpr, gap: 0,
                  alpha: c.alphaLayers.map((_, i) => (i === layer ? 1 : 0.18)),
                })
              }} />
              <div className="grid grid-cols-4 gap-1.5">
                {SHAPES.map((s) => (
                  <button key={s} type="button" aria-pressed={c.alphaLayers[layer]?.shape === s} onClick={() => setAlphaLayer(layer, { shape: s })} className={`${card} grid gap-1 p-1`}>
                    <LivePreview className="w-full aspect-[3/2] rounded-sm" rate={tempo} draw={(ctx, time, W, H, dpr) => {
                      const l = c.alphaLayers[layer]
                      drawField(ctx, W, H, { back: c.colorBack, layers: [{ color: l?.color ?? '#fff', shape: s, opacity: 1 }], t: time, pitch: 2 * dpr, gap: 0 })
                    }} />
                    <span className="truncate px-0.5 text-lab-xs">{s}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <Segmented size="xs" stretch label="Speed" value={speed}
            onChange={(v) => setAnimationConfig(v === 0 ? { playing: false } : { playing: true, speed: v })}
            options={SPEEDS.map((s, i) => ({ value: s, label: SPEED_LABELS[i] }))} />
        </Group>

        <Group title="Hover · warp" showWhy={showWhy}
          why="The warp is the only hover. Size and feel change how it looks, never what it reveals. Each preview runs the warp under a moving pointer.">
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
                        warp: { ...loopPointer(time, W, H), r: H * (0.18 + 0.32 * (h.radius - 40) / 360), layers: h.hoverLayers, rotate: wf.warpRotate, round: wf.warpRound, jitter: wf.warpJitter },
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
                  warp: { ...loopPointer(time, W, H), r: H * (0.2 + 0.3 * (h.radius - 40) / 360), layers: h.hoverLayers, rotate: 0, round: 0, jitter: 0 },
                })
              }} />
              <p className={hint}>Without tiles the warp reveals whole dots of the field itself.</p>
            </>
          )}
        </Group>

        <Group title="Copy" showWhy={showWhy}
          why="Each copy set brings its own headline, response and sub, sized for the grid.">
          <div role="group" aria-label="Copy" className="grid grid-cols-4 gap-1.5">
            {copyVariantIds.map((id) => (
              <button key={id} type="button" aria-pressed={state.copyVariant === id} onClick={() => setCopyVariant(id)} className={`${action} truncate px-1`}>
                {copyVariants[id].label}
              </button>
            ))}
          </div>
        </Group>

        <Group title="Type pair" value={state.typePair ? pairShown.hint : 'the copy’s own'} showWhy={showWhy}
          why="Tested pairs only. A pair sets display face, body face, weight, leading and tracking together, so the headline keeps its rhythm and the CTA its baseline.">
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

        <Group title="Button" showWhy={false}>
          <Segmented size="xs" stretch label="Button shape"
            value={state.button.radius === 0 || state.button.radius === 12 || state.button.radius === 999 ? state.button.radius : null}
            onChange={(r) => setButtonConfig({ radius: r })}
            options={[{ value: 0, label: 'Square' }, { value: 12, label: 'Rounded' }, { value: 999, label: 'Pill' }]} />
        </Group>

        <Group title="Guides" showWhy={false}>
          <div className="flex gap-3">
            <Toggle inline label="Layout guides" on={state.layout.showGuides} onChange={(on) => setLayoutConfig({ showGuides: on })}>Layout</Toggle>
            <Toggle inline label="Baseline guides" on={state.layout.showBaselines} onChange={(on) => setLayoutConfig({ showBaselines: on })}>Baselines</Toggle>
          </div>
        </Group>
      </div>
    </div>
  )
}
