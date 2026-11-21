import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useDitherStore,
  setShaderConfig,
  setPixelGridConfig,
  setMultiColorConfig,
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
  type DitherState,
  type SceneTemplateId,
} from '../heroes/dither/ditherStore'
import LabToolbarTitle from './LabToolbarTitle'

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

type Verdict = 'core' | 'signature' | 'situational' | 'redundant'
const verdictStyle: Record<Verdict, string> = {
  core: 'text-emerald-300/80 border-emerald-400/30 bg-emerald-400/10',
  signature: 'text-amber-300/80 border-amber-400/30 bg-amber-400/10',
  situational: 'text-sky-300/80 border-sky-400/30 bg-sky-400/10',
  redundant: 'text-rose-300/80 border-rose-400/30 bg-rose-400/10',
}

/** Scenes that look different on the bare base. The store has 11; on this
 *  base the other six repeat one of these: Color Flow, Falling and Sweep are
 *  pans like Gentle Drift; Breath and Breathe spin and pulse like Living;
 *  Error Sweep is a faster Radar. Their extra parts (gap pulse, tile size,
 *  colour cycling) only show with the pixel grid or outside this view, where
 *  stableColorField holds the colour still. The Break-loop modes are left out
 *  for the same reason: Drift, Rotate and Orbit are the pan and spin these
 *  scenes already have, and each scene keeps its own default mode. */
const LAYER_SCENES: { id: SceneTemplateId; moves: string }[] = [
  { id: 'solid-classic', moves: 'shape changes slowly · nothing moves' },
  { id: 'gentle-drift', moves: 'shape changes · field pans' },
  { id: 'living-texture', moves: 'shape changes · field spins and pulses' },
  { id: 'orbit', moves: 'shape changes · field pans and spins' },
  { id: 'radar-scan', moves: 'shape changes · field scans back and forth' },
]

