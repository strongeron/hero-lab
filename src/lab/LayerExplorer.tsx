import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useDitherStore,
  setAlphaLayer,
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
  setLoopBreak,
  getTabSourceId,
  type LoopBreakMode,
  sceneTemplates,
  sceneTemplateIds,
  type TileDisplayMode,
} from '../heroes/dither/ditherStore'

/** Real-shader layer taxonomy, composed as a progressive STACK.
 *
 *  Opens on the bare scene — the original Paper dithering shader animating with
 *  nothing else applied — then adds one setting at a time so you can read how
 *  each layer changes the final output. Everything drives the real store, so
 *  the live desktop hero (a synced ?preview iframe, actual WebGL) is the truth.
 *  On leaving the view the active template is restored. */

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

export default function LayerExplorer() {
  const s = useDitherStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  // Sticky Break-loop preference for this Layers session. null = follow each
  // scene's own default; once the user picks a mode it persists across scene
  // switches (re-applied atomically after the scene loads). Resets on unmount.
  const stickyLoopBreak = useRef<LoopBreakMode | null>(null)
  const [availW, setAvailW] = useState(0)
  const savedOpacity = useRef<number[]>(s.shader.alphaLayers.map((l) => l.opacity || 0.7))
  s.shader.alphaLayers.forEach((l, i) => { if (l.opacity > 0) savedOpacity.current[i] = l.opacity })

  // ── The additive stack: each step adds one layer. `on` reads the REAL store
  //    so the UI stays truthful even when a renderer auto-enables the grid. ──
  const STACK: { name: string; value: string; verdict: Verdict; vlabel: string; on: boolean; set: (on: boolean) => void }[] = [
    {
      name: 'Pixel grid', verdict: 'core', vlabel: 'Core',
      value: `${s.pixelGrid.cell}px tile ÷ ${s.pixelGrid.divisions} · gap ${s.pixelGrid.gap} · radius ${s.pixelGrid.radius}`,
      on: s.pixelGrid.enabled,
      set: (on) => setPixelGridConfig(on ? { enabled: true } : { enabled: false, snap: false }),
    },
    {
      name: 'Snap to grid', verdict: 'situational', vlabel: 'Situational',
      value: s.pixelGrid.snap ? 'locked — one dot per tile' : 'free — dither flows',
      on: s.pixelGrid.snap,
      // Snap needs the grid — enabling it turns the grid on too.
      set: (on) => setPixelGridConfig(on ? { enabled: true, snap: true } : { snap: false }),
    },
    {
      name: 'Multi-color', verdict: 'redundant', vlabel: 'Redundant',
      value: `${s.multiColor.colors.length} extra colors · ${s.multiColor.blend}`,
      on: s.multiColor.enabled,
      set: (on) => setMultiColorConfig({ enabled: on }),
    },
    {
      name: 'Scene behind text', verdict: 'core', vlabel: 'Core',
      value: `flows around copy · clearance ${s.edge.textPadding}px`,
      on: s.edge.textBlend,
      set: (on) => setEdgeConfig({ textBlend: on }),
    },
    {
      name: 'Hover reveal', verdict: 'signature', vlabel: 'Signature',
      value: `${s.hover.mode} · reveals the ${s.initialState === 'problem' ? 'fix (green)' : 'problem (pink)'} · hover the preview`,
      on: s.hover.enabled,
      // Warp reveal warps pixel-grid tiles — it needs the grid on to do anything.
      set: (on) => { if (on && !s.pixelGrid.enabled) setPixelGridConfig({ enabled: true }); setHoverConfig({ enabled: on }) },
    },
  ]
  // Level = how many leading stack layers are on (for the stepper display).
  const level = (() => { let n = 0; for (const L of STACK) { if (L.on) n++; else break } return n })()

  // Strip every "overflow" setting down to a clean, fine, animated Paper dither.
  // Cell Size (px) is the key: large size + no grid = coarse checkerboard, so we
  // pin a small size and a mid scale for a proper fine dither at rest.
  function toBaseline() {
    batchDitherUpdates(() => {
      s.shader.alphaLayers.forEach((l, i) => { if (l.opacity <= 0) setAlphaLayer(i, { opacity: savedOpacity.current[i] }) })
      setShaderConfig({ size: 2, scale: 0.6 })
      setPixelGridConfig({ enabled: false, snap: false })
      setMultiColorConfig({ enabled: false })
      setHoverConfig({ enabled: false })
      setEdgeConfig({ textBlend: false })
      setAnimationConfig({ playing: true, tileDisplay: 'color' })
      if (!s.activeScene) applySceneTemplate('gentle-drift')
    })
  }
  function applyLevel(lv: number) {
    batchDitherUpdates(() => STACK.forEach((L, i) => L.set(i < lv)))
  }
  // Full reset to the clean bare scene: re-pins the fine dither + a scene AND
  // strips every stack layer, so it can never land on the broken coarse state.
  function resetBare() {
    batchDitherUpdates(() => {
      setShaderConfig({ size: 2, scale: 0.6 })
      setPixelGridConfig({ enabled: false, snap: false })
      setMultiColorConfig({ enabled: false })
      setHoverConfig({ enabled: false })
      setEdgeConfig({ textBlend: false })
      setAnimationConfig({ playing: true, tileDisplay: 'color' })
      if (!s.activeScene) applySceneTemplate('gentle-drift')
    })
  }
  // Renderer switch — Mask/Points require the grid, so pick them WITH the grid on.
  function setRenderer(id: TileDisplayMode) {
    batchDitherUpdates(() => {
      if (id !== 'color' && !s.pixelGrid.enabled) setPixelGridConfig({ enabled: true })
      setAnimationConfig({ tileDisplay: id })
    })
  }

  // On mount: capture the template to restore, drop to bare scene.
  const restoreId = useRef<string | null>(null)
  useEffect(() => {
    restoreId.current = s.activeTemplate
    // Always explore from Fine Grain, whatever template is selected elsewhere.
    // The stack is meant to read as "one setting at a time"; Full Bleed and
    // Problem already ship a pixel grid, wide gaps and a tile renderer, so
    // starting there means the first few steps toggle settings that are
    // visually already on and the progression stops teaching anything. Fine
    // Grain is the bare shader, so each step is the only thing that changes.
    applyHeroTemplate('fine-grain')
    // Calm the screen-blended Color/alpha base while exploring layers — see
    // DitherState.stableColorField. Scoped to this view: cleared on leaving so
    // Live and Templates keep their colour shimmer.
    setStableColorField(true)
    toBaseline()
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

  // Two clear renderers for exploration: the flat dither field vs size-modulated
  // dots. 'Mask size' is intentionally omitted here — it produces the same
  // size-modulated-dot look as Point sizes but the expensive, flicker-prone way
  // (a 12fps async blob mask over the screen-blended WebGL layers). It stays
  // available in the Design Panel on the Live tab for anyone who wants it.
  const loopBreakModes: { id: LoopBreakMode; label: string; hint: string }[] = [
    { id: 'none', label: 'Off', hint: 'Scene loops as authored' },
    { id: 'drift', label: 'Drift', hint: 'Pans continuously' },
    { id: 'rotate', label: 'Rotate', hint: 'Spins the field — never repeats' },
    { id: 'orbit', label: 'Orbit', hint: 'Pan + spin' },
    { id: 'wander', label: 'Wander', hint: 'Organic, slowly-turning drift — random feel' },
  ]
  const tileModes: { id: TileDisplayMode; label: string }[] = [
    { id: 'color', label: 'Color / alpha' },
    { id: 'points', label: 'Point sizes' },
  ]
  const activeSceneLabel = s.activeScene ? sceneTemplates[s.activeScene].label : 'none'

  return (
    <div className="h-screen flex flex-col bg-[#0b0c14]">
      <div className="shrink-0 z-10 flex items-center justify-between px-6 py-3 border-b border-white/6 bg-[rgba(11,12,20,0.9)] backdrop-blur-xl">
        {/* `min-w-0` + `nowrap` so the strap line truncates instead of wrapping:
            without it a narrow viewport turns this row into a four-line column
            and shoves the whole canvas down the page. The strap is context, not
            navigation, so it's the first thing to go when space is short. */}
        <span className="text-[12px] font-semibold text-white/90 flex items-baseline gap-2 min-w-0 whitespace-nowrap">
          Hero Lab
          <span className="font-normal text-white/45">Layers</span>
          <span className="hidden lg:inline font-normal text-white/25 truncate">bare scene first — stack one setting at a time on the real shader</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={resetBare} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/25 bg-white/[0.03] cursor-pointer transition-colors">Bare scene</button>
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

          {/* Controls */}
          <div className="w-full xl:flex-1 xl:min-w-[300px] xl:max-w-[440px] flex flex-col gap-4">

            {/* Base: scene picker (the animated dither is the foundation) */}
            <div>
              <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40 mb-2">Base · animated Paper dither</h3>
              <div className="p-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12.5px] text-white/90">Scene motion</span>
                  <span className="font-mono text-[11px] text-emerald-300/80">{activeSceneLabel}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {sceneTemplateIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => batchDitherUpdates(() => {
                        applySceneTemplate(id)
                        // Re-apply the user's Break-loop preference so it sticks
                        // across scene switches (one atomic update → no flash).
                        if (stickyLoopBreak.current !== null) setLoopBreak(stickyLoopBreak.current)
                      })}
                      className={`text-[10px] font-mono py-1 px-1.5 rounded-md border cursor-pointer transition-all ${
                        s.activeScene === id ? 'bg-white/12 border-white/20 text-white/90' : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/70'
                      }`}
                    >{sceneTemplates[id].label}</button>
                  ))}
                </div>

                {/* Break loop — non-repeating motion layered on the scene, so
                    the initial movement never settles into an obvious cycle.
                    Wander is the organic/random one. Keeps the scene selected. */}
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11.5px] text-white/70">Break loop</span>
                    <span className="font-mono text-[10px] text-white/30">keeps motion from repeating</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {loopBreakModes.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { stickyLoopBreak.current = m.id; setLoopBreak(m.id) }}
                        title={m.hint}
                        className={`text-[10px] font-mono py-1 px-1.5 rounded-md border cursor-pointer transition-all ${
                          s.animation.loopBreak === m.id ? 'bg-white/12 border-white/20 text-white/90' : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/70'
                        }`}
                      >{m.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tile renderer (swaps the base renderer, not additive) */}
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[12.5px] text-white/90">Base renderer</span>
                <span className={`font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border ${verdictStyle.core}`}>Core</span>
              </span>
              <span className="block text-[12px] text-white/45 mt-1 mb-2 leading-snug">Color/alpha is the real Paper shader. Points is our own dot renderer (needs grid).</span>
              <div className="flex gap-1">
                {tileModes.map((m) => (
                  <button key={m.id} onClick={() => setRenderer(m.id)}
                    className={`flex-1 text-[10.5px] font-mono py-1.5 px-2 rounded-md border cursor-pointer transition-all ${
                      s.animation.tileDisplay === m.id ? 'bg-white/12 border-white/20 text-white/90' : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/70'
                    }`}>{m.label}</button>
                ))}
              </div>
            </div>

            {/* The additive stack */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">Stack — each adds to the output</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => applyLevel(Math.max(0, level - 1))} className="w-6 h-6 grid place-items-center rounded-md border border-white/10 text-white/60 hover:text-white hover:border-white/25 cursor-pointer text-[13px]" title="Remove top layer">◀</button>
                  <span className="font-mono text-[11px] text-white/50 w-9 text-center">{level}/{STACK.length}</span>
                  <button onClick={() => applyLevel(Math.min(STACK.length, level + 1))} className="w-6 h-6 grid place-items-center rounded-md border border-white/10 text-white/60 hover:text-white hover:border-white/25 cursor-pointer text-[13px]" title="Add next layer">▶</button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {/* base row — always present */}
                <div className="grid grid-cols-[28px_1fr] gap-3 items-start p-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05]">
                  <span className="mt-0.5 w-6 h-6 grid place-items-center rounded-md bg-emerald-400/15 text-emerald-300 font-mono text-[11px]">0</span>
                  <span>
                    <span className="font-mono text-[12.5px] text-white/90">Bare dither + scene</span>
                    <span className="block text-[12px] text-white/45 mt-1 leading-snug">Paper shader, {s.shader.type} · speed {s.shader.speed} · the foundation everything stacks on.</span>
                  </span>
                </div>
                {STACK.map((L, i) => {
                  const on = L.on
                  return (
                    <button key={L.name} onClick={() => batchDitherUpdates(() => L.set(!on))}
                      className={`grid grid-cols-[28px_1fr] gap-3 items-start text-left p-3 rounded-xl border cursor-pointer transition-all ${
                        on ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                      }`}>
                      <span className={`mt-0.5 w-6 h-6 grid place-items-center rounded-md font-mono text-[11px] ${on ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.06] text-white/40'}`}>{i + 1}</span>
                      <span>
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[12.5px] text-white/90">{L.name}</span>
                          <span className={`font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border ${verdictStyle[L.verdict]}`}>{L.vlabel}</span>
                        </span>
                        <span className="block text-[12px] text-white/45 mt-1 leading-snug font-mono">{L.value}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="text-[11px] text-white/25 leading-relaxed">
              Step the stack with ◀ ▶ (or click a row) to watch each setting compose the final image. Leaving the Layers view restores your template.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
