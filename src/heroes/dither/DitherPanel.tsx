import { useState, type ReactNode } from 'react'
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
  setButtonConfig,
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
import Segmented, { type SegmentedOption } from '../../lab/ui/Segmented'
import SliderRow from '../../lab/ui/SliderRow'
import SectionLabel from '../../lab/ui/SectionLabel'

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


const HEADLINE_FONT_GROUPS = [
  { name: 'mono', options: [
    { label: 'Panel', value: '' },
    { label: 'JetBrains', value: "'JetBrains Mono', monospace" },
    { label: 'Geist Mono', value: "'Geist Mono', monospace" },
    { label: 'Space Mono', value: "'Space Mono', monospace" },
  ] },
  { name: 'sans', options: [
    { label: 'Bricolage', value: "'Bricolage Grotesque', sans-serif" },
    { label: 'Space Grot', value: "'Space Grotesk', sans-serif" },
    { label: 'Cabinet', value: "'Cabinet Grotesk', sans-serif" },
  ] },
  { name: 'serif', options: [
    { label: 'Fraunces', value: "'Fraunces', serif" },
    { label: 'Instrument', value: "'Instrument Serif', Georgia, serif" },
    { label: 'Bodoni', value: "'Bodoni Moda', serif" },
    { label: 'Newsreader', value: "'Newsreader', serif" },
  ] },
]

/** `italic` groups also set the italic style ("dev talk" feel for mono). */
const RESPONSE_FONT_GROUPS = [
  { name: 'sans', italic: false, options: [
    { label: 'Bricolage', value: "'Bricolage Grotesque', sans-serif" },
    { label: 'Space Grot', value: "'Space Grotesk', sans-serif" },
    { label: 'Cabinet', value: "'Cabinet Grotesk', sans-serif" },
  ] },
  { name: 'top serif', italic: false, options: [
    { label: 'Newsreader', value: "'Newsreader', Georgia, serif" },
    { label: 'Bodoni', value: "'Bodoni Moda', Georgia, serif" },
    { label: 'Cormorant', value: "'Cormorant Garamond', Garamond, serif" },
    { label: 'Fraunces', value: "'Fraunces', serif" },
  ] },
  { name: 'more serifs', italic: false, options: [
    { label: 'Instrument', value: "'Instrument Serif', Georgia, serif" },
    { label: 'Piazzolla', value: "'Piazzolla', Georgia, serif" },
    { label: 'Crimson', value: "'Crimson Pro', Georgia, serif" },
    { label: 'Source Serif', value: "'Source Serif 4', Georgia, serif" },
  ] },
  { name: 'humanist', italic: false, options: [
    { label: 'Lora', value: "'Lora', Georgia, serif" },
    { label: 'Literata', value: "'Literata', Georgia, serif" },
  ] },
  { name: 'mono', italic: true, options: [
    { label: 'JetBrains', value: "'JetBrains Mono', monospace" },
    { label: 'Geist Mono', value: "'Geist Mono', monospace" },
    { label: 'Space Mono', value: "'Space Mono', monospace" },
  ] },
]

// Class strings shared by the panel's non-primitive parts (DESIGN.md tokens).
const hint = 'text-lab-xs leading-snug text-lab-fg-subtle'
const em = 'text-lab-fg-muted'
const fieldLabel = 'block text-lab-xs text-lab-fg-muted'
const colorInput =
  'size-6 shrink-0 rounded border border-lab-border cursor-pointer bg-transparent p-0 lab-focus [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0'
const cycleButton =
  'w-14 min-h-6 shrink-0 text-left bg-transparent border-0 rounded text-lab-xs text-lab-fg-muted hover:text-lab-fg cursor-pointer transition-colors lab-focus'
/** Small text link such as "reset to base": padding gives it a 24px hit area. */
const linkButton =
  'self-start min-h-6 px-1 -mx-1 bg-transparent border-0 rounded text-lab-xs text-lab-fg-subtle hover:text-lab-fg-muted cursor-pointer transition-colors lab-focus'
const accentOn = 'border-lab-accent/40 bg-lab-accent/15 text-lab-accent'
/** Action button (Export, Copy Config, Reshuffle); `done` flashes the accent. */
const action = (done = false) =>
  `min-h-6 shrink-0 px-2 rounded-md border cursor-pointer text-lab-xs font-medium transition-colors lab-focus ${
    done ? accentOn : 'border-lab-border bg-lab-fill text-lab-fg-muted hover:text-lab-fg hover:bg-lab-fill-hover'
  }`

function opts<T extends string | number>(values: readonly T[]): SegmentedOption<T>[] {
  return values.map((v) => ({ value: v, label: String(v) }))
}

/** One on/off setting. `label` names the button when its text is only the state. */
function Toggle({ on, onClick, label, title, className = '', children }: {
  on: boolean
  onClick: () => void
  label?: string
  title?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={title}
      className={`min-h-6 min-w-9 shrink-0 px-2 rounded-md border text-lab-xs font-medium cursor-pointer transition-colors lab-focus ${className} ${
        on ? accentOn : 'border-lab-border bg-lab-fill text-lab-fg-subtle hover:text-lab-fg-muted hover:bg-lab-fill-hover'
      }`}
    >
      {children ?? (on ? 'On' : 'Off')}
    </button>
  )
}

function ToggleRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-lab-xs text-lab-fg-muted">{label}</span>
      <Toggle on={on} onClick={onClick} label={label} />
    </div>
  )
}

/** ponytail: Segmented has no wrap prop, and the 320px panel cannot fit seven
 *  shapes or presets on one line. `*:flex-wrap` wraps its track from outside.
 *  Upgrade path: add `wrap` (and a grid layout) to Segmented. */
function Wrap({ children, grid = false }: { children: ReactNode; grid?: boolean }) {
  return <div className={grid ? '*:grid *:grid-cols-2' : '*:flex-wrap'}>{children}</div>
}

/** Visible field label + Segmented. `name` is the group's accessible name. */
function Choice<T extends string | number>({ label, name, options, value, onChange, stretch }: {
  label?: string
  name: string
  options: SegmentedOption<T>[]
  value: T | null
  onChange: (value: T) => void
  stretch?: boolean
}) {
  return (
    <div className="space-y-1">
      {label && <span className={fieldLabel}>{label}</span>}
      <Wrap>
        <Segmented size="xs" label={name} options={options} value={value} onChange={onChange} stretch={stretch} />
      </Wrap>
    </div>
  )
}

/** Two-line option label: a name and a short description. */
function OptionLabel({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="block text-left">
      <span className="block">{title}</span>
      <span className="block text-lab-xs font-normal text-lab-fg-subtle">{sub}</span>
    </span>
  )
}