export default function LayerExplorer({ onHome }: { onHome?: () => void }) {
  const s = useDitherStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(0)
  // The template being taken apart, as applied (a store snapshot), so every
  // step can restore that template's own value for its setting.
  const target = useRef<DitherState | null>(null)
  const t = target.current ?? s

  // Without the grid, the shader's own cell size shows. A gridded template
  // keeps a large size (16) that only reads through the grid, so the bare step
  // uses the grid's tile size instead: step 1 then adds the mask and nothing else.
  const bareSize = t.pixelGrid.enabled ? t.pixelGrid.cell / t.pixelGrid.divisions : t.shader.size
  const { topInset: _ti, ...bareEdge } = defaultEdgeConfig
  void _ti
  const textFlow = t.edge.mode === 'full' || t.edge.textBlend
  const tileLabel = t.animation.tileDisplay === 'size' ? 'Mask size' : 'Point sizes'

  // ── The additive stack. `used` = the template has this layer; only used
  //    layers are steps. `on` reads the REAL store so the UI stays truthful. ──
  const ALL: { name: string; value: string; verdict: Verdict; vlabel: string; used: boolean; on: boolean; set: (on: boolean) => void }[] = [
    {
      name: 'Pixel grid', verdict: 'core', vlabel: 'Core',
      value: `${t.pixelGrid.cell}px tile ÷ ${t.pixelGrid.divisions} · gap ${t.pixelGrid.gap} · radius ${t.pixelGrid.radius}`,
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
      name: 'Snap to grid', verdict: 'situational', vlabel: 'Situational',
      value: 'locked — one dot per tile',
      used: t.pixelGrid.enabled && t.pixelGrid.snap,
      on: s.pixelGrid.enabled && s.pixelGrid.snap,
      set: (on) => setPixelGridConfig(on ? { enabled: true, snap: true } : { snap: false }),
    },
    {
      name: tileLabel, verdict: 'core', vlabel: 'Core',
      value: `dots sized by the dither · spread ${t.animation.tileSizeSpread}`,
      used: t.pixelGrid.enabled && t.animation.tileDisplay !== 'color',
      on: s.pixelGrid.enabled && s.animation.tileDisplay === t.animation.tileDisplay,
      set: (on) => {
        if (on && !s.pixelGrid.enabled) setPixelGridConfig({ ...t.pixelGrid })
        setAnimationConfig({ tileDisplay: on ? t.animation.tileDisplay : 'color' })
      },
    },
    {
      name: 'Multi-color', verdict: 'redundant', vlabel: 'Redundant',
      value: `${t.multiColor.colors.length} extra colors · ${t.multiColor.blend}`,
      used: t.multiColor.enabled,
      on: s.multiColor.enabled,
      set: (on) => setMultiColorConfig({ enabled: on }),
    },
    {
      name: 'Scene behind text', verdict: 'core', vlabel: 'Core',
      value: t.edge.mode === 'full'
        ? `fills the hero · flows around each ${t.edge.textRectMode === 'lines' ? 'line' : 'block'} · clearance ${t.edge.fullPadding}px`
        : `flows around copy · clearance ${t.edge.textPadding}px`,
      used: textFlow,
      on: s.edge.mode === t.edge.mode && s.edge.textBlend === t.edge.textBlend,
      set: (on) => {
        const { topInset: _keep, ...edge } = t.edge
        void _keep
        setEdgeConfig(on ? edge : bareEdge)
      },
    },
    {
      name: 'Hover reveal', verdict: 'signature', vlabel: 'Signature',
      value: `${t.hover.mode} · reveals the ${t.initialState === 'problem' ? 'fix (green)' : 'problem (pink)'} · hover the preview`,
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
      setMultiColorConfig({ enabled: false })
      if (tg.edge.mode === 'full' || tg.edge.textBlend) setEdgeConfig(bareEdge)
      setHoverConfig({ enabled: false })
    })
  }
  // On mount: take apart the selected template (Full Bleed if none).
  const restoreId = useRef<string | null>(null)
  useEffect(() => {
    explore(s.activeTemplate ?? heroTemplates[0].id)
    return () => {
      setStableColorField(false)
      if (restoreId.current) applyHeroTemplate(restoreId.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
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

  const activeScene = LAYER_SCENES.find((x) => x.id === s.activeScene)
  const activeSceneHint = activeScene
    ? `${sceneTemplates[activeScene.id].label} · ${activeScene.moves} · speed ${s.shader.speed}`
    : s.activeScene
      ? `${sceneTemplates[s.activeScene].label} · the template's scene · speed ${s.shader.speed}`
      : `the template's own motion · speed ${s.shader.speed}`

  return (
    <div className="h-screen flex flex-col bg-[#0b0c14]">
      <div className="shrink-0 z-10 flex items-center justify-between px-6 py-3 border-b border-white/6 bg-[rgba(11,12,20,0.9)] backdrop-blur-xl">
        <LabToolbarTitle
          onHome={onHome}
          view="Layers"
          strap="one template, taken apart — add its layers back one at a time"
        />
        <div className="flex items-center gap-1.5">
          <button onClick={() => applyLevel(0)} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/25 bg-white/[0.03] cursor-pointer transition-colors">Bare scene</button>
          <button onClick={() => applyLevel(STACK.length)} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/25 bg-white/[0.03] cursor-pointer transition-colors">Full stack</button>
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
            <div className="rounded-xl border border-white/10 overflow-hidden bg-black shadow-[0_16px_48px_rgba(0,0,0,0.5)]" style={{ width: DESK.width * scale, height: DESK.height * scale }}>
              <iframe
                src={frameSrc}
                title="Layer explorer — live hero"
                style={{ width: DESK.width, height: DESK.height, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, display: 'block' }}
              />
            </div>
            <p className="mt-2.5 text-[11px] font-mono text-white/30">
              Live desktop hero · real WebGL · {level === 0 ? 'bare scene (Paper dither + motion)' : `${level} of ${STACK.length} layers stacked`}
            </p>
          </div>

          {/* Controls — one numbered list: step 0 is the scene, every later
              step adds one setting on top of the steps above it. */}
          <div className="w-full xl:flex-1 xl:min-w-[300px] xl:max-w-[440px] flex flex-col gap-4">
            <div role="group" aria-label="Template to take apart" className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/8">
              {heroTemplates.map((tp) => (
                <button
                  key={tp.id}
                  onClick={() => explore(tp.id)}
                  aria-pressed={t.activeTemplate === tp.id}
                  className={`flex-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md cursor-pointer border-0 transition-colors ${
                    t.activeTemplate === tp.id ? 'bg-white/12 text-white/90' : 'bg-transparent text-white/40 hover:text-white/70'
                  }`}
                >{tp.name}</button>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">Steps — each adds to the output</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => applyLevel(Math.max(0, level - 1))} className="w-6 h-6 grid place-items-center rounded-md border border-white/10 text-white/60 hover:text-white hover:border-white/25 cursor-pointer text-[13px]" title="Remove top layer" aria-label="Remove top layer">◀</button>
                  <span className="font-mono text-[11px] text-white/50 w-9 text-center">{level}/{STACK.length}</span>
                  <button onClick={() => applyLevel(Math.min(STACK.length, level + 1))} className="w-6 h-6 grid place-items-center rounded-md border border-white/10 text-white/60 hover:text-white hover:border-white/25 cursor-pointer text-[13px]" title="Add next layer" aria-label="Add next layer">▶</button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {/* Step 0 — the scene. Always on: the animated Paper dither. */}
                <div className="grid grid-cols-[28px_1fr] gap-3 items-start p-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05]">
                  <span className="mt-0.5 w-6 h-6 grid place-items-center rounded-md bg-emerald-400/15 text-emerald-300 font-mono text-[11px]">0</span>
                  <span>
                    <span className="font-mono text-[12.5px] text-white/90">Scene motion</span>
                    <span className="block text-[12px] text-white/45 mt-1 leading-snug font-mono">{activeSceneHint}</span>
                    <span className="flex flex-wrap gap-1 mt-2.5">
                      {LAYER_SCENES.map(({ id }) => (
                        <button
                          key={id}
                          onClick={() => applySceneTemplate(id)}
                          aria-pressed={s.activeScene === id}
                          className={`text-[10px] font-mono py-1 px-1.5 rounded-md border cursor-pointer transition-colors ${
                            s.activeScene === id ? 'bg-white/12 border-white/20 text-white/90' : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/70'
                          }`}
                        >{sceneTemplates[id].label}</button>
                      ))}
                    </span>
                  </span>
                </div>
                {STACK.map((L, i) => {
                  const on = L.on
                  return (
                    <div key={L.name}
                      className={`rounded-xl border transition-colors ${
                        on ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                      }`}>
                      <button onClick={() => batchDitherUpdates(() => L.set(!on))} aria-pressed={on}
                        className="w-full grid grid-cols-[28px_1fr] gap-3 items-start text-left p-3 cursor-pointer">
                        <span className={`mt-0.5 w-6 h-6 grid place-items-center rounded-md font-mono text-[11px] ${on ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.06] text-white/40'}`}>{i + 1}</span>
                        <span>
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[12.5px] text-white/90">{L.name}</span>
                            <span className={`font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border ${verdictStyle[L.verdict]}`}>{L.vlabel}</span>
                          </span>
                          <span className="block text-[12px] text-white/45 mt-1 leading-snug font-mono">{L.value}</span>
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {unused.length > 0 && (
              <p className="text-[11px] font-mono text-white/35 leading-relaxed">Not used by this template: {unused.join(' · ')}</p>
            )}
            <p className="text-[11px] text-white/25 leading-relaxed">
              Step the stack with ◀ ▶ (or click a row) to watch each setting compose the final image. Leaving the Layers view restores the template.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
