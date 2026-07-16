import { useState } from 'react'
import {
  useDitherStore,
  setHeaderBg,
  setShaderConfig,
  setEdgeConfig,
  setHoverConfig,
  setHoverLayer,
  setInitialState,
  setMultiColorConfig,
  setMultiColorAt,
  setPixelGridConfig,
  setAlphaLayer,
  setAnimationConfig,
  setHapticConfig,
  applySceneTemplate,
  sceneTemplates,
  sceneTemplateIds,
  setCopyVariant,
  setCopyFont,
  setLayoutConfig,
  setWtfTitlePos,
  resetWtfTitlePositions,
  defaultWtfTitlePositions,
  resetDither,
  defaultShaderConfig,
  defaultEdgeConfig,
  defaultHoverConfig,
  defaultMultiColorConfig,
  defaultPixelGridConfig,
  defaultAnimationConfig,
  defaultHapticConfig,
  copyVariants,
  copyVariantIds,
  type DitheringShape,
  type DitheringType,
  type ShaderFit,
  type HeaderBgMode,
  type EdgeMode,
  type HapticPresetId,
  type ScanMode,
  type TileDisplayMode,
  type WtfTitlePositions,
} from './ditherStore'

const SHAPES: DitheringShape[] = ['simplex', 'warp', 'dots', 'wave', 'ripple', 'swirl', 'sphere']
const TYPES: DitheringType[] = ['random', '2x2', '4x4', '8x8']
const FITS: ShaderFit[] = ['none', 'contain', 'cover']
const EDGE_MODES: { value: EdgeMode; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'ripple', label: 'Ripple' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'fade', label: 'Fade' },
  { value: 'overlap', label: 'Overlap' },
]
const HEADER_MODES: { value: HeaderBgMode; label: string }[] = [
  { value: 'transparent', label: 'Transparent' },
  { value: 'solid', label: 'Solid' },
]
const HAPTIC_PRESETS: HapticPresetId[] = ['selection', 'light', 'medium', 'heavy', 'soft', 'rigid', 'nudge']

const pill = (active: boolean) =>
  `text-[10px] font-medium py-1 px-2 rounded-md cursor-pointer border transition-all ${
    active
      ? 'bg-white/10 border-white/15 text-white/80'
      : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50 hover:bg-white/[0.06]'
  }`

const sliderClass =
  'w-full h-1 rounded bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-400'

const TILE_SIZE_EFFECT_STRENGTH = 0.65
const TILE_SIZE_MIN_VALUE = 0.18

/** Match DitherHero pixelGridMetrics + the bounded tile-size warp field. */
function tileSizeRangeFromGrid(pg: { cell: number; divisions: number; gap: number }, spread: number) {
  const pitch = Math.max(2, Math.round(pg.cell / Math.max(1, pg.divisions)))
  const gap = Math.max(0, Math.min(Math.round(pg.gap), pitch - 1))
  const maxPiece = pitch - gap
  const minScale = spread <= 0
    ? 1
    : Math.max(gap / Math.max(1, maxPiece), 1 - Math.min(1, spread))
  const visibleMinScale = minScale + (1 - minScale) * TILE_SIZE_MIN_VALUE
  return { pitch, gap, maxPiece, minPiece: Math.round(maxPiece * visibleMinScale * 10) / 10 }
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-white/40">{label}</span>
        <span className="text-[9px] text-white/50 font-mono">
          {value}{suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={sliderClass}
      />
    </div>
  )
}

