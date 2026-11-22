import { useState, type ReactNode } from 'react'
import {
  useDitherStore,
  setShaderConfig,
  setHoverConfig,
  setHoverLayer,
  setInitialState,
  setPixelGridConfig,
  setAlphaLayer,
  setAnimationConfig,
  setCopyVariant,
  setLayoutConfig,
  setButtonConfig,
  applyHeroTemplate,
  heroTemplates,
  copyVariants,
  copyVariantIds,
  type DitheringShape,
} from './ditherStore'
import Segmented from '../../lab/ui/Segmented'
import SliderRow from '../../lab/ui/SliderRow'
import SectionLabel from '../../lab/ui/SectionLabel'
import Toggle from '../../lab/ui/Toggle'

/* The Design Panel keeps only settings that cannot break the resting state or
   the hover: colour, size, speed, shape and the warp. Renderer, edge, scene and
   hover-mode choices belong to the templates (see
   docs/architecture/2026-11-21-state-machines.md). */

const SHAPES: DitheringShape[] = ['simplex', 'warp', 'dots', 'wave', 'ripple', 'swirl', 'sphere']

const fieldLabel = 'block text-lab-xs text-lab-fg-muted'
const hint = 'text-lab-xs leading-snug text-lab-fg-subtle'
const colorInput =
  'size-6 shrink-0 rounded border border-lab-border cursor-pointer bg-transparent p-0 lab-focus [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0'
/** Native select for the seven dither shapes (Segmented contract: more than
 *  about six options → select). */
const select =
  'min-h-6 min-w-0 flex-1 rounded-md border border-lab-border bg-lab-fill px-1.5 text-lab-xs text-lab-fg-muted hover:bg-lab-fill-hover cursor-pointer lab-focus'
const action =
  'min-h-6 shrink-0 px-2 rounded-md border border-lab-border bg-lab-fill text-lab-xs font-medium text-lab-fg-muted hover:text-lab-fg hover:bg-lab-fill-hover cursor-pointer transition-colors lab-focus'

function Group({ title, action: groupAction, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 pt-3 first:pt-0">
      <SectionLabel level={4} action={groupAction}>{title}</SectionLabel>
      {children}
    </section>
  )
}

