import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  useDitherStore,
  setShaderConfig,
  setPixelGridConfig,
  setHoverConfig,
  setAnimationConfig,
  setEdgeConfig,
  applyHeroTemplate,
  applySceneTemplate,
  batchDitherUpdates,
  setStableColorField,
  getTabSourceId,
  getDitherState,
  defaultEdgeConfig,
  heroTemplates,
  sceneTemplates,
  grainIds,
  grainPitch,
  gapIds,
  gapFor,
  gridPitch,
  warpFeels,
  warpFeelIds,
  type DitherState,
  type DitherAnimationConfig,
  type SceneTemplateId,
  snapshotDitherState,
  speedStops,
  speedStop,
  restoreDitherState,
} from '../heroes/dither/ditherStore'
import { pickTile } from './ui/pickTile'
import LabToolbarTitle from './LabToolbarTitle'
import Segmented from './ui/Segmented'
import SectionLabel from './ui/SectionLabel'
import LivePreview from './ui/LivePreview'
import { ALL_STEPS, drawStep, stepLook, templateSource, type StepId } from './layerSketch'

/** One template, taken apart as a progressive STACK.
 *
 *  Opens on the selected template's bare scene — its own colours, shader and
 *  motion with every layer removed — then adds the template's layers back one
 *  at a time, with the template's own values. The last step is the template
 *  exactly. Layers a template does not use are not shown as steps. Everything
 *  drives the real store, so the live desktop hero (a synced ?preview iframe,
 *  actual WebGL) is the truth. On leaving the view the template is restored. */

const DESK = { width: 1440, height: 900 }
const PAD = 40
const TOGGLE_COL = 400

type Verdict = 'core' | 'signature' | 'situational'
// Scoped exception to "tokens only" (DESIGN.md): each badge hue names a verdict
// category, and the lab has no category tokens.
const verdictStyle: Record<Verdict, string> = {
  core: 'text-emerald-300/80 border-emerald-400/30 bg-emerald-400/10',
  signature: 'text-amber-300/80 border-amber-400/30 bg-amber-400/10',
  situational: 'text-sky-300/80 border-sky-400/30 bg-sky-400/10',
}

/** Scenes that look different on the bare base. The store has 11; on this
 *  base the other six repeat one of these: Color Flow, Falling and Sweep are
 *  pans like Gentle Drift; Breath and Breathe spin and pulse like Living;
 *  Error Sweep is a faster Radar. Their extra parts (gap pulse, tile size,
 *  colour cycling) only show with the pixel grid or outside this view, where
 *  stableColorField holds the colour still. */
const LAYER_SCENES: SceneTemplateId[] = ['solid-classic', 'gentle-drift', 'living-texture', 'orbit', 'radar-scan']

/** The Panel's Grain and Gap words, used when a step's value matches a preset. */
const GRAIN_LABELS = { fine: 'Fine', medium: 'Medium', coarse: 'Coarse', chunky: 'Chunky' }
const GAP_LABELS = { none: 'No gap', tight: 'Tight gap', open: 'Open gap' }
/** Pick tile, shared with the Design Panel. */
const card = `${pickTile} p-1`
/** Step thumbnails: a 16:10 mini hero (the artboard is 1440 × 900). */
const thumb = 'w-20 sm:w-28 aspect-[16/10] rounded-md border border-lab-border'
const NO_STEPS: ReadonlySet<StepId> = new Set()

/** What the motion visibly does, read from the same values DitherHero uses. */
function describeMotion(a: DitherAnimationConfig, speed: number) {
  const lb = a.loopBreakAmount > 0 ? a.loopBreak : 'none'
  const pans = a.driftX !== 0 || a.driftY !== 0 || lb === 'drift' || lb === 'orbit' || lb === 'wander'
  const spins = a.rotationDrift !== 0 || lb === 'rotate' || lb === 'orbit' || lb === 'wander'
  const scans = a.scanMode === 'oscillate' && a.scanAmplitude > 0
  const parts = [speed < 0.05 ? 'shape changes slowly' : 'shape changes']
  if (scans) parts.push('scans back and forth')
  if (pans || spins) parts.push(`field ${pans && spins ? 'pans and spins' : pans ? 'pans' : 'spins'}`)
  if (a.waveAmplitude > 0) parts.push('wave sweeps')
  if (a.pulseAmount >= 0.03) parts.push('pulses')
  if (!pans && !spins && !scans) parts.push('nothing pans or spins')
  return parts.join(' · ')
}