/** Opens one of the four big groups (Scene, Animation, Hover, Text). */
function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="pt-2 mt-1 border-t border-lab-border-strong">
      <SectionLabel level={3}>{children}</SectionLabel>
    </div>
  )
}

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
  const btn = state.button
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


  const cv = copyVariants[state.copyVariant]

  return (
    <div className="border-b border-lab-border">
      {/* Section header */}
      <div className="px-3 py-2 border-b border-lab-border">
        <SectionLabel
          level={3}
          action={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={exportCode} className={action(codeCopied)}>
                {codeCopied ? 'Exported!' : 'Export'}
              </button>
              <button type="button" onClick={copySettings} className={action()}>
                {copied ? 'Copied!' : 'Copy Config'}
              </button>
              {/* Red is a scoped exception (DESIGN.md): no lab token marks a destructive reset. */}
              {hasChanges && (
                <button
                  type="button"
                  onClick={resetDither}
                  className="min-h-6 px-1.5 rounded-md bg-transparent border-0 text-lab-xs font-medium text-red-400 hover:text-red-300 cursor-pointer transition-colors lab-focus"
                >
                  Reset
                </button>
              )}
            </div>
          }
        >
          Dither
        </SectionLabel>
      </div>

      <div className="px-3 py-2 space-y-2">
        {/* ══ GROUP: SCENE ══ */}
        <GroupLabel>Scene</GroupLabel>

        {/* ─── Initial State (Problem ⇄ Fix) ─── */}
        <div className="space-y-1">
          <SectionLabel level={4}>Initial State</SectionLabel>
          <Segmented
            size="xs"
            stretch
            label="Initial state"
            value={state.initialState}
            onChange={(v) => setInitialState(v)}
            options={[
              { value: 'problem', label: <OptionLabel title="Problem" sub="pink · at rest" /> },
              { value: 'fix', label: <OptionLabel title="Fix" sub="green · at rest" /> },
            ]}
          />
          <p className={hint}>Visible at rest. The other state becomes the hover reveal.</p>
        </div>

        {/* ─── Dithering Shader ─── */}
        <SectionLabel
          level={4}
          className="pt-1"
          action={
            <button
              type="button"
              onClick={copySettings}
              className={action(copied)}
              title="Copy the full config (all sections) as JSON to paste back"
            >
              {copied ? 'Copied!' : 'Copy Config'}
            </button>
          }
        >
          Dithering Shader · the resting effect
        </SectionLabel>
        <p className={hint}>This controls what you see by default. <span className={em}>Shape</span> = click the name on each Alpha Layer below · <span className={em}>Cell Size</span> + <span className={em}>Scale</span> size it.</p>

        {/* Back color + Alpha toggle */}
        <div className="space-y-1">
          <span className={fieldLabel}>Back</span>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              aria-label="Back colour"
              value={c.colorBack}
              onChange={(e) => setShaderConfig({ colorBack: e.target.value })}
              className={colorInput}
            />
            <span className="text-lab-xs text-lab-fg-subtle font-mono">{c.colorBack}</span>
            <Toggle
              className="ml-auto"
              on={c.transparentBg}
              onClick={() => setShaderConfig({ transparentBg: !c.transparentBg })}
              label="Transparent background"
              title="Make shader background transparent — dots float over section bg"
            >
              {c.transparentBg ? 'Alpha' : 'Solid'}
            </Toggle>
          </div>
        </div>

        {c.transparentBg ? (
          <div className="space-y-1.5">
            <span className={fieldLabel}>Alpha Layers</span>
            {c.alphaLayers.map((layer, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="color"
                  aria-label={`Alpha layer ${i + 1} colour`}
                  value={layer.color}
                  onChange={(ev) => setAlphaLayer(i, { color: ev.target.value })}
                  className={colorInput}
                />
                <button
                  type="button"
                  onClick={() => {
                    const idx = SHAPES.indexOf(layer.shape)
                    setAlphaLayer(i, { shape: SHAPES[(idx + 1) % SHAPES.length] })
                  }}
                  className={cycleButton}
                  aria-label={`Alpha layer ${i + 1} shape: ${layer.shape}`}
                  title="Click to cycle shape"
                >
                  {layer.shape}
                </button>
                <input
                  type="range"
                  aria-label={`Alpha layer ${i + 1} opacity`}
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={layer.opacity}
                  onChange={(ev) => setAlphaLayer(i, { opacity: parseFloat(ev.target.value) })}
                  className="lab-range lab-focus flex-1 min-w-0"
                />
                <span className="w-8 text-right text-lab-xs text-lab-fg-subtle font-mono tabular-nums">{layer.opacity}</span>
              </div>
            ))}
            <SliderRow label="Color Cycle" value={c.colorCycleSpeed} min={0} max={2} step={0.05} onChange={(v) => setShaderConfig({ colorCycleSpeed: v })} />
          </div>
        ) : (
          <div className="space-y-1">
            <span className={fieldLabel}>Front</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                aria-label="Front colour"
                value={c.colorFront}
                onChange={(e) => setShaderConfig({ colorFront: e.target.value })}
                className={colorInput}
              />
              <span className="text-lab-xs text-lab-fg-subtle font-mono">{c.colorFront}</span>
            </div>
          </div>
        )}

        {/* Shape — hidden in alpha mode (each layer has its own shape) */}
        {!c.transparentBg && (
          <Choice label="Shape" name="Dither shape" options={opts(SHAPES)} value={c.shape} onChange={(s) => setShaderConfig({ shape: s })} />
        )}

        {/* Type */}
        <Choice label="Type" name="Dither type" options={opts(TYPES)} value={c.type} onChange={(t) => setShaderConfig({ type: t })} />

        {/* Size — merged into Pixel Grid Tile Size when the grid is locked */}
        {pg.enabled && pg.snap ? (
          <p className={hint}>
            Cell Size is locked to <span className={em}>Pixel Grid → Tile Size</span> (one dot per tile). Adjust it there.
          </p>
        ) : (
          <SliderRow label="Cell Size" value={c.size} min={0.5} max={20} step={0.5} onChange={(v) => setShaderConfig({ size: v })} />
        )}

        {/* ─── Motion ─── */}
        <SectionLabel level={4} className="pt-1">Motion</SectionLabel>

        <SliderRow label="Speed" value={c.speed} min={0} max={2} step={0.05} onChange={(v) => setShaderConfig({ speed: v })} />
        <SliderRow label="Frame" value={c.frame} min={0} max={100} step={0.5} onChange={(v) => setShaderConfig({ frame: v })} />

        {/* ─── Sizing ─── */}
        <SectionLabel level={4} className="pt-1">Sizing</SectionLabel>

        {/* Fit */}
        <Choice label="Fit" name="Shader fit" options={opts(FITS)} value={c.fit} onChange={(f) => setShaderConfig({ fit: f })} />

        <SliderRow label="Scale" value={c.scale} min={0.01} max={4} step={0.05} onChange={(v) => setShaderConfig({ scale: v })} />
        <SliderRow label="Rotation" value={c.rotation} min={0} max={360} step={1} suffix="°" onChange={(v) => setShaderConfig({ rotation: v })} />
        <SliderRow label="Offset X" value={c.offsetX} min={-1} max={1} step={0.05} onChange={(v) => setShaderConfig({ offsetX: v })} />
        <SliderRow label="Offset Y" value={c.offsetY} min={-1} max={1} step={0.05} onChange={(v) => setShaderConfig({ offsetY: v })} />
        <SliderRow label="Origin X" value={c.originX} min={0} max={1} step={0.05} onChange={(v) => setShaderConfig({ originX: v })} />
        <SliderRow label="Origin Y" value={c.originY} min={0} max={1} step={0.05} onChange={(v) => setShaderConfig({ originY: v })} />
        <SliderRow label="World Width" value={c.worldWidth} min={0.1} max={10} step={0.1} onChange={(v) => setShaderConfig({ worldWidth: v })} />
        <SliderRow label="World Height" value={c.worldHeight} min={0.1} max={10} step={0.1} onChange={(v) => setShaderConfig({ worldHeight: v })} />

        {/* ─── Pixel Grid (mosaic mask) ─── */}
        <div className="space-y-1.5">
          <SectionLabel
            level={4}
            className="pt-1"
            action={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={copySettings}
                  className={action(copied)}
                  title="Copy the full config (pixel grid + edge + everything) as JSON to paste back later"
                >
                  {copied ? 'Copied!' : 'Copy Config'}
                </button>
                <Toggle on={pg.enabled} onClick={() => setPixelGridConfig({ enabled: !pg.enabled })} label="Pixel Grid" />
              </div>
            }
          >
            Pixel Grid
          </SectionLabel>
          {pg.enabled && (
            <div className="space-y-1.5">
              {(() => {
                const piece = Math.max(2, Math.round(pg.cell / Math.max(1, pg.divisions)))
                return (
                  <p className={hint}>
                    <span className={em}>Tile {pg.cell}px ÷ {pg.divisions}</span> = {piece}px pieces. <span className={em}>Gap</span> splits each piece. Pieces always tile the master exactly.
                  </p>
                )
              })()}
              {/* Snap — lock dither to the tile grid for clean cuts */}
              <ToggleRow label="Snap to dither" on={pg.snap} onClick={() => setPixelGridConfig({ snap: !pg.snap })} />
              <p className={hint}>
                {pg.snap
                  ? a.tileDisplay === 'color'
                    ? 'One stable sample per tile — scene color and alpha flow continuously without hard WebGL threshold flashes.'
                    : 'Axis-aligns the dither and sizes one dot per tile — clean edges. Use Align to phase-lock onto the dots.'
                  : 'Off = free overlay (tiles cut across the dither — ragged edges).'}
              </p>
              <SliderRow label="Tile Size" value={pg.cell} min={8} max={160} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ cell: v })} />
              <SliderRow label="Divide into" value={pg.divisions} min={1} max={8} step={1} suffix=" pcs" onChange={(v) => setPixelGridConfig({ divisions: v })} />
              <SliderRow label="Gap" value={pg.gap} min={0} max={Math.max(1, Math.round(pg.cell / Math.max(1, pg.divisions)) - 1)} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ gap: v })} />
              <SliderRow label="Corner Radius" value={pg.radius} min={0} max={40} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ radius: v })} />
              {pg.snap && (
                <>
                  <SliderRow label="Align X" value={pg.alignX} min={0} max={Math.round(pg.cell / Math.max(1, pg.divisions))} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ alignX: v })} />
                  <SliderRow label="Align Y" value={pg.alignY} min={0} max={Math.round(pg.cell / Math.max(1, pg.divisions))} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ alignY: v })} />
                </>
              )}
              <Choice
                label="Tile animation"
                name="Tile animation"
                options={[
                  { value: 'color' as TileDisplayMode, label: 'Color / alpha' },
                  // 'Mask size' removed: it produced the same size-modulated-dot
                  // look as Point sizes, but via a flicker-prone 12fps async blob
                  // mask over the WebGL layers. Point sizes is the clean version.
                  { value: 'points' as TileDisplayMode, label: 'Point sizes' },
                ]}
                value={a.tileDisplay}
                onChange={(v) => setAnimationConfig({ tileDisplay: v })}
              />
              {a.tileDisplay === 'points' && (() => {
                const r = tileSizeRangeFromGrid(pg, a.tileSizeSpread * TILE_SIZE_EFFECT_STRENGTH)
                return (
                <>
                  <p className={hint}>
                    {`Direct point renderer: ${r.pitch}px pitch, ${r.gap}px gap -> visible pieces ${r.minPiece}-${r.maxPiece}px.`}
                  </p>
                  <SliderRow label="Size spread" value={a.tileSizeSpread} min={0} max={1} step={0.05} onChange={(v) => setAnimationConfig({ tileSizeSpread: v })} />
                  <SliderRow label="Size speed" value={a.tileSizeSpeed} min={0.02} max={0.3} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ tileSizeSpeed: v })} />
                  <SliderRow label="Map scale" value={a.tileSizeNoise} min={0.4} max={3} step={0.1} onChange={(v) => setAnimationConfig({ tileSizeNoise: v })} />
                </>
                )
              })()}
            </div>
          )}
        </div>

        {/* ─── Multi-Color Errors ─── */}
        <div className="space-y-1.5">
          <SectionLabel
            level={4}
            className="pt-1"
            action={<Toggle on={mc.enabled} onClick={() => setMultiColorConfig({ enabled: !mc.enabled })} label="Multi-Color" />}
          >
            Multi-Color
          </SectionLabel>
          {mc.enabled && (
            <div className="space-y-1.5">
              {/* Color swatches */}
              <div className="space-y-1">
                <span className={fieldLabel}>Error Colors</span>
                <div className="flex items-center gap-1.5">
                  {mc.colors.map((color, i) => (
                    <input
                      key={i}
                      type="color"
                      aria-label={`Error colour ${i + 1}`}
                      value={color}
                      onChange={(ev) => setMultiColorAt(i, ev.target.value)}
                      className={colorInput}
                    />
                  ))}
                  <span className="text-lab-xs text-lab-fg-subtle ml-1">+ base</span>
                </div>
              </div>
              <SliderRow label="Layer Spread" value={mc.layerSpread} min={0.02} max={0.5} step={0.01} onChange={(v) => setMultiColorConfig({ layerSpread: v })} />
              {/* Blend mode */}
              <Choice label="Blend" name="Multi-color blend" options={opts(['normal', 'screen', 'multiply', 'overlay'] as const)} value={mc.blend} onChange={(b) => setMultiColorConfig({ blend: b })} />
            </div>
          )}
        </div>

        {/* ─── Edge ─── */}
        <div className="space-y-1.5">
          <SectionLabel level={4} className="pt-1">Section Edge</SectionLabel>
          <Choice name="Section edge style" options={EDGE_MODES} value={e.mode} onChange={(m) => setEdgeConfig({ mode: m })} />
          {e.mode !== 'full' && (
            <SliderRow label="Position" value={e.position} min={30} max={95} step={1} suffix="%" onChange={(v) => setEdgeConfig({ position: v })} />
          )}
          <SliderRow label="Top start" value={e.topInset} min={0} max={160} step={4} suffix="px" onChange={(v) => setEdgeConfig({ topInset: v })} />
          <p className={hint}>
            Places the whole field — the first row starts exactly at this line and every row
            shifts with it (whole shapes, never cut by the header). ~77px clears the nav.
          </p>
          {e.mode === 'full' && (
            <>
              <p className={hint}>
                Fills the whole hero with shapes and flows around the headline, copy, and CTAs —
                whole tiles only (never cut), with a dissolve rim at each text block. Works with
                the <span className={em}>Point sizes</span> tile animation.
              </p>
              <SliderRow label="Text padding" value={e.fullPadding} min={8} max={72} step={2} suffix="px" onChange={(v) => setEdgeConfig({ fullPadding: v })} />
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-lab-xs text-lab-fg-muted">Clearance follows</span>
                <Segmented
                  size="xs"
                  label="Clearance follows"
                  options={[{ value: 'lines', label: 'Text lines' }, { value: 'box', label: 'Block box' }]}
                  value={e.textRectMode}
                  onChange={(m) => setEdgeConfig({ textRectMode: m })}
                />
              </div>
              <SliderRow label="Rim depth" value={e.dissolveDepth} min={1} max={20} step={1} suffix=" rows" onChange={(v) => setEdgeConfig({ dissolveDepth: v })} />
              <SliderRow label="Rim motion" value={e.textBlendMotion} min={0} max={1} step={0.05} onChange={(v) => setEdgeConfig({ textBlendMotion: v })} />
              {e.textBlendMotion > 0 && (
                <SliderRow label="Motion speed" value={e.textBlendSpeed} min={0.02} max={0.4} step={0.01} suffix=" Hz" onChange={(v) => setEdgeConfig({ textBlendSpeed: v })} />
              )}
              <button
                type="button"
                onClick={() => setEdgeConfig({ dissolveSeed: e.dissolveSeed + 1 })}
                className={action()}
                title="Reshuffle which rim tiles drop out"
              >
                Reshuffle
              </button>
            </>
          )}
          {e.mode !== 'full' && (
            <>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-lab-xs text-lab-fg-muted">Scene behind text</span>
                <Toggle
                  on={e.textBlend}
                  onClick={() => setEdgeConfig({
                    textBlend: !e.textBlend,
                    ...(!e.textBlend && e.shaderExtend === 0 ? { shaderExtend: 160 } : {}),
                  })}
                  label="Scene behind text"
                />
              </div>
              <p className={hint}>
                {e.textBlend
                  ? 'The scene passes into the copy area but keeps a clear zone around every text block — whole shapes only, never cut. Works with any edge style.'
                  : 'Solid text bg hides tiles underneath. Turn on to let the scene flow around the text.'}
              </p>
              {e.textBlend && (
                <>
                  <SliderRow
                    label="Section extend"
                    value={e.shaderExtend}
                    min={0}
                    max={600}
                    step={8}
                    suffix="px"
                    onChange={(v) => setEdgeConfig({ shaderExtend: v })}
                  />
                  <p className={hint}>
                    How far the scene can overflow below Position into the copy area.
                  </p>
                  <SliderRow label="Text clearance" value={e.textPadding} min={0} max={96} step={2} suffix="px" onChange={(v) => setEdgeConfig({ textPadding: v })} />
                  <p className={hint}>
                    Free space kept around the headline, copy, and CTAs. A shape that would
                    enter this zone is dropped whole — no clipped tiles at the text boundary.
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-lab-xs text-lab-fg-muted">Clearance follows</span>
                    <Segmented
                      size="xs"
                      label="Clearance follows"
                      options={[{ value: 'lines', label: 'Text lines' }, { value: 'box', label: 'Block box' }]}
                      value={e.textRectMode}
                      onChange={(m) => setEdgeConfig({ textRectMode: m })}
                    />
                  </div>
                  <p className={hint}>
                    Text lines hugs every rendered line — shapes fill in beside short lines.
                    Block box clears the whole text rectangle for calmer negative space.
                  </p>
                </>
              )}
            </>
          )}
          {e.mode === 'dissolve' && (
            <>
              <p className={hint}>
                Tiles drop out near the edge and through the text overflow — an organic blend instead of a straight line.
              </p>
              <SliderRow label="Dissolve Depth" value={e.dissolveDepth} min={1} max={20} step={1} suffix=" rows" onChange={(v) => setEdgeConfig({ dissolveDepth: v })} />
              <SliderRow label="Dissolve motion" value={e.textBlendMotion} min={0} max={1} step={0.05} onChange={(v) => setEdgeConfig({ textBlendMotion: v })} />
              {e.textBlendMotion > 0 && (
                <SliderRow label="Motion speed" value={e.textBlendSpeed} min={0.02} max={0.4} step={0.01} suffix=" Hz" onChange={(v) => setEdgeConfig({ textBlendSpeed: v })} />
              )}
              <button
                type="button"
                onClick={() => setEdgeConfig({ dissolveSeed: e.dissolveSeed + 1 })}
                className={action()}
                title="Reshuffle which tiles drop out"
              >
                Reshuffle
              </button>
            </>
          )}
          {e.mode === 'ripple' && (
            <>
              {/* Dither — dissolve the wave edge (Photoshop-style) */}
              <ToggleRow label="Dither edge" on={e.rippleDither} onClick={() => setEdgeConfig({ rippleDither: !e.rippleDither })} />
              <p className={hint}>
                {e.rippleDither
                  ? 'Wave dissolves into scattered tiles (white→black threshold dither). Use Depth + Reshuffle below.'
                  : 'Hard wave edge. Turn on Pixelate for a blocky tile-wave.'}
              </p>
              {e.rippleDither && (
                <>
                  <SliderRow label="Dissolve Depth" value={e.dissolveDepth} min={1} max={20} step={1} suffix=" rows" onChange={(v) => setEdgeConfig({ dissolveDepth: v })} />
                  <button
                    type="button"
                    onClick={() => setEdgeConfig({ dissolveSeed: e.dissolveSeed + 1 })}
                    className={action()}
                    title="Reshuffle which tiles drop out"
                  >
                    Reshuffle
                  </button>
                </>
              )}
              {/* Pixelate — build the wave from tiles instead of a smooth curve */}
              {!e.rippleDither && (
                <ToggleRow label="Pixelate (tile wave)" on={e.ripplePixelate} onClick={() => setEdgeConfig({ ripplePixelate: !e.ripplePixelate })} />
              )}
              <SliderRow label="Amplitude" value={e.rippleAmplitude} min={1} max={15} step={0.5} suffix="vh" onChange={(v) => setEdgeConfig({ rippleAmplitude: v })} />
              <SliderRow label="Frequency" value={e.rippleFrequency} min={2} max={20} step={1} suffix=" waves" onChange={(v) => setEdgeConfig({ rippleFrequency: v })} />
              <SliderRow label="Ripple Speed" value={e.rippleSpeed} min={0} max={3} step={0.1} onChange={(v) => setEdgeConfig({ rippleSpeed: v })} />
            </>
          )}
        </div>

        {/* ══ GROUP: ANIMATION ══ */}
        <GroupLabel>Animation</GroupLabel>

        {/* ─── Scene Templates ─── */}
        <div className="space-y-1.5">
          <SectionLabel
            level={4}
            className="pt-1"
            action={
              <Toggle on={a.playing} onClick={() => setAnimationConfig({ playing: !a.playing })} label="Play scene">
                {a.playing ? 'Playing' : 'Paused'}
              </Toggle>
            }
          >
            Scene
          </SectionLabel>
          <p className={hint}>
            Scenes drive motion only — drift, pulse, scan, breathing, loop-break.
            Your shapes, pixel grid, scale, and colors stay exactly as you set them.
          </p>

          {/* Template buttons */}
          <Wrap grid>
            <Segmented
              size="xs"
              label="Scene template"
              value={state.activeScene}
              onChange={(id) => applySceneTemplate(id)}
              options={sceneTemplateIds.map((id) => ({
                value: id,
                label: <OptionLabel title={sceneTemplates[id].label} sub={sceneTemplates[id].desc} />,
              }))}
            />
          </Wrap>

          {/* Tile animation controls live with Pixel Grid because mask/point
              modes derive their geometry from that grid. */}

          {/* Break Loop — non-looping motion layered on top of the scene */}
          <div className="space-y-1 pt-1">
            <SectionLabel level={4} action={<span className="text-lab-xs text-lab-fg-subtle">how it avoids repeating</span>}>
              Break Loop
            </SectionLabel>
            <Choice
              name="Break loop"
              options={[
                { value: 'none', label: 'Off' },
                { value: 'rotate', label: 'Rotate' },
                { value: 'drift', label: 'Drift' },
                { value: 'orbit', label: 'Orbit' },
                { value: 'wander', label: 'Wander' },
              ]}
              value={a.loopBreak}
              onChange={(v) => setAnimationConfig({ loopBreak: v })}
            />
            {a.loopBreak !== 'none' && (
              <SliderRow label="Break Amount" value={a.loopBreakAmount} min={0.1} max={2} step={0.1} suffix="x" onChange={(v) => setAnimationConfig({ loopBreakAmount: v })} />
            )}
            <p className={hint}>
              Rotate = spin colors (never repeats) · Drift = pan · Orbit = both · Wander = turning drift. Stacks on the scene.
            </p>
          </div>

          {/* Fine-tune toggle */}
          <button
            type="button"
            onClick={() => setShowFineTune((v) => !v)}
            aria-expanded={showFineTune}
            className="w-full min-h-6 text-left bg-transparent border-0 rounded text-lab-xs text-lab-fg-subtle hover:text-lab-fg-muted cursor-pointer transition-colors lab-focus"
          >
            {showFineTune ? '▾ Hide fine-tune' : '▸ Fine-tune animation'}
          </button>

          {showFineTune && (
            <div className="space-y-1.5 pl-2 border-l border-lab-border">
              {/* Scan mode toggle */}
              <Choice
                label="Motion"
                name="Fine-tune motion"
                options={[
                  { value: 'continuous' as ScanMode, label: 'Drift' },
                  { value: 'oscillate' as ScanMode, label: 'Scan' },
                ]}
                value={a.scanMode}
                onChange={(m) => setAnimationConfig({ scanMode: m })}
              />

              {a.scanMode === 'oscillate' ? (
                <>
                  <SliderRow label="Scan Amplitude" value={a.scanAmplitude} min={0} max={1.5} step={0.05} onChange={(v) => setAnimationConfig({ scanAmplitude: v })} />
                  <SliderRow label="Scan Speed" value={a.scanSpeed} min={0.01} max={0.2} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ scanSpeed: v })} />
                  <SliderRow label="Scan Angle" value={a.scanAngle} min={0} max={360} step={15} suffix="°" onChange={(v) => setAnimationConfig({ scanAngle: v })} />
                </>
              ) : (
                <>
                  <SliderRow label="Drift Y (fall)" value={a.driftY} min={0} max={0.1} step={0.005} onChange={(v) => setAnimationConfig({ driftY: v })} />
                  <SliderRow label="Drift X (scan)" value={a.driftX} min={-0.05} max={0.05} step={0.005} onChange={(v) => setAnimationConfig({ driftX: v })} />
                </>
              )}

              <SliderRow label="Rotation Drift" value={a.rotationDrift} min={0} max={5} step={0.5} suffix="°/s" onChange={(v) => setAnimationConfig({ rotationDrift: v })} />
              <SliderRow label="Pulse Amount" value={a.pulseAmount} min={0} max={0.15} step={0.005} onChange={(v) => setAnimationConfig({ pulseAmount: v })} />
              <SliderRow label="Pulse Speed" value={a.pulseSpeed} min={0.05} max={0.5} step={0.05} suffix=" Hz" onChange={(v) => setAnimationConfig({ pulseSpeed: v })} />

              {/* Wave sweep */}
              <span className={`${fieldLabel} pt-1`}>Wave Sweep</span>
              <SliderRow label="Wave Amplitude" value={a.waveAmplitude} min={0} max={0.5} step={0.01} onChange={(v) => setAnimationConfig({ waveAmplitude: v })} />
              {a.waveAmplitude > 0 && (
                <>
                  <SliderRow label="Wave Speed" value={a.waveSpeed} min={0.02} max={0.3} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ waveSpeed: v })} />
                  <SliderRow label="Wave Angle" value={a.waveAngle} min={0} max={360} step={15} suffix="°" onChange={(v) => setAnimationConfig({ waveAngle: v })} />
                </>
              )}

              {/* Tile breathing — animate the pixel-grid gap */}
              <span className={`${fieldLabel} pt-1`}>Tile Breathing (gap)</span>
              <SliderRow label="Gap Pulse" value={a.gapPulse} min={0} max={16} step={0.5} suffix="px" onChange={(v) => setAnimationConfig({ gapPulse: v })} />
              {a.gapPulse > 0 && (
                <SliderRow label="Gap Pulse Speed" value={a.gapPulseSpeed} min={0.02} max={0.4} step={0.01} suffix=" Hz" onChange={(v) => setAnimationConfig({ gapPulseSpeed: v })} />
              )}
            </div>
          )}
        </div>

        {/* ══ GROUP: HOVER ══ */}
        <GroupLabel>Hover</GroupLabel>

        {/* ─── Hover Effect ─── */}
        <div className="space-y-1.5">
          <SectionLabel
            level={4}
            className="pt-1"
            action={<Toggle on={h.enabled} onClick={() => setHoverConfig({ enabled: !h.enabled })} label="Hover Reveal" />}
          >
            Hover Reveal
          </SectionLabel>
          {h.enabled && (
            <div className="space-y-1.5">
              {/* Mode toggle */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <Segmented
                  size="xs"
                  label="Hover mode"
                  options={[
                    { value: 'recolor', label: 'Recolor' },
                    { value: 'reveal', label: 'Reveal' },
                    { value: 'warp', label: 'Warp' },
                    { value: 'overlay', label: 'Overlay' },
                  ]}
                  value={h.mode}
                  onChange={(m) => setHoverConfig({ mode: m })}
                />
                <Toggle on={h.preview} onClick={() => setHoverConfig({ preview: !h.preview })}>
                  Preview
                </Toggle>
              </div>
              {h.mode === 'overlay' && (
                <>
                  <p className={hint}>
                    Flat <span className={em}>{h.fixColor}</span> wash over every whole tile
                    in the hover region — no shader swap, just a color overlay on the current scene.
                  </p>
                  <SliderRow label="Opacity" value={h.overlayOpacity} min={0.05} max={1} step={0.05} onChange={(v) => setHoverConfig({ overlayOpacity: v })} />
                  <Choice
                    label="Blend"
                    name="Overlay blend"
                    options={opts(['normal', 'screen', 'multiply', 'overlay', 'soft-light'] as const)}
                    value={h.overlayBlend}
                    onChange={(b) => setHoverConfig({ overlayBlend: b })}
                  />
                </>
              )}
              {(h.mode === 'recolor' || h.mode === 'overlay') && h.mode !== 'overlay' && (
                <>
                  <p className={hint}>
                    {`Recolors the existing tiles under the cursor — the same pattern you see, in the ${state.initialState === 'fix' ? 'problem (pink)' : 'fix (green)'} color.`}
                  </p>
                </>
              )}
              {(h.mode === 'recolor' || h.mode === 'overlay') && (
                <>
                  <ToggleRow label="Whole tiles" on={h.wholeTiles} onClick={() => setHoverConfig({ wholeTiles: !h.wholeTiles })} />
                  <p className={hint}>
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
                  <ToggleRow label="Whole tiles" on={h.wholeTiles} onClick={() => setHoverConfig({ wholeTiles: !h.wholeTiles })} />
                  <p className={hint}>
                    {h.wholeTiles
                      ? 'Snaps the hover rect to the pixel grid — only complete tiles warp.'
                      : 'Tiles warp when their center is inside the rect.'}
                  </p>
                </>
              )}
              {h.mode === 'warp' && (
                <div className="space-y-1.5 rounded-md bg-lab-fill border border-lab-border p-2">
                  <p className={hint}>
                    Warps the <span className={em}>pixel-grid tiles</span> from the resting
                    scene — same shape &amp; gaps, rotated &amp; rounded in the hover region — and recolors warped tiles while keeping the{' '}
                    <span className={em}>same scene pattern</span>. Needs <span className={em}>Pixel Grid</span> on.{' '}
                    <span className={em}>Reach</span> sets the radius; every tile inside is fully transformed (never partial).
                  </p>
                  <SliderRow label="Rotate" value={h.warpRotate} min={0} max={180} step={5} suffix="°" onChange={(v) => setHoverConfig({ warpRotate: v })} />
                  <SliderRow label="Round" value={h.warpRound} min={0} max={1} step={0.05} onChange={(v) => setHoverConfig({ warpRound: v })} />
                  <SliderRow label="Max Size" value={h.warpScale} min={0.2} max={1} step={0.05} onChange={(v) => setHoverConfig({ warpScale: v })} />
                  <SliderRow label="Size Spread" value={h.warpJitter} min={0} max={1.5} step={0.05} onChange={(v) => setHoverConfig({ warpJitter: v })} />
                  <p className={hint}>
                    Tiles stay within the scene piece (gaps preserved).{' '}
                    <span className={em}>Max Size</span> caps warped tiles.{' '}
                    <span className={em}>Size Spread</span> up to 1.5 — big→small mix; more spread = more tiny tiles.{' '}
                    <span className={em}>Dynamic Size</span> widens spread while moving fast.
                  </p>
                  <div className="h-px bg-lab-border my-1" />
                  <ToggleRow
                    label="Reveal Warp"
                    on={h.warpRevealEnabled}
                    onClick={() => setHoverConfig({
                      warpRevealEnabled: !h.warpRevealEnabled,
                      ...(!h.warpRevealEnabled ? { warpRecolorEnabled: false, warpOverlayEnabled: false } : {}),
                    })}
                  />
                  {h.warpRevealEnabled && (
                    <>
                      <p className={hint}>
                        Warped tiles reveal the {state.initialState === 'fix' ? 'problem (pink)' : 'fix (green)'} scene
                        through the pixel circle — a true state peek, not a tint.
                      </p>
                      <ToggleRow label="Error text" on={h.warpErrorText} onClick={() => setHoverConfig({ warpErrorText: !h.warpErrorText })} />
                      <p className={hint}>
                        Short log fragments surface below the cursor while revealing — the errors hiding under the calm.
                      </p>
                    </>
                  )}
                  <ToggleRow
                    label="Recolor Warp"
                    on={h.warpRecolorEnabled}
                    onClick={() => setHoverConfig({ warpRecolorEnabled: !h.warpRecolorEnabled, warpOverlayEnabled: h.warpRecolorEnabled ? h.warpOverlayEnabled : false, ...(!h.warpRecolorEnabled ? { warpRevealEnabled: false } : {}) })}
                  />
                  {h.warpRecolorEnabled && (
                    <>
                      <SliderRow label="Recolor Reach" value={h.warpRecolor} min={0} max={1} step={0.05} onChange={(v) => setHoverConfig({ warpRecolor: v })} />
                      <p className={hint}>
                        Keeps the <span className={em}>same scene pattern</span> — only the tint changes on warped tiles (mirrors base layers in {state.initialState === 'fix' ? 'problem (pink)' : 'fix (green)'}).
                      </p>
                    </>
                  )}
                  {!h.warpRecolorEnabled && (
                    <>
                      <ToggleRow label="Color Overlay" on={h.warpOverlayEnabled} onClick={() => setHoverConfig({ warpOverlayEnabled: !h.warpOverlayEnabled })} />
                      {h.warpOverlayEnabled && (
                        <SliderRow label="Overlay Opacity" value={h.overlayOpacity} min={0.05} max={1} step={0.05} onChange={(v) => setHoverConfig({ overlayOpacity: v })} />
                      )}
                    </>
                  )}
                </div>
              )}
              {/* Trigger toggle */}
              <Choice
                label="Trigger"
                name="Hover trigger"
                options={[{ value: 'instant', label: 'Instant' }, { value: 'dwell', label: 'Dwell' }]}
                value={h.trigger}
                onChange={(t) => setHoverConfig({ trigger: t })}
              />
              {/* Dwell controls */}
              {h.trigger === 'dwell' && (
                <>
                  <SliderRow label="Growth" value={h.dwellSpeed} min={50} max={1000} step={25} suffix=" px/s" onChange={(v) => setHoverConfig({ dwellSpeed: v })} />
                  <SliderRow label="Fade Back" value={h.dwellFadeBack} min={0.5} max={5} step={0.25} suffix="x" onChange={(v) => setHoverConfig({ dwellFadeBack: v })} />
                </>
              )}
              {/* Hover area shape. In Warp mode this defines where tiles are transformed. */}
              <div className="space-y-1">
                <Choice
                  label={h.mode === 'warp' ? 'Hover Area' : 'Shape'}
                  name="Hover shape"
                  options={[
                    { value: 'square', label: 'Square' },
                    { value: 'circle', label: 'Circle' },
                    { value: 'pixel-circle', label: 'Pixel ◯' },
                  ]}
                  value={h.hoverShape}
                  onChange={(s) => setHoverConfig({ hoverShape: s })}
                />
                {h.hoverShape === 'pixel-circle' && (
                  <p className={hint}>
                    Staircased circle of <span className={em}>whole tiles</span> —
                    each tile warps fully or not at all; radius snaps to tile rings. Needs{' '}
                    <span className={em}>Pixel Grid</span> on (else falls
                    back to a hard-edged circle).
                  </p>
                )}
                {h.mode === 'warp' && h.hoverShape !== 'pixel-circle' && (
                  <p className={hint}>
                    {h.hoverShape === 'square'
                      ? 'Whole tiles whose center falls inside the rect — enable Whole Tiles to snap the rect to the grid.'
                      : 'Whole tiles whose center falls inside the circle — each tile is fully transformed, never sliced at the rim.'}
                  </p>
                )}
              </div>
              {/* Hover color */}
              {(h.mode === 'overlay' || h.mode === 'recolor' || (h.mode === 'warp' && (h.warpOverlayEnabled || h.warpRecolorEnabled))) && (
              <div className="space-y-1">
                <span id="dither-hover-color-label" className={fieldLabel}>
                  {h.mode === 'overlay' || (h.mode === 'warp' && h.warpOverlayEnabled) ? 'Overlay Color' : h.mode === 'warp' ? 'Recolor Tint' : 'Tint'}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-labelledby="dither-hover-color-label"
                    value={h.fixColor}
                    onChange={(ev) => setHoverConfig({ fixColor: ev.target.value })}
                    className={colorInput}
                  />
                  <span className="text-lab-xs text-lab-fg-subtle font-mono">{h.fixColor}</span>
                </div>
              </div>
              )}
              {/* Reveal shape controls — per-layer in alpha mode, single in solid */}
              {h.mode === 'reveal' && (
                c.transparentBg ? (
                  <div className="space-y-1.5">
                    <span className={fieldLabel}>Hover Layers</span>
                    {h.hoverLayers.map((layer, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          type="color"
                          aria-label={`Hover layer ${i + 1} colour`}
                          value={layer.color}
                          onChange={(ev) => setHoverLayer(i, { color: ev.target.value })}
                          className={colorInput}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const idx = SHAPES.indexOf(layer.shape)
                            setHoverLayer(i, { shape: SHAPES[(idx + 1) % SHAPES.length] })
                          }}
                          className={cycleButton}
                          aria-label={`Hover layer ${i + 1} shape: ${layer.shape}`}
                          title="Click to cycle shape"
                        >
                          {layer.shape}
                        </button>
                        <input
                          type="range"
                          aria-label={`Hover layer ${i + 1} opacity`}
                          min={0.1}
                          max={1}
                          step={0.05}
                          value={layer.opacity}
                          onChange={(ev) => setHoverLayer(i, { opacity: parseFloat(ev.target.value) })}
                          className="lab-range lab-focus flex-1 min-w-0"
                        />
                        <span className="w-8 text-right text-lab-xs text-lab-fg-subtle font-mono tabular-nums">{layer.opacity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Choice label="Fix Shape" name="Reveal fix shape" options={opts(SHAPES)} value={h.fixShape} onChange={(s) => setHoverConfig({ fixShape: s })} />
                )
              )}
              {/* ── Shader overrides (reveal mode only — recolor mirrors the base) ── */}
              {h.mode === 'reveal' && (<>
              <SectionLabel level={4} className="pt-1">Hover Layer · reveal only</SectionLabel>
              <p className={hint}>These change the hover reveal only — not the resting effect. For the resting effect use <span className={em}>Dithering Shader</span> below.</p>
              {/* Type override */}
              <Choice
                label="Type"
                name="Reveal dither type"
                options={[{ value: 'base', label: 'base' }, ...opts(TYPES)]}
                value={h.fixType ?? 'base'}
                onChange={(t) => setHoverConfig({ fixType: t === 'base' ? undefined : t })}
              />
              {/* Size override */}
              <SliderRow
                label="Reveal Size"
                value={h.fixSize ?? state.shader.size}
                min={0.5} max={20} step={0.5}
                onChange={(v) => setHoverConfig({ fixSize: v })}
              />
              {h.fixSize != null && (
                <button type="button" onClick={() => setHoverConfig({ fixSize: undefined })} className={linkButton}>
                  reset to base
                </button>
              )}
              {/* Speed override */}
              <SliderRow
                label="Reveal Speed"
                value={h.fixSpeed ?? state.shader.speed}
                min={0} max={2} step={0.05}
                onChange={(v) => setHoverConfig({ fixSpeed: v })}
              />
              {h.fixSpeed != null && (
                <button type="button" onClick={() => setHoverConfig({ fixSpeed: undefined })} className={linkButton}>
                  reset to base
                </button>
              )}
              {/* Scale override */}
              <SliderRow
                label="Reveal Scale"
                value={h.fixScale ?? state.shader.scale}
                min={0.01} max={4} step={0.05}
                onChange={(v) => setHoverConfig({ fixScale: v })}
              />
              {h.fixScale != null && (
                <button type="button" onClick={() => setHoverConfig({ fixScale: undefined })} className={linkButton}>
                  reset to base
                </button>
              )}
              {/* Rotation override */}
              <SliderRow
                label="Reveal Rotation"
                value={h.fixRotation ?? state.shader.rotation}
                min={0} max={360} step={1} suffix="°"
                onChange={(v) => setHoverConfig({ fixRotation: v })}
              />
              {h.fixRotation != null && (
                <button type="button" onClick={() => setHoverConfig({ fixRotation: undefined })} className={linkButton}>
                  reset to base
                </button>
              )}
              {/* Offset overrides */}
              <SliderRow
                label="Offset X"
                value={h.fixOffsetX ?? state.shader.offsetX}
                min={-1} max={1} step={0.05}
                onChange={(v) => setHoverConfig({ fixOffsetX: v })}
              />
              <SliderRow
                label="Offset Y"
                value={h.fixOffsetY ?? state.shader.offsetY}
                min={-1} max={1} step={0.05}
                onChange={(v) => setHoverConfig({ fixOffsetY: v })}
              />
              {(h.fixOffsetX != null || h.fixOffsetY != null) && (
                <button type="button" onClick={() => setHoverConfig({ fixOffsetX: undefined, fixOffsetY: undefined })} className={linkButton}>
                  reset offsets to base
                </button>
              )}
              </>)}

              {/* ── Mask ── */}
              <SectionLabel level={4} className="pt-1">Mask</SectionLabel>
              <SliderRow
                label={h.hoverShape === 'square' ? 'Width' : (h.trigger === 'dwell' ? 'Max Radius' : 'Radius')}
                value={h.radius} min={20} max={1600} step={10} suffix="px"
                onChange={(v) => setHoverConfig({ radius: v })}
              />
              {h.trigger === 'dwell' && (
                <p className={hint}>
                  Dwell grows to this size at <span className={em}>Growth</span> px/s,
                  then retracts at Growth × <span className={em}>Fade Back</span> on
                  leave. Max value ≈ full takeover.
                </p>
              )}
              {h.hoverShape === 'square' && (
                <SliderRow label="Height" value={h.radiusY ?? h.radius} min={20} max={1600} step={10} suffix="px" onChange={(v) => setHoverConfig({ radiusY: v })} />
              )}
              {h.hoverShape === 'square' && h.radiusY != null && (
                <button type="button" onClick={() => setHoverConfig({ radiusY: undefined })} className={linkButton}>
                  reset height to match width
                </button>
              )}
              {/* Dynamic sizing toggle */}
              <ToggleRow label="Dynamic Size" on={h.dynamicSize} onClick={() => setHoverConfig({ dynamicSize: !h.dynamicSize })} />
              <SliderRow label="Mouse Influence" value={h.mouseInfluence} min={0} max={1} step={0.05} onChange={(v) => setHoverConfig({ mouseInfluence: v })} />
            </div>
          )}
        </div>

        {/* ─── Haptics ─── */}
        <div className="space-y-1.5">
          <SectionLabel
            level={4}
            className="pt-1"
            action={<Toggle on={hap.enabled} onClick={() => setHapticConfig({ enabled: !hap.enabled })} label="Haptics" />}
          >
            Haptics
          </SectionLabel>
          {hap.enabled && (
            <div className="space-y-1.5">
              <span className={`block ${hint}`}>
                {typeof navigator !== 'undefined' && !navigator.vibrate
                  ? 'Desktop: audio sim auto-on. Move mouse over dithering to feel it.'
                  : 'Mobile: real vibration. Move finger over dithering.'}
              </span>
              {/* Debug audio toggle */}
              <ToggleRow label="Force Debug Audio" on={hap.debug} onClick={() => setHapticConfig({ debug: !hap.debug })} />

              {/* ── Movement texture ── */}
              <SectionLabel level={4} className="pt-1">Movement Texture</SectionLabel>

              {/* Tick distance — how many pixels between each haptic pulse */}
              <SliderRow
                label="Tick Distance"
                value={hap.tickDistance}
                min={0} max={200} step={5}
                suffix="px"
                onChange={(v) => setHapticConfig({ tickDistance: v })}
              />
              <span className={`block ${hint}`}>Pixels of travel per haptic tick. Lower = denser texture.</span>

              {/* Tick pattern */}
              <Choice label="Tick Pattern" name="Tick pattern" options={opts(HAPTIC_PRESETS)} value={hap.tickPattern} onChange={(p) => setHapticConfig({ tickPattern: p })} />

              {/* Velocity intensity */}
              <ToggleRow label="Velocity Intensity" on={hap.velocityIntensity} onClick={() => setHapticConfig({ velocityIntensity: !hap.velocityIntensity })} />
              <span className={`block ${hint}`}>Fast = lighter ticks, slow = heavier press</span>

              {/* ── Events ── */}
              <SectionLabel level={4} className="pt-1">Events</SectionLabel>

              {/* Hover Enter pattern */}
              <Choice label="Hover Enter" name="Hover enter haptic" options={opts(HAPTIC_PRESETS)} value={hap.hoverEnter} onChange={(p) => setHapticConfig({ hoverEnter: p })} />

              {/* Hover Leave pattern */}
              <Choice label="Hover Leave" name="Hover leave haptic" options={opts(HAPTIC_PRESETS)} value={hap.hoverLeave} onChange={(p) => setHapticConfig({ hoverLeave: p })} />

              {/* ── Dwell ── */}
              <SectionLabel level={4} className="pt-1">Dwell Mode</SectionLabel>

              {/* Dwell progress ticks */}
              <SliderRow
                label="Progress Tick"
                value={hap.dwellTickPercent}
                min={0} max={50} step={5}
                suffix="%"
                onChange={(v) => setHapticConfig({ dwellTickPercent: v })}
              />
              <span className={`block ${hint}`}>Haptic every N% of dwell coverage (0 = off)</span>

              {/* Dwell completion */}
              <Choice label="Dwell Complete" name="Dwell complete haptic" options={opts(HAPTIC_PRESETS)} value={hap.dwellComplete} onChange={(p) => setHapticConfig({ dwellComplete: p })} />
            </div>
          )}
        </div>

        {/* ══ GROUP: TEXT & TYPOGRAPHY ══ */}
        <GroupLabel>Text &amp; Typography</GroupLabel>

        {/* ─── Header Background ─── */}
        <div className="space-y-1">
          <SectionLabel level={4}>Header</SectionLabel>
          <Segmented size="xs" stretch label="Header background" options={HEADER_MODES} value={state.headerBg} onChange={(m) => setHeaderBg(m)} />
        </div>

        {/* ─── Buttons / CTA ─── */}
        <div className="space-y-1.5">
          <SectionLabel level={4} className="pt-1">Buttons</SectionLabel>
          <p className={hint}>
            Corner radius &amp; caps for the header and hero CTAs.
          </p>
          <Choice
            name="Button shape"
            options={[
              { label: 'Square', value: 0 },
              { label: 'Rounded', value: 12 },
              { label: 'Pill', value: 999 },
            ]}
            value={btn.radius}
            onChange={(r) => setButtonConfig({ radius: r })}
          />
          <SliderRow label="Corner radius" value={btn.radius > 40 ? 40 : btn.radius} min={0} max={40} step={1} suffix="px" onChange={(v) => setButtonConfig({ radius: v })} />
          <ToggleRow label="Uppercase label" on={btn.uppercase} onClick={() => setButtonConfig({ uppercase: !btn.uppercase })} />
        </div>

        {/* ─── Copy Variation ─── */}
        <div className="space-y-1.5">
          <SectionLabel level={4} className="pt-1">Copy</SectionLabel>
          <Choice
            name="Copy variant"
            stretch
            options={copyVariantIds.map((id) => ({ value: id, label: copyVariants[id].label }))}
            value={state.copyVariant}
            onChange={(id) => setCopyVariant(id)}
          />
          <div className="text-lab-xs text-lab-fg-subtle leading-snug pt-1 space-y-1">
            <p><span className={em}>H:</span> {cv.headline.replace(/\n/g, ' ')}</p>
            {cv.sub && (
              <p><span className={em}>Sub:</span> {cv.sub}</p>
            )}
            <p><span className={em}>CTA:</span> {cv.cta}</p>
          </div>
        </div>

        {/* ─── Layout Grid ─── */}
        <div className="space-y-1.5">
          <SectionLabel level={4} className="pt-1">Layout</SectionLabel>
          <SliderRow label="Headline cols" value={state.layout.headlineCols} min={3} max={10} step={1} onChange={(v) => setLayoutConfig({ headlineCols: v, responseCols: 12 - v })} />
          <SliderRow label="Response cols" value={state.layout.responseCols} min={2} max={9} step={1} onChange={(v) => setLayoutConfig({ responseCols: v, headlineCols: 12 - v })} />
          <SliderRow label="Gutter" value={state.layout.gutter} min={0} max={64} step={1} suffix="px" onChange={(v) => setLayoutConfig({ gutter: v })} />
          <ToggleRow label="Baseline guides" on={state.layout.showBaselines} onClick={() => setLayoutConfig({ showBaselines: !state.layout.showBaselines })} />
          <p className={hint}>
            Draws a magenta line at every text baseline (headline, sub, response, CTAs)
            across the section — check cross-column alignment at a glance.
          </p>
          <ToggleRow label="Guides" on={state.layout.showGuides} onClick={() => setLayoutConfig({ showGuides: !state.layout.showGuides })} />
          <p className={hint}>
            Shades the column grid and draws the content edges: left and right
            (cyan), the header row and the copy block top and bottom (amber).
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
            <div className="space-y-1.5">
              <SectionLabel
                level={4}
                className="pt-1"
                action={anyDirty && (
                  <button type="button" className={linkButton} onClick={resetWtfTitlePositions}>
                    reset
                  </button>
                )}
              >
                Title Positions {anyDirty && <><span aria-hidden="true" className="text-lab-accent">*</span><span className="sr-only">(changed)</span></>}
              </SectionLabel>
              {entries.map(({ key, label }) => {
                const pos = tp[key]
                const dirty = !isDefault(key)
                return (
                  <div key={key} className="space-y-1 pl-2 border-l border-lab-border">
                    <span className="block text-lab-xs font-medium text-lab-fg-muted">
                      {label} {dirty && <><span aria-hidden="true" className="text-lab-accent">*</span><span className="sr-only">(changed)</span></>}
                    </span>
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="w-3 shrink-0 text-lab-xs text-lab-fg-subtle">L</span>
                      <input
                        type="range"
                        aria-label={`${label} left`}
                        min={0} max={100} step={1}
                        value={pos.left}
                        onChange={(e) => setWtfTitlePos(key, { left: parseFloat(e.target.value) })}
                        className="lab-range lab-focus flex-1 min-w-0"
                      />
                      <input
                        type="number"
                        aria-label={`${label} left, percent`}
                        min={0} max={100} step={1}
                        value={pos.left}
                        onChange={(e) => setWtfTitlePos(key, { left: parseFloat(e.target.value) || 0 })}
                        className="w-12 min-h-6 rounded border border-lab-border bg-lab-fill px-1 text-right font-mono text-lab-xs text-lab-fg-muted lab-focus"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="w-3 shrink-0 text-lab-xs text-lab-fg-subtle">T</span>
                      <input
                        type="range"
                        aria-label={`${label} top`}
                        min={0} max={100} step={1}
                        value={pos.top}
                        onChange={(e) => setWtfTitlePos(key, { top: parseFloat(e.target.value) })}
                        className="lab-range lab-focus flex-1 min-w-0"
                      />
                      <input
                        type="number"
                        aria-label={`${label} top, percent`}
                        min={0} max={100} step={1}
                        value={pos.top}
                        onChange={(e) => setWtfTitlePos(key, { top: parseFloat(e.target.value) || 0 })}
                        className="w-12 min-h-6 rounded border border-lab-border bg-lab-fill px-1 text-right font-mono text-lab-xs text-lab-fg-muted lab-focus"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* ─── Typography ─── */}
        <div className="space-y-1.5">
          <SectionLabel level={4} className="pt-1">Typography</SectionLabel>

          {/* ── Headline ── */}
          <div className="space-y-1.5 pl-2 border-l border-lab-border">
            <span className="block text-lab-xs font-medium text-lab-fg">Headline</span>
            {/* Font override */}
            <div className="space-y-1">
              <span className={fieldLabel}>Font</span>
              {HEADLINE_FONT_GROUPS.map((g) => (
                <Wrap key={g.name}>
                  <Segmented
                    size="xs"
                    label={`Headline font, ${g.name}`}
                    options={g.options}
                    value={cv.headlineFont ?? ''}
                    onChange={(f) => setCopyFont({ headlineFont: f || undefined })}
                  />
                </Wrap>
              ))}
            </div>
            {/* Weight */}
            <Choice label="Weight" name="Headline weight" options={opts([400, 500, 700, 800, 900] as const)} value={cv.headlineWeight ?? 900} onChange={(w) => setCopyFont({ headlineWeight: w })} />
            {/* Size */}
            <Choice
              label="Size"
              name="Headline size"
              options={[
                { label: 'S', value: 'clamp(2.8rem, 4vw + 1rem, 4.5rem)' },
                { label: 'M', value: 'clamp(3rem, 5vw + 1rem, 5.5rem)' },
                { label: 'L', value: 'clamp(3.5rem, 5.5vw + 1rem, 6rem)' },
                { label: 'XL', value: 'clamp(4rem, 6vw + 1rem, 7rem)' },
                { label: '2XL', value: 'clamp(4.5rem, 7vw + 1rem, 7.5rem)' },
              ]}
              value={cv.headlineSize ?? null}
              onChange={(s) => setCopyFont({ headlineSize: s })}
            />
            {/* Color */}
            <Choice
              label="Color"
              name="Headline color"
              options={[{ value: 'current', label: 'Current' }, { value: 'white', label: 'White (safe)' }]}
              value={cv.headlineColorMode ?? 'current'}
              onChange={(m) => setCopyFont({ headlineColorMode: m })}
            />
            {/* Tracking */}
            <Choice
              label="Tracking"
              name="Headline tracking"
              options={[
                { label: 'Tight', value: '-0.04em' },
                { label: 'Normal', value: '-0.03em' },
                { label: 'Loose', value: '-0.02em' },
                { label: 'Wide', value: '-0.01em' },
              ]}
              value={cv.headlineTracking ?? '-0.03em'}
              onChange={(t) => setCopyFont({ headlineTracking: t })}
            />
            {/* Leading */}
            <Choice
              label="Leading"
              name="Headline leading"
              options={opts(['0.85', '0.9', '0.95', '1.0', '1.1', '1.2'] as const)}
              value={cv.headlineLeading ?? '0.95'}
              onChange={(l) => setCopyFont({ headlineLeading: l })}
            />
          </div>

          {/* ── Response ── */}
          {cv.layout === 'problem' && cv.response && (
            <div className="space-y-1.5 pl-2 border-l border-lab-border">
              <span className="block text-lab-xs font-medium text-lab-fg">Response</span>
              {/* Font override */}
              <div className="space-y-1">
                <span className={fieldLabel}>Font</span>
                <Wrap>
                  <Segmented
                    size="xs"
                    label="Response font, panel"
                    options={[
                      { value: 'panel', label: 'Panel' },
                      { value: 'headline', label: '= Headline', title: 'Same font as headline, smaller size' },
                    ]}
                    value={cv.responseFontMode === 'headline' ? 'headline' : !cv.responseFont ? 'panel' : null}
                    onChange={(m) => setCopyFont(m === 'headline'
                      ? { responseFont: undefined, responseFontMode: 'headline' }
                      : { responseFont: undefined, responseFontMode: undefined })}
                  />
                </Wrap>
                {RESPONSE_FONT_GROUPS.map((g) => (
                  <Wrap key={g.name}>
                    <Segmented
                      size="xs"
                      label={`Response font, ${g.name}`}
                      options={g.options}
                      value={cv.responseFont ?? null}
                      onChange={(f) => setCopyFont(g.italic
                        ? { responseFont: f, responseFontStyle: 'italic', responseFontMode: 'custom' }
                        : { responseFont: f, responseFontMode: 'custom' })}
                    />
                  </Wrap>
                ))}
              </div>
              {/* Weight */}
              <Choice label="Weight" name="Response weight" options={opts([300, 400, 500, 600, 700] as const)} value={cv.responseWeight ?? 400} onChange={(w) => setCopyFont({ responseWeight: w })} />
              {/* Style */}
              <Choice
                label="Style"
                name="Response style"
                options={[
                  { value: '', label: 'Panel' },
                  { value: 'italic', label: 'Italic' },
                  { value: 'normal', label: 'Normal' },
                ]}
                value={cv.responseFontStyle ?? ''}
                onChange={(s) => setCopyFont({ responseFontStyle: s || undefined })}
              />
              {/* Size */}
              <Choice
                label="Size"
                name="Response size"
                options={[
                  { label: 'XS', value: '28px' },
                  { label: 'S', value: '36px' },
                  { label: 'M', value: '44px' },
                  { label: 'L', value: '48px' },
                  { label: 'XL', value: '56px' },
                ]}
                value={cv.responseSize ?? '48px'}
                onChange={(s) => setCopyFont({ responseSize: s })}
              />
              {/* Tracking */}
              <Choice
                label="Tracking"
                name="Response tracking"
                options={[
                  { label: 'Tight', value: '-0.03em' },
                  { label: 'Normal', value: '-0.01em' },
                  { label: 'None', value: '0em' },
                  { label: 'Loose', value: '0.02em' },
                  { label: 'Wide', value: '0.05em' },
                ]}
                value={cv.responseTracking ?? '0em'}
                onChange={(t) => setCopyFont({ responseTracking: t })}
              />
              {/* Leading */}
              <Choice
                label="Leading"
                name="Response leading"
                options={opts(['1.0', '1.1', '1.2', '1.3'] as const)}
                value={cv.responseLeading ?? '1.1'}
                onChange={(l) => setCopyFont({ responseLeading: l })}
              />
              {/* Color */}
              <Choice
                label="Color"
                name="Response color"
                options={[{ value: 'current', label: 'Current' }, { value: 'white', label: 'White (safe)' }]}
                value={cv.responseColorMode ?? 'current'}
                onChange={(m) => setCopyFont({ responseColorMode: m })}
              />

              {/* ── Elevate ── */}
              <div className="space-y-1.5 pt-1.5 mt-1.5 border-t border-lab-border">
                <span className="block text-lab-xs font-medium text-lab-fg">Elevate</span>
                {/* Separator */}
                <Choice
                  label="Separator"
                  name="Response separator"
                  options={[
                    { label: 'None', value: 'none' as const },
                    { label: 'Line', value: 'line' as const },
                    { label: 'Dots', value: 'dots' as const },
                    { label: 'Fade', value: 'fade' as const },
                  ]}
                  value={cv.responseSeparator ?? 'none'}
                  onChange={(s) => setCopyFont({ responseSeparator: s })}
                />
                {/* Bubble */}
                <Choice
                  label="Bubble"
                  name="Response bubble"
                  options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
                  value={cv.responseBubble ? 'on' : 'off'}
                  onChange={(b) => setCopyFont({ responseBubble: b === 'on' })}
                />
                {/* Bubble options — only when bubble is on */}
                {cv.responseBubble && (
                  <>
                    {/* Corner radius */}
                    <Choice
                      label="Radius"
                      name="Bubble radius"
                      options={[
                        { label: 'Subtle', value: '8px' },
                        { label: 'Medium', value: '16px' },
                        { label: 'Round', value: '24px' },
                        { label: 'Pill', value: '999px' },
                      ]}
                      value={cv.responseBubbleRadius ?? '16px'}
                      onChange={(r) => setCopyFont({ responseBubbleRadius: r })}
                    />
                    {/* Bubble color/opacity. The rgba values are hero data
                        (the bubble fill written to the copy), not lab styling. */}
                    <Choice
                      label="Fill"
                      name="Bubble fill"
                      options={[
                        { label: 'Ghost', value: 'rgba(255,255,255,0.04)' },
                        { label: 'Subtle', value: 'rgba(255,255,255,0.07)' },
                        { label: 'Soft', value: 'rgba(255,255,255,0.10)' },
                        { label: 'Teal', value: 'rgba(45,212,168,0.08)' },
                      ]}
                      value={cv.responseBubbleColor ?? 'rgba(255,255,255,0.07)'}
                      onChange={(f) => setCopyFont({ responseBubbleColor: f })}
                    />
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