export default function DitherPanel() {
  const state = useDitherStore()
  const c = state.shader
  const pg = state.pixelGrid
  const a = state.animation
  const h = state.hover
  const [copied, setCopied] = useState(false)

  const pitch = Math.max(2, Math.round(pg.cell / Math.max(1, pg.divisions)))
  const otherState = state.initialState === 'fix' ? 'problem' : 'fix'

  function copyConfig() {
    const { activeTemplate, initialState, activeScene, shader, edge, hover, pixelGrid, animation, layout, button, copyVariant } = state
    navigator.clipboard.writeText(JSON.stringify(
      { _ditherConfig: 2, activeTemplate, initialState, activeScene, copyVariant, shader, edge, hover, pixelGrid, animation, layout, button },
      null, 2,
    ))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border-b border-lab-border">
      <div className="px-3 py-2 border-b border-lab-border">
        <SectionLabel
          level={3}
          action={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={copyConfig} className={action} aria-live="polite">
                {copied ? 'Copied' : 'Copy config'}
              </button>
              <button
                type="button"
                onClick={() => applyHeroTemplate(state.activeTemplate ?? heroTemplates[0].id)}
                title="Back to the template as authored"
                className="min-h-6 px-1.5 rounded-md bg-transparent border-0 text-lab-xs font-medium text-lab-danger hover:text-lab-fg cursor-pointer transition-colors lab-focus"
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
        <Group title="Colour">
          <Segmented
            size="xs"
            stretch
            label="Initial state"
            value={state.initialState}
            onChange={setInitialState}
            options={[
              { value: 'problem', label: 'Problem at rest' },
              { value: 'fix', label: 'Fix at rest' },
            ]}
          />
          <div className="flex items-center gap-1.5">
            <input type="color" aria-label="Background colour" value={c.colorBack}
              onChange={(e) => setShaderConfig({ colorBack: e.target.value })} className={colorInput} />
            <span className="text-lab-xs text-lab-fg-muted">Background</span>
            <span className="ml-auto text-lab-xs text-lab-fg-subtle font-mono">{c.colorBack}</span>
          </div>
          <span className={fieldLabel}>Layers at rest</span>
          {c.alphaLayers.map((layer, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input type="color" aria-label={`Layer ${i + 1} colour`} value={layer.color}
                onChange={(e) => setAlphaLayer(i, { color: e.target.value })} className={colorInput} />
              <select
                aria-label={`Layer ${i + 1} shape`}
                value={layer.shape}
                onChange={(e) => setAlphaLayer(i, { shape: e.target.value as DitheringShape })}
                className={select}
              >
                {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className={`${fieldLabel} mr-auto`}>Revealed on hover ({otherState})</span>
            {h.hoverLayers.map((layer, i) => (
              <input key={i} type="color" aria-label={`Revealed layer ${i + 1} colour`} value={layer.color}
                onChange={(e) => setHoverLayer(i, { color: e.target.value })} className={colorInput} />
            ))}
          </div>
        </Group>

        <Group title="Size">
          {pg.enabled ? (
            <>
              <SliderRow label="Tile" value={pg.cell} min={16} max={160} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ cell: v })} />
              <SliderRow label="Pieces per tile" value={pg.divisions} min={1} max={8} step={1} onChange={(v) => setPixelGridConfig({ divisions: v })} />
              <SliderRow label="Gap" value={pg.gap} min={0} max={pitch - 1} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ gap: v })} />
              <SliderRow label="Corner radius" value={pg.radius} min={0} max={Math.floor(pitch / 2)} step={1} suffix="px" onChange={(v) => setPixelGridConfig({ radius: v })} />
              <p className={hint}>{pitch}px pieces. Every size is whole pixels, so tiles stay sharp.</p>
            </>
          ) : (
            <SliderRow label="Dot" value={c.size} min={1} max={12} step={1} suffix="px" onChange={(v) => setShaderConfig({ size: v })} />
          )}
          {a.tileDisplay === 'color' && (
            <SliderRow label="Pattern scale" value={c.scale} min={0.05} max={2} step={0.05} onChange={(v) => setShaderConfig({ scale: v })} />
          )}
        </Group>

        <Group
          title="Motion"
          action={
            <Toggle inline label="Play animation" on={a.playing} onChange={(on) => setAnimationConfig({ playing: on })}>
              {a.playing ? 'Playing' : 'Paused'}
            </Toggle>
          }
        >
          <SliderRow label="Speed" value={a.speed} min={0} max={3} step={0.1} suffix="×" onChange={(v) => setAnimationConfig({ speed: v })} />
        </Group>

        <Group title="Hover · warp">
          <SliderRow label="Radius" value={h.radius} min={40} max={400} step={10} suffix="px" onChange={(v) => setHoverConfig({ radius: v })} />
          {pg.enabled ? (
            <>
              <SliderRow label="Rotate" value={h.warpRotate} min={0} max={90} step={5} suffix="°" onChange={(v) => setHoverConfig({ warpRotate: v })} />
              <SliderRow label="Round" value={h.warpRound} min={0} max={1} step={0.05} onChange={(v) => setHoverConfig({ warpRound: v })} />
              <SliderRow label="Size spread" value={h.warpJitter} min={0} max={1.5} step={0.05} onChange={(v) => setHoverConfig({ warpJitter: v })} />
            </>
          ) : (
            <p className={hint}>Without tiles the warp reveals whole dots of the field itself.</p>
          )}
        </Group>

        <Group title="Text">
          <Segmented
            size="xs"
            stretch
            label="Copy"
            value={copyVariantIds.includes(state.copyVariant) ? state.copyVariant : null}
            onChange={setCopyVariant}
            options={copyVariantIds.map((id) => ({ value: id, label: copyVariants[id].label }))}
          />
          <Segmented
            size="xs"
            stretch
            label="Button shape"
            value={state.button.radius === 0 || state.button.radius === 12 || state.button.radius === 999 ? state.button.radius : null}
            onChange={(r) => setButtonConfig({ radius: r })}
            options={[
              { value: 0, label: 'Square' },
              { value: 12, label: 'Rounded' },
              { value: 999, label: 'Pill' },
            ]}
          />
          <Toggle label="Uppercase buttons" on={state.button.uppercase} onChange={(on) => setButtonConfig({ uppercase: on })} />
          <Toggle label="Layout guides" on={state.layout.showGuides} onChange={(on) => setLayoutConfig({ showGuides: on })} />
          <Toggle label="Baseline guides" on={state.layout.showBaselines} onChange={(on) => setLayoutConfig({ showBaselines: on })} />
        </Group>
      </div>
    </div>
  )
}
