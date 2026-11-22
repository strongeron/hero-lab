import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  type DitheringShape,
  type TypePairId,
} from './ditherStore'
import Segmented from '../../lab/ui/Segmented'
import SliderRow from '../../lab/ui/SliderRow'
import SectionLabel from '../../lab/ui/SectionLabel'
import Toggle from '../../lab/ui/Toggle'

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

function Dots({ colors }: { colors: readonly string[] }) {
  return (
    <span className="flex gap-0.5">
      {colors.map((c, i) => <i key={i} className="block size-2.5 rounded-[2px]" style={{ background: c }} />)}
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

/* Static thumbnails of the seven shapes. ponytail: these are rough canvas
   sketches of Paper's shapes, not the shader itself (seven WebGL contexts for
   a picker is too much). Swap for pre-rendered images if they mislead. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
const SKETCH: Record<DitheringShape, (u: number, v: number) => number> = {
  simplex: (u, v) => 0.5 + 0.25 * (Math.sin(u * 3 + 1.3) * Math.sin(v * 2.3 - 0.9) + Math.sin((u + v) * 1.7 + 0.6)),
  warp: (u, v) => 0.5 + 0.5 * Math.sin(u * 2.5 + 1.6 * Math.sin(v * 2 + 1.3)),
  dots: (u, v) => 0.5 + 0.5 * Math.sin(u * 9 + 1.3) * Math.sin(v * 9),
  wave: (u, v) => 0.5 + 0.5 * Math.sin(v * 5 + 1.3 * Math.sin(u * 2 + 1.3)),
  ripple: (u, v) => 0.5 + 0.5 * Math.sin(Math.hypot(u, v) * 10 - 2.6),
  swirl: (u, v) => 0.5 + 0.5 * Math.sin(Math.atan2(v, u) * 3 + Math.hypot(u, v) * 6 - 1.3),
  sphere: (u, v) => Math.max(0, 1.05 - Math.hypot(u, v) * 1.1),
}
function ShapeThumb({ shape, color, back }: { shape: DitheringShape; color: string; back: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = back
    ctx.fillRect(0, 0, 60, 40)
    ctx.fillStyle = color
    for (let y = 0; y < 13; y++) for (let x = 0; x < 20; x++) {
      if (SKETCH[shape]((x - 10) / 5.5, (y - 6.5) / 5.5) > BAYER[(y & 3) * 4 + (x & 3)]) ctx.fillRect(x * 3, y * 3, 3, 3)
    }
  }, [shape, color, back])
  return <canvas ref={ref} width={60} height={40} aria-hidden className="block w-full aspect-[3/2] rounded-sm [image-rendering:pixelated]" />
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
            {heroTemplates.map((t) => (
              <button key={t.id} type="button" aria-pressed={state.activeTemplate === t.id} onClick={() => applyHeroTemplate(t.id)} className={`${card} grid gap-1`}>
                <Dots colors={t.swatch} />
                <span className="truncate text-lab-xs font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group title="At rest" value={`hover reveals ${otherState}`} showWhy={showWhy}
          why="The resting palette shows first; the hover reveals the other one. Both are authored, so the hover always shows a real state.">
          <Segmented size="xs" stretch label="State at rest" value={state.initialState} onChange={setInitialState}
            options={[{ value: 'problem', label: 'Problem' }, { value: 'fix', label: 'Fix' }]} />
        </Group>

        <Group title="Palette" value="rest → reveal" showWhy={showWhy}
          why="Pairs, not pickers. Each pair is checked: the reveal contrasts with the rest, and white text stays readable on the background.">
          <div className="grid grid-cols-2 gap-1.5">
            {paletteIds.map((id) => {
              const p = palettes[id]
              return (
                <button key={id} type="button" aria-pressed={state.palette === id} onClick={() => setPalette(id)} className={`${card} flex items-center gap-2`}>
                  <span className="grid gap-0.5"><Dots colors={p.problem} /><Dots colors={p.fix} /></span>
                  <span className="grid min-w-0">
                    <span className="truncate text-lab-xs font-medium">{p.label}</span>
                    <span className="truncate text-lab-2xs text-lab-fg-subtle">{p.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Group>

        <Group title="Grain" showWhy={showWhy}
          value={pg.enabled ? `${pitch}px pieces · ${pg.gap}px gap` : `${c.size}px dots`}
          why="Whole pixels only. Every size and gap is an integer, so tiles stay sharp at 1× and 2×.">
          <Segmented size="xs" stretch label="Grain" value={grain} onChange={setGrain}
            options={grainIds.map((g) => ({ value: g, label: GRAIN_LABELS[g] }))} />
          {pg.enabled && (
            <Segmented size="xs" stretch label="Gap" value={gap} onChange={setGap}
              options={gapIds.map((g) => ({ value: g, label: GAP_LABELS[g] }))} />
          )}
        </Group>

        <Group title="Shape" value={`layer ${layer + 1}: ${c.alphaLayers[layer]?.shape}`} showWhy={showWhy}
          why="Shape changes what each resting layer draws. Text clearance and the hover stay the same with any of the seven.">
          <div role="group" aria-label="Layer" className="flex items-center gap-1.5">
            {c.alphaLayers.map((l, i) => (
              <button key={i} type="button" aria-label={`Layer ${i + 1}`} aria-pressed={layer === i} onClick={() => setLayer(i)}
                className="grid size-7 place-items-center rounded-md border border-lab-border bg-lab-fill aria-pressed:border-lab-fg cursor-pointer transition-[border-color,transform] active:scale-[0.96] lab-focus">
                <i className="block size-3.5 rounded-[3px]" style={{ background: l.color }} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {SHAPES.map((s) => (
              <button key={s} type="button" aria-pressed={c.alphaLayers[layer]?.shape === s} onClick={() => setAlphaLayer(layer, { shape: s })} className={`${card} grid gap-1 p-1`}>
                <ShapeThumb shape={s} color={c.alphaLayers[layer]?.color ?? '#fff'} back={c.colorBack} />
                <span className="truncate text-lab-2xs">{s}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group title="Motion" value={speed === 0 ? 'paused' : `${a.speed}×`} showWhy={showWhy}
          why="One speed drives every loop. Still replaces the play toggle.">
          <Segmented size="xs" stretch label="Speed" value={speed}
            onChange={(v) => setAnimationConfig(v === 0 ? { playing: false } : { playing: true, speed: v })}
            options={SPEEDS.map((s, i) => ({ value: s, label: SPEED_LABELS[i] }))} />
        </Group>

        <Group title="Hover · warp" showWhy={showWhy}
          why="The warp is the only hover. Size and feel change how it looks, never what it reveals.">
          <SliderRow label="Size" value={h.radius} min={40} max={400} step={10} suffix="px" onChange={(v) => setHoverConfig({ radius: v })} />
          {pg.enabled ? (
            <Segmented size="xs" stretch label="Warp feel" value={feel}
              onChange={(f) => { const { label: _, ...w } = warpFeels[f]; setHoverConfig(w) }}
              options={warpFeelIds.map((f) => ({ value: f, label: warpFeels[f].label }))} />
          ) : (
            <p className={hint}>Without tiles the warp reveals whole dots of the field itself.</p>
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
              return (
                <button key={id ?? 'auto'} type="button" aria-pressed={state.typePair === id} onClick={() => setTypePair(id)} className={`${card} grid gap-0.5`}>
                  <span className="text-[22px] leading-none text-lab-fg" style={{ fontFamily: p?.headlineFont ?? copyFace, fontWeight: p?.headlineWeight, letterSpacing: p?.headlineTracking }}>Aa</span>
                  <span className="truncate text-lab-2xs">{p?.label ?? 'Auto'}</span>
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