export default function DitherPanel() {
  const state = useDitherStore()
  const c = state.shader
  const [copied, setCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [showFineTune, setShowFineTune] = useState(false)

  const e = state.edge
  const h = state.hover
  const mc = state.multiColor
  const pg = state.pixelGrid
  const a = state.animation
  const hap = state.haptic
  const hasChanges =
    state.headerBg !== 'solid' ||
    state.copyVariant !== 'provocateur' ||
    JSON.stringify(c) !== JSON.stringify(defaultShaderConfig) ||
    JSON.stringify(e) !== JSON.stringify(defaultEdgeConfig) ||
    JSON.stringify(h) !== JSON.stringify(defaultHoverConfig) ||
    JSON.stringify(mc) !== JSON.stringify(defaultMultiColorConfig) ||
    JSON.stringify(pg) !== JSON.stringify(defaultPixelGridConfig) ||
    JSON.stringify(a) !== JSON.stringify(defaultAnimationConfig) ||
    JSON.stringify(hap) !== JSON.stringify(defaultHapticConfig)

  function copySettings() {
    // Full state of every section the user can tweak — paste back to reproduce
    // an exact config (shader + layers + edge + hover + animation + scene + state).
    const config = {
      _ditherConfig: 1,
      initialState: state.initialState,
      headerBg: state.headerBg,
      copyVariant: state.copyVariant,
      activeScene: state.activeScene,
      terminalTheme: state.terminalTheme,
      shader: c,
      edge: e,
      hover: h,
      multiColor: mc,
      pixelGrid: pg,
      animation: a,
      layout: state.layout,
      haptic: hap,
    }
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function exportCode() {
    const copy = copyVariants[state.copyVariant]
    const typoLines: string[] = []

    // Typography overrides for current copy variant
    if (copy.headlineFont) typoLines.push(`      headlineFont: ${JSON.stringify(copy.headlineFont)},`)
    if (copy.headlineWeight && copy.headlineWeight !== 900) typoLines.push(`      headlineWeight: ${copy.headlineWeight},`)
    if (copy.headlineSize) typoLines.push(`      headlineSize: ${JSON.stringify(copy.headlineSize)},`)
    if (copy.headlineTracking && copy.headlineTracking !== '-0.03em') typoLines.push(`      headlineTracking: ${JSON.stringify(copy.headlineTracking)},`)
    if (copy.headlineLeading && copy.headlineLeading !== '0.95') typoLines.push(`      headlineLeading: ${JSON.stringify(copy.headlineLeading)},`)
    if (copy.headlineColorMode && copy.headlineColorMode !== 'current') typoLines.push(`      headlineColorMode: ${JSON.stringify(copy.headlineColorMode)},`)
    if (copy.responseFont) typoLines.push(`      responseFont: ${JSON.stringify(copy.responseFont)},`)
    if (copy.responseSize && copy.responseSize !== '48px') typoLines.push(`      responseSize: ${JSON.stringify(copy.responseSize)},`)
    if (copy.responseLeading && copy.responseLeading !== '1.1') typoLines.push(`      responseLeading: ${JSON.stringify(copy.responseLeading)},`)
    if (copy.responseColorMode && copy.responseColorMode !== 'current') typoLines.push(`      responseColorMode: ${JSON.stringify(copy.responseColorMode)},`)

    const layoutLines = [
      `// defaultLayoutConfig`,
      `  headlineCols: ${state.layout.headlineCols},`,
      `  responseCols: ${state.layout.responseCols},`,
      `  gutter: ${state.layout.gutter},`,
    ]

    const lines = [
      `// Copy variant: "${state.copyVariant}" — typography overrides`,
      ...(typoLines.length ? typoLines : ['      // (no overrides — all defaults)']),
      ``,
      ...layoutLines,
    ]

    navigator.clipboard.writeText(lines.join('\n'))
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  return (
    <div className="border-b border-white/6">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
          Dither
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCode}
            className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
              codeCopied
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
            }`}
          >
            {codeCopied ? 'Exported!' : 'Export'}
          </button>
          <button
            onClick={copySettings}
            className="text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
          >
            {copied ? 'Copied!' : 'Copy Config'}
          </button>
          {hasChanges && (
            <button
              onClick={resetDither}
              className="text-[9px] font-medium text-red-400/50 hover:text-red-400 cursor-pointer bg-transparent border-0 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 space-y-3">
        {/* ══ GROUP: SCENE ══ */}
        <div className="pt-2 pb-1 mt-1 border-t border-white/10">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-emerald-400/70">Scene</span>
        </div>

        {/* ─── Initial State (Problem ⇄ Fix) ─── */}
        <div className="space-y-1">
          <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 block">
            Initial State
          </span>
          <div className="flex gap-1.5">
            {([
              { value: 'problem' as const, label: 'Problem', sub: 'pink · at rest' },
              { value: 'fix' as const, label: 'Fix', sub: 'green · at rest' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInitialState(opt.value)}
                className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer border transition-all text-left ${
                  state.initialState === opt.value
                    ? 'bg-white/10 border-white/15'
                    : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06]'
                }`}
              >
                <span className={`text-[10px] font-medium block ${state.initialState === opt.value ? 'text-white/80' : 'text-white/40'}`}>
                  {opt.label}
                </span>
                <span className="text-[8px] text-white/25 block">{opt.sub}</span>
              </button>
            ))}
          </div>
          <p className="text-[8px] text-white/25 leading-relaxed">
            Visible at rest. The other state becomes the hover reveal.
          </p>
        </div>

        {/* ─── Dithering Shader ─── */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[9px] font-semibold tracking-wide uppercase text-emerald-400/60">
            Dithering Shader · the resting effect
          </span>
          <button
            onClick={copySettings}
            className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
              copied
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
            }`}
            title="Copy the full config (all sections) as JSON to paste back"
          >
            {copied ? 'Copied!' : 'Copy Config'}
          </button>
        </div>
        <p className="text-[8px] text-white/25 leading-relaxed">This controls what you see by default. <span className="text-white/40">Shape</span> = click the name on each Alpha Layer below · <span className="text-white/40">Cell Size</span> + <span className="text-white/40">Scale</span> size it.</p>

        {/* Back color + Alpha toggle */}
        <label className="space-y-1">
          <span className="text-[9px] text-white/40 block">Back</span>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={c.colorBack}
              onChange={(e) => setShaderConfig({ colorBack: e.target.value })}
              className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
            />
            <span className="text-[9px] text-white/50 font-mono">{c.colorBack}</span>
            <button
              onClick={() => setShaderConfig({ transparentBg: !c.transparentBg })}
              className={`text-[8px] font-medium py-0.5 px-1.5 rounded cursor-pointer border transition-all ml-auto ${
                c.transparentBg
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                  : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
              }`}
              title="Make shader background transparent — dots float over section bg"
            >
              {c.transparentBg ? 'Alpha' : 'Solid'}
            </button>
          </div>
        </label>

        {c.transparentBg ? (
          <div className="space-y-2">
            <span className="text-[9px] text-white/40 block">Alpha Layers</span>
            {c.alphaLayers.map((layer, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={layer.color}
                  onChange={(ev) => setAlphaLayer(i, { color: ev.target.value })}
                  className="w-4 h-4 rounded border border-white/10 cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
                />
                <button
                  onClick={() => {
                    const idx = SHAPES.indexOf(layer.shape)
                    setAlphaLayer(i, { shape: SHAPES[(idx + 1) % SHAPES.length] })
                  }}
                  className="text-[9px] text-white/40 hover:text-white/60 cursor-pointer bg-transparent border-0 w-12 text-left transition-colors"
                  title="Click to cycle shape"
                >
                  {layer.shape}
                </button>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={layer.opacity}
                  onChange={(ev) => setAlphaLayer(i, { opacity: parseFloat(ev.target.value) })}
                  className="flex-1 h-1 rounded bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-400"
                />
                <span className="text-[8px] text-white/40 font-mono w-6 text-right">{layer.opacity}</span>
              </div>
            ))}
            <Slider label="Color Cycle" value={c.colorCycleSpeed} min={0} max={2} step={0.05} onChange={(v) => setShaderConfig({ colorCycleSpeed: v })} />
          </div>
        ) : (
          <label className="space-y-1">
            <span className="text-[9px] text-white/40 block">Front</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={c.colorFront}
                onChange={(e) => setShaderConfig({ colorFront: e.target.value })}
                className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
              />
              <span className="text-[9px] text-white/50 font-mono">{c.colorFront}</span>
            </div>
          </label>
        )}

        {/* Shape — hidden in alpha mode (each layer has its own shape) */}
        {!c.transparentBg && (
          <div className="space-y-1">
            <span className="text-[9px] text-white/40 block">Shape</span>
            <div className="flex flex-wrap gap-1">
              {SHAPES.map((s) => (
                <button key={s} onClick={() => setShaderConfig({ shape: s })} className={pill(c.shape === s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Type */}
        <div className="space-y-1">
          <span className="text-[9px] text-white/40 block">Type</span>
          <div className="flex gap-1">
            {TYPES.map((t) => (
              <button key={t} onClick={() => setShaderConfig({ type: t })} className={pill(c.type === t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Size — merged into Pixel Grid Tile Size when the grid is locked */}
        {pg.enabled && pg.snap ? (
          <p className="text-[8px] text-emerald-400/40 leading-relaxed">
            Cell Size is locked to <span className="text-emerald-400/70">Pixel Grid → Tile Size</span> (one dot per tile). Adjust it there.
          </p>
        ) : (
          <Slider label="Cell Size" value={c.size} min={0.5} max={20} step={0.5} onChange={(v) => setShaderConfig({ size: v })} />
        )}

        {/* ─── Motion ─── */}
        <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 block pt-1">
          Motion
        </span>

        <Slider label="Speed" value={c.speed} min={0} max={2} step={0.05} onChange={(v) => setShaderConfig({ speed: v })} />
        <Slider label="Frame" value={c.frame} min={0} max={100} step={0.5} onChange={(v) => setShaderConfig({ frame: v })} />

        {/* ─── Sizing ─── */}
        <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 block pt-1">
          Sizing
        </span>

        {/* Fit */}
        <div className="space-y-1">
          <span className="text-[9px] text-white/40 block">Fit</span>
          <div className="flex gap-1">
            {FITS.map((f) => (
              <button key={f} onClick={() => setShaderConfig({ fit: f })} className={pill(c.fit === f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <Slider label="Scale" value={c.scale} min={0.01} max={4} step={0.05} onChange={(v) => setShaderConfig({ scale: v })} />
        <Slider label="Rotation" value={c.rotation} min={0} max={360} step={1} suffix="°" onChange={(v) => setShaderConfig({ rotation: v })} />
        <Slider label="Offset X" value={c.offsetX} min={-1} max={1} step={0.05} onChange={(v) => setShaderConfig({ offsetX: v })} />
        <Slider label="Offset Y" value={c.offsetY} min={-1} max={1} step={0.05} onChange={(v) => setShaderConfig({ offsetY: v })} />
        <Slider label="Origin X" value={c.originX} min={0} max={1} step={0.05} onChange={(v) => setShaderConfig({ originX: v })} />
        <Slider label="Origin Y" value={c.originY} min={0} max={1} step={0.05} onChange={(v) => setShaderConfig({ originY: v })} />
        <Slider label="World Width" value={c.worldWidth} min={0.1} max={10} step={0.1} onChange={(v) => setShaderConfig({ worldWidth: v })} />
        <Slider label="World Height" value={c.worldHeight} min={0.1} max={10} step={0.1} onChange={(v) => setShaderConfig({ worldHeight: v })} />

        {/* ─── Pixel Grid (mosaic mask) ─── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40">
              Pixel Grid
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={copySettings}
                className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                  copied
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
                }`}
                title="Copy the full config (pixel grid + edge + everything) as JSON to paste back later"
              >
                {copied ? 'Copied!' : 'Copy Config'}
              </button>
              <button
                onClick={() => setPixelGridConfig({ enabled: !pg.enabled })}
                className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                  pg.enabled
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                }`}
              >
                {pg.enabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
          {pg.enabled && (
            <div className="space-y-2">
              {(() => {
                const piece = Math.max(2, Math.round(pg.cell / Math.max(1, pg.divisions)))
                return (
                  <p className="text-[8px] text-white/25 leading-relaxed">
                    <span className="text-white/45">Tile {pg.cell}px ÷ {pg.divisions}</span> = {piece}px pieces. <span className="text-white/45">Gap</span> splits each piece. Pieces always tile the master exactly.
                  </p>
                )
              })()}
              {/* Snap — lock dither to the tile grid for clean cuts */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Snap to dither</span>
                <button
                  onClick={() => setPixelGridConfig({ snap: !pg.snap })}
                  className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                    pg.snap
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                      : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                  }`}
                >
                  {pg.snap ? 'On' : 'Off'}
                </button>
              </div>
              <p className="text-[8px] text-white/25 leading-relaxed">
                {pg.snap
                  ? 'Axis-aligns the dither and sizes one dot per tile — clean edges. Use Align to phase-lock onto the dots.'
                  : 'Off = free overlay (tiles cut across the dither — ragged edges).'}
              </p>
              <Slider label="Tile Size" value={pg.cell} min={8} max={160} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ cell: v })} />
              <Slider label="Divide into" value={pg.divisions} min={1} max={8} step={1} suffix=" pcs" onChange={(v) => setPixelGridConfig({ divisions: v })} />
              <Slider label="Gap" value={pg.gap} min={0} max={Math.max(1, Math.round(pg.cell / Math.max(1, pg.divisions)) - 1)} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ gap: v })} />
              <Slider label="Corner Radius" value={pg.radius} min={0} max={40} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ radius: v })} />
              {pg.snap && (
                <>
                  <Slider label="Align X" value={pg.alignX} min={0} max={Math.round(pg.cell / Math.max(1, pg.divisions))} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ alignX: v })} />
                  <Slider label="Align Y" value={pg.alignY} min={0} max={Math.round(pg.cell / Math.max(1, pg.divisions))} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ alignY: v })} />
                </>
              )}
              <span className="text-[9px] text-white/40 block pt-1">Tile animation</span>
              <div className="flex flex-wrap gap-1">
                {([
                  { value: 'color' as TileDisplayMode, label: 'Color / alpha' },
                  { value: 'size' as TileDisplayMode, label: 'Mask size' },
                  { value: 'points' as TileDisplayMode, label: 'Point sizes' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAnimationConfig({ tileDisplay: opt.value })}
                    className={pill(a.tileDisplay === opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {a.tileDisplay !== 'color' && (() => {
                const r = tileSizeRangeFromGrid(pg, a.tileSizeSpread * TILE_SIZE_EFFECT_STRENGTH)
                return (
                <>
                  <p className="text-[8px] text-white/25 leading-relaxed">
                    {a.tileDisplay === 'points'
                      ? `Direct point renderer: ${r.pitch}px pitch, ${r.gap}px gap -> visible pieces ${r.minPiece}-${r.maxPiece}px.`
                      : `Shader mask: ${r.pitch}px pitch, ${r.gap}px gap -> visible pieces ${r.minPiece}-${r.maxPiece}px.`}
                  </p>
                  <Slider label="Size spread" value={a.tileSizeSpread} min={0} max={1} step={0.05} onChange={(v) => setAnimationConfig({ tileSizeSpread: v })} />
                  <Slider label="Size speed" value={a.tileSizeSpeed} min={0.02} max={0.3} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ tileSizeSpeed: v })} />
                  <Slider label="Map scale" value={a.tileSizeNoise} min={0.4} max={3} step={0.1} onChange={(v) => setAnimationConfig({ tileSizeNoise: v })} />
                </>
                )
              })()}
            </div>
          )}
        </div>

        {/* ─── Multi-Color Errors ─── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40">
              Multi-Color
            </span>
            <button
              onClick={() => setMultiColorConfig({ enabled: !mc.enabled })}
              className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                mc.enabled
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                  : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
              }`}
            >
              {mc.enabled ? 'On' : 'Off'}
            </button>
          </div>
          {mc.enabled && (
            <div className="space-y-2">
              {/* Color swatches */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Error Colors</span>
                <div className="flex items-center gap-1.5">
                  {mc.colors.map((color, i) => (
                    <label key={i} className="flex items-center gap-1">
                      <input
                        type="color"
                        value={color}
                        onChange={(ev) => setMultiColorAt(i, ev.target.value)}
                        className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
                      />
                    </label>
                  ))}
                  <span className="text-[9px] text-white/30 ml-1">+ base</span>
                </div>
              </div>
              <Slider label="Layer Spread" value={mc.layerSpread} min={0.02} max={0.5} step={0.01} onChange={(v) => setMultiColorConfig({ layerSpread: v })} />
              {/* Blend mode */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Blend</span>
                <div className="flex flex-wrap gap-1">
                  {(['normal', 'screen', 'multiply', 'overlay'] as const).map((b) => (
                    <button key={b} onClick={() => setMultiColorConfig({ blend: b })} className={pill(mc.blend === b)}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Edge ─── */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 block pt-1">
            Section Edge
          </span>
          <div className="flex flex-wrap gap-1">
            {EDGE_MODES.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEdgeConfig({ mode: opt.value })}
                className={`text-[10px] font-medium py-1.5 px-2.5 rounded-lg cursor-pointer border transition-all ${
                  e.mode === opt.value
                    ? 'bg-white/10 border-white/15 text-white/80'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50 hover:bg-white/[0.06]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {e.mode !== 'full' && (
            <Slider label="Position" value={e.position} min={30} max={95} step={1} suffix="%" onChange={(v) => setEdgeConfig({ position: v })} />
          )}
          <Slider label="Top start" value={e.topInset} min={0} max={160} step={4} suffix="px" onChange={(v) => setEdgeConfig({ topInset: v })} />
          <p className="text-[8px] text-white/25 leading-relaxed">
            Places the whole field — the first row starts exactly at this line and every row
            shifts with it (whole shapes, never cut by the header). ~77px clears the nav.
          </p>
          {e.mode === 'full' && (
            <>
              <p className="text-[8px] text-white/25 leading-relaxed">
                Fills the whole hero with shapes and flows around the headline, copy, and CTAs —
                whole tiles only (never cut), with a dissolve rim at each text block. Works with
                the <span className="text-white/45">Point sizes</span> tile animation.
              </p>
              <Slider label="Text padding" value={e.fullPadding} min={8} max={72} step={2} suffix="px" onChange={(v) => setEdgeConfig({ fullPadding: v })} />
              <Slider label="Rim depth" value={e.dissolveDepth} min={1} max={20} step={1} suffix=" rows" onChange={(v) => setEdgeConfig({ dissolveDepth: v })} />
              <Slider label="Rim motion" value={e.textBlendMotion} min={0} max={1} step={0.05} onChange={(v) => setEdgeConfig({ textBlendMotion: v })} />
              {e.textBlendMotion > 0 && (
                <Slider label="Motion speed" value={e.textBlendSpeed} min={0.02} max={0.4} step={0.01} suffix=" Hz" onChange={(v) => setEdgeConfig({ textBlendSpeed: v })} />
              )}
              <button
                onClick={() => setEdgeConfig({ dissolveSeed: e.dissolveSeed + 1 })}
                className="text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
                title="Reshuffle which rim tiles drop out"
              >
                Reshuffle
              </button>
            </>
          )}
          {(e.mode === 'dissolve' || e.mode === 'overlap') && (
            <>
              <Slider
                label="Section extend"
                value={e.shaderExtend}
                min={0}
                max={600}
                step={8}
                suffix="px"
                onChange={(v) => setEdgeConfig({
                  shaderExtend: v,
                  ...(v > 0 && !e.textBlend ? { textBlend: true } : {}),
                })}
              />
              <p className="text-[8px] text-white/25 leading-relaxed">
                Controls how far the scene can overflow below Position into the copy area. Point sizes fade and dissolve as they enter text.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] text-white/40">Scene behind text</span>
                <button
                  onClick={() => setEdgeConfig({
                    textBlend: !e.textBlend,
                    ...(!e.textBlend && e.shaderExtend === 0 ? { shaderExtend: 160 } : {}),
                  })}
                  className={pill(e.textBlend)}
                >
                  {e.textBlend ? 'On' : 'Off'}
                </button>
              </div>
              <p className="text-[8px] text-white/25 leading-relaxed">
                {e.textBlend
                  ? 'Transparent text bg — extended dots can pass behind the headline with edge falloff.'
                  : 'Solid text bg hides tiles underneath. Turn on to see the extended shader.'}
              </p>
            </>
          )}
          {e.mode === 'dissolve' && (
            <>
              <p className="text-[8px] text-white/25 leading-relaxed">
                Tiles drop out near the edge and through the text overflow — an organic blend instead of a straight line.
              </p>
              <Slider label="Dissolve Depth" value={e.dissolveDepth} min={1} max={20} step={1} suffix=" rows" onChange={(v) => setEdgeConfig({ dissolveDepth: v })} />
              <Slider label="Dissolve motion" value={e.textBlendMotion} min={0} max={1} step={0.05} onChange={(v) => setEdgeConfig({ textBlendMotion: v })} />
              {e.textBlendMotion > 0 && (
                <Slider label="Motion speed" value={e.textBlendSpeed} min={0.02} max={0.4} step={0.01} suffix=" Hz" onChange={(v) => setEdgeConfig({ textBlendSpeed: v })} />
              )}
              <button
                onClick={() => setEdgeConfig({ dissolveSeed: e.dissolveSeed + 1 })}
                className="text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
                title="Reshuffle which tiles drop out"
              >
                Reshuffle
              </button>
            </>
          )}
          {e.mode === 'ripple' && (
            <>
              {/* Dither — dissolve the wave edge (Photoshop-style) */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Dither edge</span>
                <button
                  onClick={() => setEdgeConfig({ rippleDither: !e.rippleDither })}
                  className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                    e.rippleDither
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                      : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                  }`}
                >
                  {e.rippleDither ? 'On' : 'Off'}
                </button>
              </div>
              <p className="text-[8px] text-white/25 leading-relaxed">
                {e.rippleDither
                  ? 'Wave dissolves into scattered tiles (white→black threshold dither). Use Depth + Reshuffle below.'
                  : 'Hard wave edge. Turn on Pixelate for a blocky tile-wave.'}
              </p>
              {e.rippleDither && (
                <>
                  <Slider label="Dissolve Depth" value={e.dissolveDepth} min={1} max={20} step={1} suffix=" rows" onChange={(v) => setEdgeConfig({ dissolveDepth: v })} />
                  <button
                    onClick={() => setEdgeConfig({ dissolveSeed: e.dissolveSeed + 1 })}
                    className="text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
                    title="Reshuffle which tiles drop out"
                  >
                    Reshuffle
                  </button>
                </>
              )}
              {/* Pixelate — build the wave from tiles instead of a smooth curve */}
              {!e.rippleDither && (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/40">Pixelate (tile wave)</span>
                  <button
                    onClick={() => setEdgeConfig({ ripplePixelate: !e.ripplePixelate })}
                    className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                      e.ripplePixelate
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                        : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                    }`}
                  >
                    {e.ripplePixelate ? 'On' : 'Off'}
                  </button>
                </div>
              )}
              <Slider label="Amplitude" value={e.rippleAmplitude} min={1} max={15} step={0.5} suffix="vh" onChange={(v) => setEdgeConfig({ rippleAmplitude: v })} />
              <Slider label="Frequency" value={e.rippleFrequency} min={2} max={20} step={1} suffix=" waves" onChange={(v) => setEdgeConfig({ rippleFrequency: v })} />
              <Slider label="Ripple Speed" value={e.rippleSpeed} min={0} max={3} step={0.1} onChange={(v) => setEdgeConfig({ rippleSpeed: v })} />
            </>
          )}
        </div>

        {/* ══ GROUP: ANIMATION ══ */}
        <div className="pt-2 pb-1 mt-1 border-t border-white/10">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-sky-400/70">Animation</span>
        </div>

        {/* ─── Scene Templates ─── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40">
              Scene
            </span>
            <button
              onClick={() => setAnimationConfig({ playing: !a.playing })}
              className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                a.playing
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                  : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
              }`}
            >
              {a.playing ? 'Playing' : 'Paused'}
            </button>
          </div>

          {/* Template buttons */}
          <div className="grid grid-cols-2 gap-1">
            {sceneTemplateIds.map((id) => {
              const tmpl = sceneTemplates[id]
              const isActive = state.activeScene === id
              return (
                <button
                  key={id}
                  onClick={() => applySceneTemplate(id)}
                  className={`text-left py-1.5 px-2 rounded-lg cursor-pointer border transition-all ${
                    isActive
                      ? 'bg-white/10 border-white/15'
                      : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={`text-[10px] font-medium block ${isActive ? 'text-white/80' : 'text-white/40'}`}>
                    {tmpl.label}
                  </span>
                  <span className="text-[8px] text-white/25 block">{tmpl.desc}</span>
                </button>
              )
            })}
          </div>

          {/* Tile animation mode — color/alpha vs per-tile size */}
          <div className="space-y-1 pt-1">
            <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40">Tile animation</span>
            <div className="flex flex-wrap gap-1">
              {([
                { value: 'color' as TileDisplayMode, label: 'Color / alpha' },
                { value: 'size' as TileDisplayMode, label: 'Mask size' },
                { value: 'points' as TileDisplayMode, label: 'Point sizes' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnimationConfig({ tileDisplay: opt.value })}
                  className={pill(a.tileDisplay === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[8px] text-white/25 leading-relaxed">
              {a.tileDisplay !== 'color'
                ? (() => {
                    const r = tileSizeRangeFromGrid(pg, a.tileSizeSpread * TILE_SIZE_EFFECT_STRENGTH)
                    return a.tileDisplay === 'points'
                      ? `Point sizes — direct proportional dots ${r.minPiece}-${r.maxPiece}px from Pixel Grid (${r.pitch}px pitch, ${r.gap}px gap).`
                      : `Mask size — clips shader into proportional ${r.minPiece}-${r.maxPiece}px pieces from Pixel Grid.`
                  })()
                : 'Default — dither color, opacity, and gap pulse. Switch to Point sizes for direct proportional dot-size motion.'}
            </p>
            {a.tileDisplay !== 'color' && (
              <>
                <Slider label="Size spread" value={a.tileSizeSpread} min={0} max={1} step={0.05} onChange={(v) => setAnimationConfig({ tileSizeSpread: v })} />
                <Slider label="Size speed" value={a.tileSizeSpeed} min={0.02} max={0.3} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ tileSizeSpeed: v })} />
                <Slider label="Map scale" value={a.tileSizeNoise} min={0.4} max={3} step={0.1} onChange={(v) => setAnimationConfig({ tileSizeNoise: v })} />
              </>
            )}
          </div>

          {/* Break Loop — non-looping motion layered on top of the scene */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40">Break Loop</span>
              <span className="text-[8px] text-white/25">how it avoids repeating</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {([
                { value: 'none', label: 'Off' },
                { value: 'rotate', label: 'Rotate' },
                { value: 'drift', label: 'Drift' },
                { value: 'orbit', label: 'Orbit' },
                { value: 'wander', label: 'Wander' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnimationConfig({ loopBreak: opt.value })}
                  className={pill(a.loopBreak === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {a.loopBreak !== 'none' && (
              <Slider label="Break Amount" value={a.loopBreakAmount} min={0.1} max={2} step={0.1} suffix="x" onChange={(v) => setAnimationConfig({ loopBreakAmount: v })} />
            )}
            <p className="text-[8px] text-white/25 leading-relaxed">
              Rotate = spin colors (never repeats) · Drift = pan · Orbit = both · Wander = turning drift. Stacks on the scene.
            </p>
          </div>

          {/* Fine-tune toggle */}
          <button
            onClick={() => setShowFineTune((v) => !v)}
            className="text-[8px] text-white/25 hover:text-white/40 cursor-pointer bg-transparent border-0 transition-colors w-full text-left pt-1"
          >
            {showFineTune ? '▾ Hide fine-tune' : '▸ Fine-tune animation'}
          </button>

          {showFineTune && (
            <div className="space-y-2 pl-1 border-l border-white/[0.06]">
              {/* Scan mode toggle */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Motion</span>
                <div className="flex flex-wrap gap-1">
                  {(['continuous', 'oscillate'] as ScanMode[]).map((m) => (
                    <button key={m} onClick={() => setAnimationConfig({ scanMode: m })} className={pill(a.scanMode === m)}>
                      {m === 'continuous' ? 'Drift' : 'Scan'}
                    </button>
                  ))}
                </div>
              </div>

              {a.scanMode === 'oscillate' ? (
                <>
                  <Slider label="Scan Amplitude" value={a.scanAmplitude} min={0} max={1.5} step={0.05} onChange={(v) => setAnimationConfig({ scanAmplitude: v })} />
                  <Slider label="Scan Speed" value={a.scanSpeed} min={0.01} max={0.2} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ scanSpeed: v })} />
                  <Slider label="Scan Angle" value={a.scanAngle} min={0} max={360} step={15} suffix="°" onChange={(v) => setAnimationConfig({ scanAngle: v })} />
                </>
              ) : (
                <>
                  <Slider label="Drift Y (fall)" value={a.driftY} min={0} max={0.1} step={0.005} onChange={(v) => setAnimationConfig({ driftY: v })} />
                  <Slider label="Drift X (scan)" value={a.driftX} min={-0.05} max={0.05} step={0.005} onChange={(v) => setAnimationConfig({ driftX: v })} />
                </>
              )}

              <Slider label="Rotation Drift" value={a.rotationDrift} min={0} max={5} step={0.5} suffix="°/s" onChange={(v) => setAnimationConfig({ rotationDrift: v })} />
              <Slider label="Pulse Amount" value={a.pulseAmount} min={0} max={0.15} step={0.005} onChange={(v) => setAnimationConfig({ pulseAmount: v })} />
              <Slider label="Pulse Speed" value={a.pulseSpeed} min={0.05} max={0.5} step={0.05} suffix=" Hz" onChange={(v) => setAnimationConfig({ pulseSpeed: v })} />

              {/* Wave sweep */}
              <span className="text-[9px] text-white/40 block pt-1">Wave Sweep</span>
              <Slider label="Wave Amplitude" value={a.waveAmplitude} min={0} max={0.5} step={0.01} onChange={(v) => setAnimationConfig({ waveAmplitude: v })} />
              {a.waveAmplitude > 0 && (
                <>
                  <Slider label="Wave Speed" value={a.waveSpeed} min={0.02} max={0.3} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ waveSpeed: v })} />
                  <Slider label="Wave Angle" value={a.waveAngle} min={0} max={360} step={15} suffix="°" onChange={(v) => setAnimationConfig({ waveAngle: v })} />
                </>
              )}

              {/* Tile breathing — animate the pixel-grid gap */}
              <span className="text-[9px] text-white/40 block pt-1">Tile Breathing (gap)</span>
              <Slider label="Gap Pulse" value={a.gapPulse} min={0} max={16} step={0.5} suffix="px" onChange={(v) => setAnimationConfig({ gapPulse: v })} />
              {a.gapPulse > 0 && (
                <Slider label="Gap Pulse Speed" value={a.gapPulseSpeed} min={0.02} max={0.4} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ gapPulseSpeed: v })} />
              )}
            </div>
          )}
        </div>

        {/* ══ GROUP: HOVER ══ */}
        <div className="pt-2 pb-1 mt-1 border-t border-white/10">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-amber-400/70">Hover</span>
        </div>

        {/* ─── Hover Effect ─── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40">
              Hover Reveal
            </span>
            <button
              onClick={() => setHoverConfig({ enabled: !h.enabled })}
              className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                h.enabled
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                  : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
              }`}
            >
              {h.enabled ? 'On' : 'Off'}
            </button>
          </div>
          {h.enabled && (
            <div className="space-y-2">
              {/* Mode toggle */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setHoverConfig({ mode: 'recolor' })}
                  className={pill(h.mode === 'recolor')}
                >
                  Recolor
                </button>
                <button
                  onClick={() => setHoverConfig({ mode: 'reveal' })}
                  className={pill(h.mode === 'reveal')}
                >
                  Reveal
                </button>
                <button
                  onClick={() => setHoverConfig({ mode: 'warp' })}
                  className={pill(h.mode === 'warp')}
                >
                  Warp
                </button>
                <button
                  onClick={() => setHoverConfig({ mode: 'overlay' })}
                  className={pill(h.mode === 'overlay')}
                >
                  Overlay
                </button>
                <button
                  onClick={() => setHoverConfig({ preview: !h.preview })}
                  className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ml-auto ${
                    h.preview
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-400/80'
                      : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                  }`}
                >
                  Preview
                </button>
              </div>
              {h.mode === 'overlay' && (
                <>
                  <p className="text-[8px] text-white/30 leading-relaxed">
                    Flat <span className="text-white/55">{h.fixColor}</span> wash over every whole tile
                    in the hover region — no shader swap, just a color overlay on the current scene.
                  </p>
                  <Slider label="Opacity" value={h.overlayOpacity} min={0.05} max={1} step={0.05} onChange={(v) => setHoverConfig({ overlayOpacity: v })} />
                  <div className="space-y-1">
                    <span className="text-[9px] text-white/40 block">Blend</span>
                    <div className="flex flex-wrap gap-1">
                      {(['normal', 'screen', 'multiply', 'overlay', 'soft-light'] as const).map((b) => (
                        <button key={b} onClick={() => setHoverConfig({ overlayBlend: b })} className={pill(h.overlayBlend === b)}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {(h.mode === 'recolor' || h.mode === 'overlay') && h.mode !== 'overlay' && (
                <>
                  <p className="text-[8px] text-white/30 leading-relaxed">
                    {`Recolors the existing tiles under the cursor — the same pattern you see, in the ${state.initialState === 'fix' ? 'problem (pink)' : 'fix (green)'} color.`}
                  </p>
                </>
              )}
              {(h.mode === 'recolor' || h.mode === 'overlay') && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40">Whole tiles</span>
                    <button
                      onClick={() => setHoverConfig({ wholeTiles: !h.wholeTiles })}
                      className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                        h.wholeTiles
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                          : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                      }`}
                    >
                      {h.wholeTiles ? 'On' : 'Off'}
                    </button>
                  </div>
                  <p className="text-[8px] text-white/25 leading-relaxed">
                    {h.wholeTiles
                      ? 'Snaps to the pixel grid — only complete tiles in the hover region.'
                      : h.mode === 'overlay'
                        ? 'Tiles overlay when their center is inside the hover shape.'
                        : 'Recolors freely under the cursor — tiles at the edge are cut partly.'}
                  </p>
                </>
              )}
              {h.mode === 'warp' && h.hoverShape === 'square' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40">Whole tiles</span>
                    <button
                      onClick={() => setHoverConfig({ wholeTiles: !h.wholeTiles })}
                      className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                        h.wholeTiles
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                          : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                      }`}
                    >
                      {h.wholeTiles ? 'On' : 'Off'}
                    </button>
                  </div>
                  <p className="text-[8px] text-white/25 leading-relaxed">
                    {h.wholeTiles
                      ? 'Snaps the hover rect to the pixel grid — only complete tiles warp.'
                      : 'Tiles warp when their center is inside the rect.'}
                  </p>
                </>
              )}
              {h.mode === 'warp' && (
                <div className="space-y-1.5 rounded-md bg-white/[0.02] border border-white/[0.05] p-2">
                  <p className="text-[8px] text-white/30 leading-relaxed">
                    Warps the <span className="text-white/55">pixel-grid tiles</span> from the resting
                    scene — same shape &amp; gaps, rotated &amp; rounded in the hover region — and recolors warped tiles while keeping the{' '}
                    <span className="text-white/55">same scene pattern</span>. Needs <span className="text-white/45">Pixel Grid</span> on.{' '}
                    <span className="text-white/45">Reach</span> sets the radius; every tile inside is fully transformed (never partial).
                  </p>
                  <Slider label="Rotate" value={h.warpRotate} min={0} max={180} step={5} suffix="°" onChange={(v) => setHoverConfig({ warpRotate: v })} />
                  <Slider label="Round" value={h.warpRound} min={0} max={1} step={0.05} onChange={(v) => setHoverConfig({ warpRound: v })} />
                  <Slider label="Max Size" value={h.warpScale} min={0.2} max={1} step={0.05} onChange={(v) => setHoverConfig({ warpScale: v })} />
                  <Slider label="Size Spread" value={h.warpJitter} min={0} max={1.5} step={0.05} onChange={(v) => setHoverConfig({ warpJitter: v })} />
                  <p className="text-[8px] text-white/25 leading-relaxed">
                    Tiles stay within the scene piece (gaps preserved).{' '}
                    <span className="text-white/45">Max Size</span> caps warped tiles.{' '}
                    <span className="text-white/45">Size Spread</span> up to 1.5 — big→small mix; more spread = more tiny tiles.{' '}
                    <span className="text-white/45">Dynamic Size</span> widens spread while moving fast.
                  </p>
                  <div className="h-px bg-white/[0.06] my-1" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-white/40">Reveal Warp</span>
                    <button
                      onClick={() => setHoverConfig({
                        warpRevealEnabled: !h.warpRevealEnabled,
                        ...(!h.warpRevealEnabled ? { warpRecolorEnabled: false, warpOverlayEnabled: false } : {}),
                      })}
                      className={pill(h.warpRevealEnabled)}
                    >
                      {h.warpRevealEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                  {h.warpRevealEnabled && (
                    <>
                      <p className="text-[8px] text-white/25 leading-relaxed">
                        Warped tiles reveal the {state.initialState === 'fix' ? 'problem (pink)' : 'fix (green)'} scene
                        through the pixel circle — a true state peek, not a tint.
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] text-white/40">Error text</span>
                        <button
                          onClick={() => setHoverConfig({ warpErrorText: !h.warpErrorText })}
                          className={pill(h.warpErrorText)}
                        >
                          {h.warpErrorText ? 'On' : 'Off'}
                        </button>
                      </div>
                      <p className="text-[8px] text-white/25 leading-relaxed">
                        Short log fragments surface below the cursor while revealing — the errors hiding under the calm.
                      </p>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-white/40">Recolor Warp</span>
                    <button
                      onClick={() => setHoverConfig({ warpRecolorEnabled: !h.warpRecolorEnabled, warpOverlayEnabled: h.warpRecolorEnabled ? h.warpOverlayEnabled : false, ...(!h.warpRecolorEnabled ? { warpRevealEnabled: false } : {}) })}
                      className={pill(h.warpRecolorEnabled)}
                    >
                      {h.warpRecolorEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                  {h.warpRecolorEnabled && (
                    <>
                      <Slider label="Recolor Reach" value={h.warpRecolor} min={0} max={1} step={0.05} onChange={(v) => setHoverConfig({ warpRecolor: v })} />
                      <p className="text-[8px] text-white/25 leading-relaxed">
                        Keeps the <span className="text-white/45">same scene pattern</span> — only the tint changes on warped tiles (mirrors base layers in {state.initialState === 'fix' ? 'problem (pink)' : 'fix (green)'}).
                      </p>
                    </>
                  )}
                  {!h.warpRecolorEnabled && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] text-white/40">Color Overlay</span>
                        <button
                          onClick={() => setHoverConfig({ warpOverlayEnabled: !h.warpOverlayEnabled })}
                          className={pill(h.warpOverlayEnabled)}
                        >
                          {h.warpOverlayEnabled ? 'On' : 'Off'}
                        </button>
                      </div>
                      {h.warpOverlayEnabled && (
                        <Slider label="Overlay Opacity" value={h.overlayOpacity} min={0.05} max={1} step={0.05} onChange={(v) => setHoverConfig({ overlayOpacity: v })} />
                      )}
                    </>
                  )}
                </div>
              )}
              {/* Trigger toggle */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Trigger</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHoverConfig({ trigger: 'instant' })}
                    className={pill(h.trigger === 'instant')}
                  >
                    Instant
                  </button>
                  <button
                    onClick={() => setHoverConfig({ trigger: 'dwell' })}
                    className={pill(h.trigger === 'dwell')}
                  >
                    Dwell
                  </button>
                </div>
              </div>
              {/* Dwell controls */}
              {h.trigger === 'dwell' && (
                <>
                  <Slider label="Growth" value={h.dwellSpeed} min={50} max={1000} step={25} suffix=" px/s" onChange={(v) => setHoverConfig({ dwellSpeed: v })} />
                  <Slider label="Fade Back" value={h.dwellFadeBack} min={0.5} max={5} step={0.25} suffix="x" onChange={(v) => setHoverConfig({ dwellFadeBack: v })} />
                </>
              )}
              {/* Hover area shape. In Warp mode this defines where tiles are transformed. */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">{h.mode === 'warp' ? 'Hover Area' : 'Shape'}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHoverConfig({ hoverShape: 'square' })}
                    className={pill(h.hoverShape === 'square')}
                  >
                    Square
                  </button>
                  <button
                    onClick={() => setHoverConfig({ hoverShape: 'circle' })}
                    className={pill(h.hoverShape === 'circle')}
                  >
                    Circle
                  </button>
                  <button
                    onClick={() => setHoverConfig({ hoverShape: 'pixel-circle' })}
                    className={pill(h.hoverShape === 'pixel-circle')}
                  >
                    Pixel ◯
                  </button>
                </div>
                {h.hoverShape === 'pixel-circle' && (
                  <p className="text-[9px] text-white/40 leading-snug">
                    Staircased circle of <span className="text-white/60">whole tiles</span> —
                    each tile warps fully or not at all; radius snaps to tile rings. Needs{' '}
                    <span className="text-white/60">Pixel Grid</span> on (else falls
                    back to a hard-edged circle).
                  </p>
                )}
                {h.mode === 'warp' && h.hoverShape !== 'pixel-circle' && (
                  <p className="text-[9px] text-white/40 leading-snug">
                    {h.hoverShape === 'square'
                      ? 'Whole tiles whose center falls inside the rect — enable Whole Tiles to snap the rect to the grid.'
                      : 'Whole tiles whose center falls inside the circle — each tile is fully transformed, never sliced at the rim.'}
                  </p>
                )}
              </div>
              {/* Hover color */}
              {(h.mode === 'overlay' || h.mode === 'recolor' || (h.mode === 'warp' && (h.warpOverlayEnabled || h.warpRecolorEnabled))) && (
              <label className="space-y-1">
                <span className="text-[9px] text-white/40 block">
                  {h.mode === 'overlay' || (h.mode === 'warp' && h.warpOverlayEnabled) ? 'Overlay Color' : h.mode === 'warp' ? 'Recolor Tint' : 'Tint'}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={h.fixColor}
                    onChange={(ev) => setHoverConfig({ fixColor: ev.target.value })}
                    className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
                  />
                  <span className="text-[9px] text-white/50 font-mono">{h.fixColor}</span>
                </div>
              </label>
              )}
              {/* Reveal shape controls — per-layer in alpha mode, single in solid */}
              {h.mode === 'reveal' && (
                c.transparentBg ? (
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/40 block">Hover Layers</span>
                    {h.hoverLayers.map((layer, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={layer.color}
                          onChange={(ev) => setHoverLayer(i, { color: ev.target.value })}
                          className="w-4 h-4 rounded border border-white/10 cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
                        />
                        <button
                          onClick={() => {
                            const idx = SHAPES.indexOf(layer.shape)
                            setHoverLayer(i, { shape: SHAPES[(idx + 1) % SHAPES.length] })
                          }}
                          className="text-[9px] text-white/40 hover:text-white/60 cursor-pointer bg-transparent border-0 w-12 text-left transition-colors"
                          title="Click to cycle shape"
                        >
                          {layer.shape}
                        </button>
                        <input
                          type="range"
                          min={0.1}
                          max={1}
                          step={0.05}
                          value={layer.opacity}
                          onChange={(ev) => setHoverLayer(i, { opacity: parseFloat(ev.target.value) })}
                          className="flex-1 h-1 rounded bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400"
                        />
                        <span className="text-[8px] text-white/40 font-mono w-6 text-right">{layer.opacity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-[9px] text-white/40 block">Fix Shape</span>
                    <div className="flex flex-wrap gap-1">
                      {SHAPES.map((s) => (
                        <button key={s} onClick={() => setHoverConfig({ fixShape: s })} className={pill(h.fixShape === s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}
              {/* ── Shader overrides (reveal mode only — recolor mirrors the base) ── */}
              {h.mode === 'reveal' && (<>
              <span className="text-[9px] font-semibold tracking-wide uppercase text-amber-400/50 block pt-1">Hover Layer · reveal only</span>
              <p className="text-[8px] text-white/25 leading-relaxed">These change the hover reveal only — not the resting effect. For the resting effect use <span className="text-white/40">Dithering Shader</span> below.</p>
              {/* Type override */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Type</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHoverConfig({ fixType: undefined })}
                    className={pill(h.fixType == null)}
                  >
                    base
                  </button>
                  {TYPES.map((t) => (
                    <button key={t} onClick={() => setHoverConfig({ fixType: t })} className={pill(h.fixType === t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* Size override */}
              <Slider
                label="Reveal Size"
                value={h.fixSize ?? state.shader.size}
                min={0.5} max={20} step={0.5}
                onChange={(v) => setHoverConfig({ fixSize: v })}
              />
              {h.fixSize != null && (
                <button
                  onClick={() => setHoverConfig({ fixSize: undefined })}
                  className="text-[8px] text-white/25 hover:text-white/40 cursor-pointer bg-transparent border-0 transition-colors"
                >
                  reset to base
                </button>
              )}
              {/* Speed override */}
              <Slider
                label="Reveal Speed"
                value={h.fixSpeed ?? state.shader.speed}
                min={0} max={2} step={0.05}
                onChange={(v) => setHoverConfig({ fixSpeed: v })}
              />
              {h.fixSpeed != null && (
                <button
                  onClick={() => setHoverConfig({ fixSpeed: undefined })}
                  className="text-[8px] text-white/25 hover:text-white/40 cursor-pointer bg-transparent border-0 transition-colors"
                >
                  reset to base
                </button>
              )}
              {/* Scale override */}
              <Slider
                label="Reveal Scale"
                value={h.fixScale ?? state.shader.scale}
                min={0.01} max={4} step={0.05}
                onChange={(v) => setHoverConfig({ fixScale: v })}
              />
              {h.fixScale != null && (
                <button
                  onClick={() => setHoverConfig({ fixScale: undefined })}
                  className="text-[8px] text-white/25 hover:text-white/40 cursor-pointer bg-transparent border-0 transition-colors"
                >
                  reset to base
                </button>
              )}
              {/* Rotation override */}
              <Slider
                label="Reveal Rotation"
                value={h.fixRotation ?? state.shader.rotation}
                min={0} max={360} step={1} suffix="°"
                onChange={(v) => setHoverConfig({ fixRotation: v })}
              />
              {h.fixRotation != null && (
                <button
                  onClick={() => setHoverConfig({ fixRotation: undefined })}
                  className="text-[8px] text-white/25 hover:text-white/40 cursor-pointer bg-transparent border-0 transition-colors"
                >
                  reset to base
                </button>
              )}
              {/* Offset overrides */}
              <Slider
                label="Offset X"
                value={h.fixOffsetX ?? state.shader.offsetX}
                min={-1} max={1} step={0.05}
                onChange={(v) => setHoverConfig({ fixOffsetX: v })}
              />
              <Slider
                label="Offset Y"
                value={h.fixOffsetY ?? state.shader.offsetY}
                min={-1} max={1} step={0.05}
                onChange={(v) => setHoverConfig({ fixOffsetY: v })}
              />
              {(h.fixOffsetX != null || h.fixOffsetY != null) && (
                <button
                  onClick={() => setHoverConfig({ fixOffsetX: undefined, fixOffsetY: undefined })}
                  className="text-[8px] text-white/25 hover:text-white/40 cursor-pointer bg-transparent border-0 transition-colors"
                >
                  reset offsets to base
                </button>
              )}
              </>)}

              {/* ── Mask ── */}
              <span className="text-[9px] font-semibold tracking-wide uppercase text-white/30 block pt-1">Mask</span>
              <Slider
                label={h.hoverShape === 'square' ? 'Width' : (h.trigger === 'dwell' ? 'Max Radius' : 'Radius')}
                value={h.radius} min={20} max={1600} step={10} suffix="px"
                onChange={(v) => setHoverConfig({ radius: v })}
              />
              {h.trigger === 'dwell' && (
                <p className="text-[8px] text-white/25 leading-relaxed">
                  Dwell grows to this size at <span className="text-white/45">Growth</span> px/s,
                  then retracts at Growth × <span className="text-white/45">Fade Back</span> on
                  leave. Max value ≈ full takeover.
                </p>
              )}
              {h.hoverShape === 'square' && (
                <Slider label="Height" value={h.radiusY ?? h.radius} min={20} max={1600} step={10} suffix="px" onChange={(v) => setHoverConfig({ radiusY: v })} />
              )}
              {h.hoverShape === 'square' && h.radiusY != null && (
                <button
                  onClick={() => setHoverConfig({ radiusY: undefined })}
                  className="text-[8px] text-white/25 hover:text-white/40 cursor-pointer bg-transparent border-0 transition-colors"
                >
                  reset height to match width
                </button>
              )}
              {/* Dynamic sizing toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Dynamic Size</span>
                <button
                  onClick={() => setHoverConfig({ dynamicSize: !h.dynamicSize })}
                  className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                    h.dynamicSize
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400/80'
                      : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                  }`}
                >
                  {h.dynamicSize ? 'On' : 'Off'}
                </button>
              </div>
              <Slider label="Mouse Influence" value={h.mouseInfluence} min={0} max={1} step={0.05} onChange={(v) => setHoverConfig({ mouseInfluence: v })} />
            </div>
          )}
        </div>

        {/* ─── Haptics ─── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40">
              Haptics
            </span>
            <button
              onClick={() => setHapticConfig({ enabled: !hap.enabled })}
              className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                hap.enabled
                  ? 'bg-violet-500/20 border-violet-500/30 text-violet-400/80'
                  : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
              }`}
            >
              {hap.enabled ? 'On' : 'Off'}
            </button>
          </div>
          {hap.enabled && (
            <div className="space-y-2">
              <span className="text-[8px] text-white/20 block">
                {typeof navigator !== 'undefined' && !navigator.vibrate
                  ? 'Desktop: audio sim auto-on. Move mouse over dithering to feel it.'
                  : 'Mobile: real vibration. Move finger over dithering.'}
              </span>
              {/* Debug audio toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Force Debug Audio</span>
                <button
                  onClick={() => setHapticConfig({ debug: !hap.debug })}
                  className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                    hap.debug
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-400/80'
                      : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                  }`}
                >
                  {hap.debug ? 'On' : 'Off'}
                </button>
              </div>

              {/* ── Movement texture ── */}
              <span className="text-[9px] font-semibold tracking-wide uppercase text-white/30 block pt-1">Movement Texture</span>

              {/* Tick distance — how many pixels between each haptic pulse */}
              <Slider
                label="Tick Distance"
                value={hap.tickDistance}
                min={0} max={200} step={5}
                suffix="px"
                onChange={(v) => setHapticConfig({ tickDistance: v })}
              />
              <span className="text-[8px] text-white/15 block">Pixels of travel per haptic tick. Lower = denser texture.</span>

              {/* Tick pattern */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Tick Pattern</span>
                <div className="flex flex-wrap gap-1">
                  {HAPTIC_PRESETS.map((p) => (
                    <button key={p} onClick={() => setHapticConfig({ tickPattern: p })} className={pill(hap.tickPattern === p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Velocity intensity */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Velocity Intensity</span>
                <button
                  onClick={() => setHapticConfig({ velocityIntensity: !hap.velocityIntensity })}
                  className={`text-[9px] font-medium py-0.5 px-2 rounded cursor-pointer border transition-all ${
                    hap.velocityIntensity
                      ? 'bg-violet-500/20 border-violet-500/30 text-violet-400/80'
                      : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50'
                  }`}
                >
                  {hap.velocityIntensity ? 'On' : 'Off'}
                </button>
              </div>
              <span className="text-[8px] text-white/15 block">Fast = lighter ticks, slow = heavier press</span>

              {/* ── Events ── */}
              <span className="text-[9px] font-semibold tracking-wide uppercase text-white/30 block pt-1">Events</span>

              {/* Hover Enter pattern */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Hover Enter</span>
                <div className="flex flex-wrap gap-1">
                  {HAPTIC_PRESETS.map((p) => (
                    <button key={p} onClick={() => setHapticConfig({ hoverEnter: p })} className={pill(hap.hoverEnter === p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hover Leave pattern */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Hover Leave</span>
                <div className="flex flex-wrap gap-1">
                  {HAPTIC_PRESETS.map((p) => (
                    <button key={p} onClick={() => setHapticConfig({ hoverLeave: p })} className={pill(hap.hoverLeave === p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Dwell ── */}
              <span className="text-[9px] font-semibold tracking-wide uppercase text-white/30 block pt-1">Dwell Mode</span>

              {/* Dwell progress ticks */}
              <Slider
                label="Progress Tick"
                value={hap.dwellTickPercent}
                min={0} max={50} step={5}
                suffix="%"
                onChange={(v) => setHapticConfig({ dwellTickPercent: v })}
              />
              <span className="text-[8px] text-white/15 block">Haptic every N% of dwell coverage (0 = off)</span>

              {/* Dwell completion */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Dwell Complete</span>
                <div className="flex flex-wrap gap-1">
                  {HAPTIC_PRESETS.map((p) => (
                    <button key={p} onClick={() => setHapticConfig({ dwellComplete: p })} className={pill(hap.dwellComplete === p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ GROUP: TEXT & TYPOGRAPHY ══ */}
        <div className="pt-2 pb-1 mt-1 border-t border-white/10">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/50">Text &amp; Typography</span>
        </div>

        {/* ─── Header Background ─── */}
        <div className="space-y-1">
          <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 block">
            Header
          </span>
          <div className="flex gap-1.5">
            {HEADER_MODES.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHeaderBg(opt.value)}
                className={`flex-1 text-[10px] font-medium py-1.5 px-2 rounded-lg cursor-pointer border transition-all ${
                  state.headerBg === opt.value
                    ? 'bg-white/10 border-white/15 text-white/80'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50 hover:bg-white/[0.06]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Copy Variation ─── */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 block pt-1">
            Copy
          </span>
          <div className="flex flex-wrap gap-1">
            {copyVariantIds.map((id) => (
              <button
                key={id}
                onClick={() => setCopyVariant(id)}
                className={`flex-1 text-[10px] font-medium py-1.5 px-2 rounded-lg cursor-pointer border transition-all ${
                  state.copyVariant === id
                    ? 'bg-white/10 border-white/15 text-white/80'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/30 hover:text-white/50 hover:bg-white/[0.06]'
                }`}
              >
                {copyVariants[id].label}
              </button>
            ))}
          </div>
          <div className="text-[9px] text-white/30 leading-relaxed pt-1 space-y-1">
            <p><span className="text-white/50">H:</span> {copyVariants[state.copyVariant].headline.replace(/\n/g, ' ')}</p>
            {copyVariants[state.copyVariant].sub && (
              <p><span className="text-white/50">Sub:</span> {copyVariants[state.copyVariant].sub}</p>
            )}
            <p><span className="text-white/50">CTA:</span> {copyVariants[state.copyVariant].cta}</p>
          </div>
        </div>

        {/* ─── Layout Grid ─── */}
        <div className="space-y-2">
          <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 block pt-1">
            Layout
          </span>
          <Slider label="Headline cols" value={state.layout.headlineCols} min={3} max={10} step={1} onChange={(v) => setLayoutConfig({ headlineCols: v, responseCols: 12 - v })} />
          <Slider label="Response cols" value={state.layout.responseCols} min={2} max={9} step={1} onChange={(v) => setLayoutConfig({ responseCols: v, headlineCols: 12 - v })} />
          <Slider label="Gutter" value={state.layout.gutter} min={0} max={64} step={1} suffix="px" onChange={(v) => setLayoutConfig({ gutter: v })} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] text-white/40">Baseline guides</span>
            <button
              onClick={() => setLayoutConfig({ showBaselines: !state.layout.showBaselines })}
              className={pill(state.layout.showBaselines)}
            >
              {state.layout.showBaselines ? 'On' : 'Off'}
            </button>
          </div>
          <p className="text-[8px] text-white/25 leading-relaxed">
            Draws a magenta line at every text baseline (headline, sub, response, CTAs)
            across the section — check cross-column alignment at a glance.
          </p>
        </div>

        {/* ─── WTF Title Positions ─── */}
        {state.copyVariant === 'wtf' && (() => {
          const tp = state.wtfTitlePositions
          const isDefault = (k: keyof WtfTitlePositions) =>
            tp[k].left === defaultWtfTitlePositions[k].left && tp[k].top === defaultWtfTitlePositions[k].top
          const anyDirty = !isDefault('wtf') || !isDefault('did') || !isDefault('myApp') || !isDefault('rotating')
          const entries: { key: keyof WtfTitlePositions; label: string }[] = [
            { key: 'wtf', label: 'WTF' },
            { key: 'did', label: 'did' },
            { key: 'myApp', label: 'my app' },
            { key: 'rotating', label: 'crash? (rotating)' },
          ]
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 pt-1">
                  Title Positions {anyDirty && <span className="text-amber-400">*</span>}
                </span>
                {anyDirty && (
                  <button
                    className="text-[9px] text-white/30 hover:text-white/60 transition-colors"
                    onClick={resetWtfTitlePositions}
                  >
                    reset
                  </button>
                )}
              </div>
              {entries.map(({ key, label }) => {
                const pos = tp[key]
                const dirty = !isDefault(key)
                return (
                  <div key={key} className="space-y-1 pl-1 border-l border-amber-500/20">
                    <span className="text-[9px] text-amber-400/60 font-medium block">
                      {label} {dirty && <span className="text-amber-400">*</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/30 w-3 shrink-0">L</span>
                      <input
                        type="range"
                        min={0} max={100} step={1}
                        value={pos.left}
                        onChange={(e) => setWtfTitlePos(key, { left: parseFloat(e.target.value) })}
                        className={sliderClass}
                      />
                      <input
                        type="number"
                        min={0} max={100} step={1}
                        value={pos.left}
                        onChange={(e) => setWtfTitlePos(key, { left: parseFloat(e.target.value) || 0 })}
                        className="w-10 text-[10px] text-white/60 bg-white/[0.05] border border-white/[0.08] rounded px-1 py-0.5 text-right font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/30 w-3 shrink-0">T</span>
                      <input
                        type="range"
                        min={0} max={100} step={1}
                        value={pos.top}
                        onChange={(e) => setWtfTitlePos(key, { top: parseFloat(e.target.value) })}
                        className={sliderClass}
                      />
                      <input
                        type="number"
                        min={0} max={100} step={1}
                        value={pos.top}
                        onChange={(e) => setWtfTitlePos(key, { top: parseFloat(e.target.value) || 0 })}
                        className="w-10 text-[10px] text-white/60 bg-white/[0.05] border border-white/[0.08] rounded px-1 py-0.5 text-right font-mono"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* ─── Typography ─── */}
        <div className="space-y-2">
          <span className="text-[9px] font-semibold tracking-wide uppercase text-white/40 block pt-1">
            Typography
          </span>

          {/* ── Headline ── */}
          <div className="space-y-1.5 pl-1 border-l border-pink-500/20">
            <span className="text-[9px] text-pink-400/60 font-medium block">Headline</span>
            {/* Font override */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/40 block">Font</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCopyFont({ headlineFont: undefined })}
                  className={pill(!copyVariants[state.copyVariant].headlineFont)}
                >
                  Panel
                </button>
                {/* Mono / Technical */}
                {([
                  { label: 'JetBrains', value: "'JetBrains Mono', monospace" },
                  { label: 'Geist Mono', value: "'Geist Mono', monospace" },
                  { label: 'Space Mono', value: "'Space Mono', monospace" },
                ] as const).map((f) => (
                  <button
                    key={f.label}
                    onClick={() => setCopyFont({ headlineFont: f.value })}
                    className={pill(copyVariants[state.copyVariant].headlineFont === f.value)}
                  >
                    {f.label}
                  </button>
                ))}
                <span className="w-full h-px bg-white/5" />
                {/* Sans / Grotesque */}
                {([
                  { label: 'Bricolage', value: "'Bricolage Grotesque', sans-serif" },
                  { label: 'Space Grot', value: "'Space Grotesk', sans-serif" },
                  { label: 'Cabinet', value: "'Cabinet Grotesk', sans-serif" },
                ] as const).map((f) => (
                  <button
                    key={f.label}
                    onClick={() => setCopyFont({ headlineFont: f.value })}
                    className={pill(copyVariants[state.copyVariant].headlineFont === f.value)}
                  >
                    {f.label}
                  </button>
                ))}
                <span className="w-full h-px bg-white/5" />
                {/* Serif / Display */}
                {([
                  { label: 'Fraunces', value: "'Fraunces', serif" },
                  { label: 'Instrument', value: "'Instrument Serif', Georgia, serif" },
                  { label: 'Bodoni', value: "'Bodoni Moda', serif" },
                  { label: 'Newsreader', value: "'Newsreader', serif" },
                ] as const).map((f) => (
                  <button
                    key={f.label}
                    onClick={() => setCopyFont({ headlineFont: f.value })}
                    className={pill(copyVariants[state.copyVariant].headlineFont === f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Weight */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/40 block">Weight</span>
              <div className="flex flex-wrap gap-1">
                {([400, 500, 700, 800, 900] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => setCopyFont({ headlineWeight: w })}
                    className={pill((copyVariants[state.copyVariant].headlineWeight ?? 900) === w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            {/* Size */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/40 block">Size</span>
              <div className="flex flex-wrap gap-1">
                {([
                  { label: 'S', value: 'clamp(2.8rem, 4vw + 1rem, 4.5rem)' },
                  { label: 'M', value: 'clamp(3rem, 5vw + 1rem, 5.5rem)' },
                  { label: 'L', value: 'clamp(3.5rem, 5.5vw + 1rem, 6rem)' },
                  { label: 'XL', value: 'clamp(4rem, 6vw + 1rem, 7rem)' },
                  { label: '2XL', value: 'clamp(4.5rem, 7vw + 1rem, 7.5rem)' },
                ] as const).map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setCopyFont({ headlineSize: s.value })}
                    className={pill(copyVariants[state.copyVariant].headlineSize === s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Color */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/40 block">Color</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCopyFont({ headlineColorMode: 'current' })}
                  className={pill((copyVariants[state.copyVariant].headlineColorMode ?? 'current') === 'current')}
                >
                  Current
                </button>
                <button
                  onClick={() => setCopyFont({ headlineColorMode: 'white' })}
                  className={pill(copyVariants[state.copyVariant].headlineColorMode === 'white')}
                >
                  White (safe)
                </button>
              </div>
            </div>
            {/* Tracking */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/40 block">Tracking</span>
              <div className="flex flex-wrap gap-1">
                {([
                  { label: 'Tight', value: '-0.04em' },
                  { label: 'Normal', value: '-0.03em' },
                  { label: 'Loose', value: '-0.02em' },
                  { label: 'Wide', value: '-0.01em' },
                ] as const).map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setCopyFont({ headlineTracking: t.value })}
                    className={pill((copyVariants[state.copyVariant].headlineTracking ?? '-0.03em') === t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Leading */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/40 block">Leading</span>
              <div className="flex flex-wrap gap-1">
                {([
                  { label: '0.85', value: '0.85' },
                  { label: '0.9', value: '0.9' },
                  { label: '0.95', value: '0.95' },
                  { label: '1.0', value: '1.0' },
                  { label: '1.1', value: '1.1' },
                  { label: '1.2', value: '1.2' },
                ] as const).map((l) => (
                  <button
                    key={l.label}
                    onClick={() => setCopyFont({ headlineLeading: l.value })}
                    className={pill((copyVariants[state.copyVariant].headlineLeading ?? '0.95') === l.value)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Response ── */}
          {copyVariants[state.copyVariant].layout === 'problem' && copyVariants[state.copyVariant].response && (
            <div className="space-y-1.5 pl-1 border-l border-emerald-500/20">
              <span className="text-[9px] text-emerald-400/60 font-medium block">Response</span>
              {/* Font override */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Font</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setCopyFont({ responseFont: undefined, responseFontMode: undefined })}
                    className={pill(!copyVariants[state.copyVariant].responseFont && copyVariants[state.copyVariant].responseFontMode !== 'headline')}
                  >
                    Panel
                  </button>
                  <button
                    onClick={() => setCopyFont({ responseFont: undefined, responseFontMode: 'headline' })}
                    className={pill(copyVariants[state.copyVariant].responseFontMode === 'headline')}
                    title="Same font as headline, smaller size"
                  >
                    = Headline
                  </button>
                  <span className="w-full h-px bg-white/5" />
                  {/* Sans / Grotesque — same as headline picker */}
                  {([
                    { label: 'Bricolage', value: "'Bricolage Grotesque', sans-serif" },
                    { label: 'Space Grot', value: "'Space Grotesk', sans-serif" },
                    { label: 'Cabinet', value: "'Cabinet Grotesk', sans-serif" },
                  ] as const).map((f) => (
                    <button
                      key={f.label}
                      onClick={() => setCopyFont({ responseFont: f.value, responseFontMode: 'custom' })}
                      className={pill(copyVariants[state.copyVariant].responseFont === f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                  <span className="w-full h-px bg-white/5" />
                  {/* Top serif picks */}
                  {([
                    { label: 'Newsreader', value: "'Newsreader', Georgia, serif" },
                    { label: 'Bodoni', value: "'Bodoni Moda', Georgia, serif" },
                    { label: 'Cormorant', value: "'Cormorant Garamond', Garamond, serif" },
                    { label: 'Fraunces', value: "'Fraunces', serif" },
                  ] as const).map((f) => (
                    <button
                      key={f.label}
                      onClick={() => setCopyFont({ responseFont: f.value, responseFontMode: 'custom' })}
                      className={pill(copyVariants[state.copyVariant].responseFont === f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                  <span className="w-full h-px bg-white/5" />
                  {/* More serifs */}
                  {([
                    { label: 'Instrument', value: "'Instrument Serif', Georgia, serif" },
                    { label: 'Piazzolla', value: "'Piazzolla', Georgia, serif" },
                    { label: 'Crimson', value: "'Crimson Pro', Georgia, serif" },
                    { label: 'Source Serif', value: "'Source Serif 4', Georgia, serif" },
                  ] as const).map((f) => (
                    <button
                      key={f.label}
                      onClick={() => setCopyFont({ responseFont: f.value, responseFontMode: 'custom' })}
                      className={pill(copyVariants[state.copyVariant].responseFont === f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                  <span className="w-full h-px bg-white/5" />
                  {/* Warm / humanist */}
                  {([
                    { label: 'Lora', value: "'Lora', Georgia, serif" },
                    { label: 'Literata', value: "'Literata', Georgia, serif" },
                  ] as const).map((f) => (
                    <button
                      key={f.label}
                      onClick={() => setCopyFont({ responseFont: f.value, responseFontMode: 'custom' })}
                      className={pill(copyVariants[state.copyVariant].responseFont === f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                  <span className="w-full h-px bg-white/5" />
                  {/* Mono (dev-to-dev) — auto-sets italic for "dev talk" feel */}
                  {([
                    { label: 'JetBrains', value: "'JetBrains Mono', monospace" },
                    { label: 'Geist Mono', value: "'Geist Mono', monospace" },
                    { label: 'Space Mono', value: "'Space Mono', monospace" },
                  ] as const).map((f) => (
                    <button
                      key={f.label}
                      onClick={() => setCopyFont({ responseFont: f.value, responseFontStyle: 'italic', responseFontMode: 'custom' })}
                      className={pill(copyVariants[state.copyVariant].responseFont === f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Weight */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Weight</span>
                <div className="flex flex-wrap gap-1">
                  {([300, 400, 500, 600, 700] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setCopyFont({ responseWeight: w })}
                      className={pill((copyVariants[state.copyVariant].responseWeight ?? 400) === w)}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              {/* Style */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Style</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setCopyFont({ responseFontStyle: undefined })}
                    className={pill(!copyVariants[state.copyVariant].responseFontStyle)}
                  >
                    Panel
                  </button>
                  <button
                    onClick={() => setCopyFont({ responseFontStyle: 'italic' })}
                    className={pill(copyVariants[state.copyVariant].responseFontStyle === 'italic')}
                  >
                    Italic
                  </button>
                  <button
                    onClick={() => setCopyFont({ responseFontStyle: 'normal' })}
                    className={pill(copyVariants[state.copyVariant].responseFontStyle === 'normal')}
                  >
                    Normal
                  </button>
                </div>
              </div>
              {/* Size */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Size</span>
                <div className="flex flex-wrap gap-1">
                  {([
                    { label: 'XS', value: '28px' },
                    { label: 'S', value: '36px' },
                    { label: 'M', value: '44px' },
                    { label: 'L', value: '48px' },
                    { label: 'XL', value: '56px' },
                  ] as const).map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setCopyFont({ responseSize: s.value })}
                      className={pill((copyVariants[state.copyVariant].responseSize ?? '48px') === s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Tracking */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Tracking</span>
                <div className="flex flex-wrap gap-1">
                  {([
                    { label: 'Tight', value: '-0.03em' },
                    { label: 'Normal', value: '-0.01em' },
                    { label: 'None', value: '0em' },
                    { label: 'Loose', value: '0.02em' },
                    { label: 'Wide', value: '0.05em' },
                  ] as const).map((t) => (
                    <button
                      key={t.label}
                      onClick={() => setCopyFont({ responseTracking: t.value })}
                      className={pill((copyVariants[state.copyVariant].responseTracking ?? '0em') === t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Leading */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Leading</span>
                <div className="flex flex-wrap gap-1">
                  {([
                    { label: '1.0', value: '1.0' },
                    { label: '1.1', value: '1.1' },
                    { label: '1.2', value: '1.2' },
                    { label: '1.3', value: '1.3' },
                  ] as const).map((l) => (
                    <button
                      key={l.label}
                      onClick={() => setCopyFont({ responseLeading: l.value })}
                      className={pill((copyVariants[state.copyVariant].responseLeading ?? '1.1') === l.value)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Color */}
              <div className="space-y-1">
                <span className="text-[9px] text-white/40 block">Color</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setCopyFont({ responseColorMode: 'current' })}
                    className={pill((copyVariants[state.copyVariant].responseColorMode ?? 'current') === 'current')}
                  >
                    Current
                  </button>
                  <button
                    onClick={() => setCopyFont({ responseColorMode: 'white' })}
                    className={pill(copyVariants[state.copyVariant].responseColorMode === 'white')}
                  >
                    White (safe)
                  </button>
                </div>
              </div>

              {/* ── Elevate ── */}
              <div className="space-y-1.5 pt-1.5 mt-1.5 border-t border-emerald-500/10">
                <span className="text-[9px] text-emerald-400/40 font-medium block">Elevate</span>
                {/* Separator */}
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40 block">Separator</span>
                  <div className="flex flex-wrap gap-1">
                    {([
                      { label: 'None', value: 'none' as const },
                      { label: 'Line', value: 'line' as const },
                      { label: 'Dots', value: 'dots' as const },
                      { label: 'Fade', value: 'fade' as const },
                    ]).map((s) => (
                      <button
                        key={s.label}
                        onClick={() => setCopyFont({ responseSeparator: s.value })}
                        className={pill((copyVariants[state.copyVariant].responseSeparator ?? 'none') === s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Bubble */}
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40 block">Bubble</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setCopyFont({ responseBubble: false })}
                      className={pill(!copyVariants[state.copyVariant].responseBubble)}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => setCopyFont({ responseBubble: true })}
                      className={pill(!!copyVariants[state.copyVariant].responseBubble)}
                    >
                      On
                    </button>
                  </div>
                </div>
                {/* Bubble options — only when bubble is on */}
                {copyVariants[state.copyVariant].responseBubble && (
                  <>
                    {/* Corner radius */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-white/40 block">Radius</span>
                      <div className="flex flex-wrap gap-1">
                        {([
                          { label: 'Subtle', value: '8px' },
                          { label: 'Medium', value: '16px' },
                          { label: 'Round', value: '24px' },
                          { label: 'Pill', value: '999px' },
                        ] as const).map((r) => (
                          <button
                            key={r.label}
                            onClick={() => setCopyFont({ responseBubbleRadius: r.value })}
                            className={pill((copyVariants[state.copyVariant].responseBubbleRadius ?? '16px') === r.value)}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Bubble color/opacity */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-white/40 block">Fill</span>
                      <div className="flex flex-wrap gap-1">
                        {([
                          { label: 'Ghost', value: 'rgba(255,255,255,0.04)' },
                          { label: 'Subtle', value: 'rgba(255,255,255,0.07)' },
                          { label: 'Soft', value: 'rgba(255,255,255,0.10)' },
                          { label: 'Teal', value: 'rgba(45,212,168,0.08)' },
                        ] as const).map((c) => (
                          <button
                            key={c.label}
                            onClick={() => setCopyFont({ responseBubbleColor: c.value })}
                            className={pill((copyVariants[state.copyVariant].responseBubbleColor ?? 'rgba(255,255,255,0.07)') === c.value)}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