export default function LayerExplorer({ onHome }: { onHome?: () => void }) {
  const s = useDitherStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(0)
  // The template being taken apart, as applied (a store snapshot), so every
  // step can restore that template's own value for its setting.
  const target = useRef<DitherState | null>(null)
  const t = target.current ?? s
  // Speed stops shared with the Design Panel; animation.speed scales every loop.
  const speed = speedStop(s.animation)?.value ?? null
  /** Preview clock rate, as in the Design Panel: the hero's speed, 0 while still. */
  const tempo = s.animation.playing ? s.animation.speed : 0

  // Without the grid, the shader's own cell size shows. A gridded template
  // keeps a large size (16) that only reads through the grid, so the bare step
  // uses the grid's tile size instead: step 1 then adds the mask and nothing else.
  const bareSize = t.pixelGrid.enabled ? t.pixelGrid.cell / t.pixelGrid.divisions : t.shader.size
  const { topInset: _ti, ...bareEdge } = defaultEdgeConfig
  void _ti
  const textFlow = t.edge.mode === 'full'

  // ── The additive stack. `used` = the template has this layer; only used
  //    layers are steps. `on` reads the REAL store so the UI stays truthful. ──
  const pitch = gridPitch(t.pixelGrid)
  const grainId = grainIds.find((g) => grainPitch[g] === pitch)
  const gapId = gapIds.find((g) => gapFor(g, pitch) === t.pixelGrid.gap)
  const feel = warpFeelIds.find((f) => {
    const w = warpFeels[f]
    return w.warpRotate === t.hover.warpRotate && w.warpRound === t.hover.warpRound && w.warpJitter === t.hover.warpJitter
  })
  const ALL: { id: StepId; name: string; value: string; verdict: Verdict; vlabel: string; used: boolean; on: boolean; set: (on: boolean) => void }[] = [
    {
      id: 'grid', name: 'Tile grid', verdict: 'core', vlabel: 'Core',
      value: `${[grainId && `${GRAIN_LABELS[grainId]} grain`, gapId && GAP_LABELS[gapId]].filter(Boolean).join(' · ') || 'Custom'} — ${pitch}px tiles, ${t.pixelGrid.gap}px gap, ${t.pixelGrid.radius}px radius`,
      used: t.pixelGrid.enabled,
      on: s.pixelGrid.enabled,
      // Off also drops the tile renderer, which draws nothing without the grid.
      set: (on) => {
        if (on) {
          setPixelGridConfig({ ...t.pixelGrid, snap: s.pixelGrid.snap })
          setShaderConfig({ size: t.shader.size })
        } else {
          setPixelGridConfig({ enabled: false, snap: false })
          setShaderConfig({ size: bareSize })
          setAnimationConfig({ tileDisplay: 'color' })
        }
      },
    },
    {
      id: 'snap', name: 'Snapped colour', verdict: 'situational', vlabel: 'Situational',
      value: 'one flat colour per tile',
      used: t.pixelGrid.enabled && t.pixelGrid.snap,
      on: s.pixelGrid.enabled && s.pixelGrid.snap,
      set: (on) => setPixelGridConfig(on ? { enabled: true, snap: true } : { snap: false }),
    },
    {
      id: 'points', name: 'Point sizes', verdict: 'core', vlabel: 'Core',
      value: `dots grow and shrink with the dither · spread ${t.animation.tileSizeSpread}`,
      used: t.pixelGrid.enabled && t.animation.tileDisplay !== 'color',
      on: s.pixelGrid.enabled && s.animation.tileDisplay === t.animation.tileDisplay,
      set: (on) => {
        if (on && !s.pixelGrid.enabled) setPixelGridConfig({ ...t.pixelGrid })
        setAnimationConfig({ tileDisplay: on ? t.animation.tileDisplay : 'color' })
      },
    },
    {
      id: 'edge', name: 'Full edge', verdict: 'core', vlabel: 'Core',
      value: `fills the hero · ${t.edge.fullPadding}px clearance around each ${t.edge.textRectMode === 'lines' ? 'line' : 'block'}`,
      used: textFlow,
      on: s.edge.mode === t.edge.mode,
      set: (on) => {
        const { topInset: _keep, ...edge } = t.edge
        void _keep
        setEdgeConfig(on ? edge : bareEdge)
      },
    },
    {
      id: 'hover', name: 'Hover · warp', verdict: 'signature', vlabel: 'Signature',
      value: `${feel ? warpFeels[feel].label : 'Custom'} warp · ${t.hover.radius}px · hover reveals ${t.initialState === 'problem' ? 'fix' : 'problem'}`,
      used: t.hover.enabled,
      on: s.hover.enabled,
      set: (on) => setHoverConfig({ enabled: on }),
    },
  ]
  const STACK = ALL.filter((L) => L.used)
  const unused = ALL.filter((L) => !L.used).map((L) => L.name)
  // Level = how many leading stack layers are on (for the stepper display).
  const level = (() => { let n = 0; for (const L of STACK) { if (L.on) n++; else break } return n })()

  function applyLevel(lv: number) {
    batchDitherUpdates(() => STACK.forEach((L, i) => L.set(i < lv)))
  }
  /** Step 0: a scene (null = the template's own motion). Speed and play state
   *  are kept unless `speed` is given (the "Template motion" reset passes 1). */
  function applyMotion(scene: SceneTemplateId | null, speed?: number) {
    const tg = target.current
    if (!tg) return
    const { playing, speed: current, tileDisplay } = getDitherState().animation
    batchDitherUpdates(() => {
      if (scene) applySceneTemplate(scene)
      else {
        setShaderConfig({ speed: tg.shader.speed, colorCycleSpeed: tg.shader.colorCycleSpeed })
        // tileDisplay is a step (Point sizes), not motion: keep the current one.
        setAnimationConfig({ ...tg.animation, tileDisplay })
      }
      setAnimationConfig(speed == null ? { playing, speed: current } : { playing: true, speed })
    })
  }
  function applySpeed(v: number) {
    setAnimationConfig(v === 0 ? { playing: false } : { playing: true, speed: v })
  }
  // Load a template and strip it to its bare scene.
  function explore(id: string) {
    applyHeroTemplate(id)
    target.current = structuredClone(getDitherState())
    restoreId.current = id
    // Calm the screen-blended Color/alpha base while exploring layers — see
    // DitherState.stableColorField. applyHeroTemplate resets it, so set it after.
    setStableColorField(true)
    setAnimationConfig({ playing: true })
    // Steps are rebuilt from the new target on the next render; strip now
    // with the same rules, all layers off.
    const tg = target.current
    batchDitherUpdates(() => {
      setPixelGridConfig({ enabled: false, snap: false })
      setShaderConfig({ size: tg.pixelGrid.enabled ? tg.pixelGrid.cell / tg.pixelGrid.divisions : tg.shader.size })
      setAnimationConfig({ tileDisplay: 'color' })
      if (tg.edge.mode === 'full') setEdgeConfig(bareEdge)
      setHoverConfig({ enabled: false })
    })
  }
  // On mount: take apart the selected template (Full Bleed if none).
  // On exit: the Design Panel look from before the visit comes back, unless
  // another template was picked here; then that template opens as authored.
  const restoreId = useRef<string | null>(null)
  useEffect(() => {
    const entry = snapshotDitherState()
    const entryId = s.activeTemplate ?? heroTemplates[0].id
    explore(entryId)
    return () => {
      if (restoreId.current && restoreId.current !== entryId) {
        setStableColorField(false)
        applyHeroTemplate(restoreId.current)
      } else restoreDitherState(entry)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Layout effect: measure before first paint (no jump from the fallback scale).
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => setAvailW(el.clientWidth)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Below xl the controls sit UNDER the hero, so the hero gets the full width
  // instead of leaving a gap for a column that isn't beside it. The old formula
  // subtracted TOGGLE_COL unconditionally and floored at 360px, which on a
  // 390px viewport asked for a 360px hero inside a 310px content box — hence
  // the horizontal overflow. No floor now: narrow just means a smaller preview.
  const stacked = availW < 1280
  const heroBudget = stacked
    ? Math.max(0, availW - PAD * 2)
    : Math.max(360, availW - PAD * 2 - TOGGLE_COL - 24)
  const scale = availW > 0 ? Math.min(1, heroBudget / DESK.width) : 0.5
  const frameSrc = useMemo(() => {
    const p = new URLSearchParams(window.location.search)
    p.set('preview', '1')
    // Bind this frame to THIS tab's source so other Hero Lab tabs on the shared
    // BroadcastChannel can't overwrite the scene the user just picked.
    p.set('sid', getTabSourceId())
    return `${window.location.pathname}?${p.toString()}`
  }, [])

  const ownMotion = s.activeScene === t.activeScene
  const sceneName = s.activeScene ? sceneTemplates[s.activeScene].label : 'Template motion'
  const activeSceneHint = `${sceneName}${ownMotion && s.activeScene ? ' (template)' : ''} · ${describeMotion(s.animation, s.shader.speed)}`
  // Shared by the Layers buttons: 150ms colour, and a press scale only when
  // the viewer allows motion and the button is enabled.
  const pressable = 'cursor-pointer transition-[color,background-color,border-color,scale] duration-150 ease-out motion-safe:enabled:active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed lab-focus'
  const smallBtn = `grid place-items-center rounded-md border border-lab-border bg-transparent text-lab-fg-muted enabled:hover:text-lab-fg enabled:hover:border-lab-border-strong ${pressable}`
  const topBtn = `text-lab-xs font-medium px-3 py-1.5 rounded-lg border border-lab-border text-lab-fg-muted hover:text-lab-fg hover:border-lab-border-strong bg-lab-fill ${pressable}`

  return (
    <div className="h-dvh flex flex-col bg-lab-canvas">
      <div className="shrink-0 z-10 h-lab-bar flex items-center justify-between px-6 border-b border-lab-border bg-lab-toolbar">
        <LabToolbarTitle
          onHome={onHome}
          view="Recipe"
        />
        <div className="flex items-center gap-1.5">
          <button onClick={() => applyLevel(0)} disabled={level === 0} className={topBtn}>Bare scene</button>
          <button onClick={() => applyLevel(STACK.length)} disabled={level === STACK.length} className={topBtn}>Full stack</button>
        </div>
      </div>

      <div ref={wrapRef} className="flex-1 overflow-auto">
        {/* Stacks below xl. The hero preview keeps a fixed 1440-wide artboard
            scaled down, so side-by-side leaves the controls column no room on a
            narrow viewport — it got squeezed past the right edge and the stack
            was unreachable there. */}
        <div className="flex flex-col xl:flex-row gap-6 items-start" style={{ padding: PAD }}>
          {/* Live real-shader hero */}
          <div className="shrink-0">
            <div className="rounded-xl border border-lab-border overflow-hidden bg-lab-artboard shadow-lab-raised" style={{ width: DESK.width * scale, height: DESK.height * scale }}>
              <iframe
                src={frameSrc}
                title="Layer explorer — live hero"
                style={{ width: DESK.width, height: DESK.height, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, display: 'block' }}
              />
            </div>
            <p className="mt-2.5 text-lab-xs font-mono text-lab-fg-subtle" aria-live="polite">
              Live desktop hero · real WebGL · {level === 0
                ? 'bare scene: Paper dither, scene motion, default edge'
                : `step ${level} of ${STACK.length} · ${STACK[level - 1].name} added`}
            </p>
          </div>

          {/* Controls — one numbered list: step 0 is the scene, every later
              step adds one setting on top of the steps above it. */}
          <div className="w-full xl:flex-1 xl:min-w-[300px] xl:max-w-[440px] flex flex-col gap-4">
            <section>
              <SectionLabel className="mb-2">Start from</SectionLabel>
              {/* Same pick tiles as the Design Panel's "Start from"; each draws
                  its template's full stack from the template's own values. */}
              <div role="group" aria-label="Template to take apart" className="grid grid-cols-3 gap-1.5">
                {heroTemplates.map((tp) => {
                  const look = stepLook(templateSource(tp), ALL_STEPS)
                  return (
                    <button key={tp.id} type="button" aria-pressed={t.activeTemplate === tp.id} onClick={() => explore(tp.id)} className={`${card} grid gap-1`}>
                      <LivePreview className="w-full aspect-[16/10] rounded-sm" rate={0.6} draw={(ctx, time, W, H, dpr) => drawStep(ctx, time, W, H, dpr, look)} />
                      <span className="truncate px-0.5 text-lab-xs font-medium">{tp.name}</span>
                    </button>
                  )
                })}
              </div>
            </section>
            <div>
              <SectionLabel className="mb-2" action={
                <div className="flex items-center gap-1">
                  <button onClick={() => applyLevel(level - 1)} disabled={level === 0} className={`w-6 h-6 text-lab-md ${smallBtn}`} title="Remove top layer" aria-label="Remove top layer">◀</button>
                  <span className="font-mono tabular-nums text-lab-xs text-lab-fg-subtle w-9 text-center">{level}/{STACK.length}</span>
                  <button onClick={() => applyLevel(level + 1)} disabled={level === STACK.length} className={`w-6 h-6 text-lab-md ${smallBtn}`} title="Add next layer" aria-label="Add next layer">▶</button>
                </div>
              }>Steps — each adds to the output</SectionLabel>
              <div className="flex flex-col gap-2">
                {/* Step 0 — the scene. Always on: the animated Paper dither.
                    Every step's thumbnail is the hero after that step. */}
                <div className="grid grid-cols-[28px_1fr_auto] gap-x-3 items-start p-3 rounded-xl border border-lab-accent/25 bg-lab-accent/5">
                  <span className="mt-0.5 w-6 h-6 grid place-items-center rounded-md bg-lab-accent/15 text-lab-accent font-mono text-lab-xs">0</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 flex-wrap min-h-6">
                      <span className="font-mono text-lab-md text-lab-fg">Scene motion</span>
                      {(!ownMotion || speed !== 1) && (
                        <button onClick={() => applyMotion(t.activeScene, 1)} className={`h-6 px-2 text-lab-xs ${smallBtn}`} title="Back to the template's own motion at Live speed">
                          Template motion
                        </button>
                      )}
                    </span>
                    <span className="block text-lab-sm text-lab-fg-subtle mt-1 leading-snug font-mono">{activeSceneHint}</span>
                  </span>
                  <LivePreview className={thumb} rate={tempo} draw={(ctx, time, W, H, dpr) => drawStep(ctx, time, W, H, dpr, stepLook(t, NO_STEPS))} />
                  <span className="col-start-2 col-span-2 flex flex-col gap-2 mt-2.5 min-w-0">
                    {/* Scrolls on a phone instead of pushing past the card;
                        the padding keeps the focus ring inside the clip. */}
                    <span className="max-w-full overflow-x-auto p-0.5 -m-0.5">
                      <Segmented
                        size="xs"
                        label="Scene"
                        value={s.activeScene}
                        onChange={(id) => applyMotion(id)}
                        options={LAYER_SCENES.map((id) => ({ value: id, label: sceneTemplates[id].label }))}
                      />
                    </span>
                    {/* The Design Panel's Speed control: same stops, labels and field. */}
                    <Segmented
                      size="xs"
                      stretch
                      label="Speed"
                      value={speed}
                      onChange={applySpeed}
                      options={speedStops.map((x) => ({ value: x.value, label: x.label }))}
                    />
                  </span>
                </div>
                {STACK.map((L, i) => {
                  const on = L.on
                  // The newest step in the stack: what the last ◀ ▶ changed.
                  const top = i === level - 1
                  const look = stepLook(t, new Set(STACK.slice(0, i + 1).map((x) => x.id)))
                  return (
                    <div key={L.id}
                      className={`rounded-xl border transition-colors duration-150 ease-out ${
                        top ? 'border-lab-accent/60 bg-lab-accent/5'
                          : on ? 'border-lab-accent/25 bg-lab-accent/5'
                          : 'border-lab-border bg-lab-fill hover:border-lab-border-strong'
                      }`}>
                      {/* A click goes to this step: steps 1…i on, later ones off.
                          Clicking the top step removes it. */}
                      <button onClick={() => applyLevel(top ? i : i + 1)} aria-pressed={on}
                        title={top ? `Remove step ${i + 1}` : `Show steps 0–${i + 1}`}
                        className="w-full grid grid-cols-[28px_1fr_auto] gap-3 items-start text-left p-3 rounded-xl cursor-pointer lab-focus">
                        <span className={`mt-0.5 w-6 h-6 grid place-items-center rounded-md font-mono text-lab-xs transition-colors duration-150 ease-out ${on ? 'bg-lab-accent/15 text-lab-accent' : 'bg-lab-fill text-lab-fg-subtle'}`}>{i + 1}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-lab-md text-lab-fg">{L.name}</span>
                            <span className={`font-mono text-lab-2xs uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border ${verdictStyle[L.verdict]}`}>{L.vlabel}</span>
                          </span>
                          <span className="block text-lab-sm text-lab-fg-subtle mt-1 leading-snug font-mono">{L.value}</span>
                        </span>
                        <LivePreview className={thumb} rate={tempo} draw={(ctx, time, W, H, dpr) => drawStep(ctx, time, W, H, dpr, look)} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {unused.length > 0 && (
              <p className="text-lab-xs font-mono text-lab-fg-subtle leading-relaxed">Not used by this template: {unused.join(' · ')}</p>
            )}
            <p className="text-lab-xs text-lab-fg-subtle leading-relaxed">
              Step the stack with ◀ ▶ (or click a row) to watch each setting compose the final image. Leaving the Layers view restores the template.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
