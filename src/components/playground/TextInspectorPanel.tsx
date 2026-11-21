import { useEffect, useState, useRef } from 'react'
import { useTextInspector, type TypographyPreset } from './TextInspectorContext'
import PaletteColorPicker from './PaletteColorPicker'
import DitherPanel from '../../heroes/dither/DitherPanel'
import Segmented, { type SegmentedOption } from '../../lab/ui/Segmented'

const FONT_FAMILIES = [
  // Humanistic / Organic
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', 'DM Sans', sans-serif" },
  { label: 'Sora', value: "'Sora', sans-serif" },
  { label: 'General Sans', value: "'General Sans', sans-serif" },
  { label: 'Outfit', value: "'Outfit', sans-serif" },
  { label: 'Cabinet Grotesk', value: "'Cabinet Grotesk', sans-serif" },
  { label: 'Switzer', value: "'Switzer', sans-serif" },
  { label: 'DM Sans', value: "'DM Sans', system-ui, sans-serif" },
  { label: 'Source Sans 3', value: "'Source Sans 3', system-ui, sans-serif" },
  { label: 'Nunito Sans', value: "'Nunito Sans', system-ui, sans-serif" },
  // Statement / Wide
  { label: 'Anybody', value: "'Anybody', sans-serif" },
  { label: 'Georama', value: "'Georama', sans-serif" },
  { label: 'Science Gothic', value: "'Science Gothic', sans-serif" },
  { label: 'Special Gothic Expanded One', value: "'Special Gothic Expanded One', sans-serif" },
  // Warm Serifs
  { label: 'Literata', value: "'Literata', Georgia, serif" },
  { label: 'Lora', value: "'Lora', Georgia, serif" },
  { label: 'Fraunces', value: "'Fraunces', Georgia, serif" },
  { label: 'Instrument Serif', value: "'Instrument Serif', Georgia, serif" },
  // Original set
  { label: 'Satoshi', value: "'Satoshi', 'Inter', sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', 'Inter', sans-serif" },
  { label: 'Bodoni Moda', value: "'Bodoni Moda', 'Times New Roman', serif" },
  { label: 'Bricolage Grotesque', value: "'Bricolage Grotesque', 'Inter', sans-serif" },
  { label: 'Inter', value: "'Inter', system-ui, sans-serif" },
]

const TEXT_TRANSFORMS = ['none', 'uppercase', 'capitalize'] as const

interface ComputedStyles {
  fontFamily: string
  fontWeight: string
  fontSize: string
  lineHeight: string
  letterSpacing: string
  fontStyle: string
  textTransform: string
  color: string
}

function getComputedStyles(el: HTMLElement): ComputedStyles {
  const cs = getComputedStyle(el)
  return {
    fontFamily: cs.fontFamily,
    fontWeight: cs.fontWeight,
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    fontStyle: cs.fontStyle,
    textTransform: cs.textTransform,
    color: cs.color,
  }
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return rgb
  const [, r, g, b] = match
  return `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`
}

function truncateText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max) + '...' : clean
}

function parsePx(val: string): number {
  return parseFloat(val) || 0
}


function SlidersIcon({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </svg>
  )
}

interface Props {
  themedRoot: HTMLElement | null
  paletteName?: string
}

export default function TextInspectorPanel({ themedRoot, paletteName }: Props) {
  const { enabled, setEnabled, selectedElement, selectedPath, overrides, setOverride, clearOverride, clearAll, presets, savePreset, deletePreset, applyPreset, activeVariant } =
    useTextInspector()
  const [computed, setComputed] = useState<ComputedStyles | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Read computed styles when selection changes
  useEffect(() => {
    if (!selectedElement) {
      setComputed(null)
      return
    }
    setComputed(getComputedStyles(selectedElement))
  }, [selectedElement])

  // Re-read after overrides change
  useEffect(() => {
    if (!selectedElement || !selectedPath) return
    const id = requestAnimationFrame(() => {
      setComputed(getComputedStyles(selectedElement))
    })
    return () => cancelAnimationFrame(id)
  }, [selectedElement, selectedPath, overrides])

  // Closed: HeroLab unmounts the panel and the "Design" button in the bottom
  // view pill is the way back in, so there is nothing to render here.
  if (!enabled) return null

  const pathOverrides = selectedPath ? overrides[selectedPath] || {} : {}

  function getEffective(cssProp: string): string {
    if (selectedPath && pathOverrides[cssProp]) return pathOverrides[cssProp]
    if (!computed) return ''
    const map: Record<string, keyof ComputedStyles> = {
      'font-family': 'fontFamily',
      'font-weight': 'fontWeight',
      'font-size': 'fontSize',
      'line-height': 'lineHeight',
      'letter-spacing': 'letterSpacing',
      'font-style': 'fontStyle',
      'text-transform': 'textTransform',
      color: 'color',
    }
    return computed[map[cssProp]] || ''
  }

  function isOverridden(prop: string): boolean {
    return !!(selectedPath && pathOverrides[prop])
  }

  function handleReset(prop: string) {
    if (!selectedPath || !selectedElement) return
    clearOverride(selectedPath, prop)
    selectedElement.style.removeProperty(prop)
  }

  function handleSet(prop: string, value: string) {
    if (!selectedPath || !selectedElement) return
    setOverride(selectedPath, prop, value)
    selectedElement.style.setProperty(prop, value, 'important')
  }

  const overrideCount = selectedPath ? Object.keys(pathOverrides).length : 0
  const totalOverrides = Object.values(overrides).reduce((sum, p) => sum + Object.keys(p).length, 0)

  const currentColor = getEffective('color')
  const currentColorHex = rgbToHex(currentColor)
  const isDitherHero = activeVariant === 'dither'

  // Full width on phones: at a fixed 320 the panel covered nearly all of a
  // 390px viewport while the layout still shifted content sideways by the same
  // amount, so the thing being edited sat off-screen behind it. Below `sm` it
  // takes the screen and overlays; HeroLab drops `panelOffset` at that size.
  return (
    <div
      ref={panelRef}
      data-inspector-panel
      className="fixed top-0 right-0 bottom-0 z-[1000] w-full sm:w-80 border-l backdrop-blur-2xl bg-lab-panel border-lab-border flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lab-border shrink-0">
        <h2 className="m-0 text-lab-sm font-semibold text-lab-fg flex items-center gap-2">
          <SlidersIcon />
          Design Panel
        </h2>
        <div className="flex items-center gap-1.5">
          {/* Red on the reset controls is a scoped exception (DESIGN.md): no lab token marks a destructive reset. */}
          {totalOverrides > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="min-h-6 rounded-md text-lab-xs font-medium text-red-400 hover:text-red-300 cursor-pointer bg-transparent border-0 px-1.5 transition-colors lab-focus"
            >
              Reset all ({totalOverrides})
            </button>
          )}
          <button
            type="button"
            onClick={() => setEnabled(false)}
            aria-label="Close design panel"
            title="Close design panel (⌘/Ctrl + Shift + E)"
            className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer bg-transparent border-0 text-lab-fg-subtle hover:text-lab-fg hover:bg-lab-fill-hover transition-colors lab-focus"
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isDitherHero && <DitherPanel />}
        {!selectedElement ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lab-fill flex items-center justify-center">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-lab-fg-subtle">
                <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="text-lab-sm text-lab-fg-subtle leading-relaxed">
              Click any text element in the hero to inspect and override its typography.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Selected element preview */}
            <div className="bg-lab-fill rounded-xl px-3 py-2.5 border border-lab-border">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lab-xs font-mono text-lab-fg-subtle bg-lab-fill-hover px-1.5 py-0.5 rounded">
                    {selectedElement.tagName.toLowerCase()}
                  </span>
                  {/* Inline color preview */}
                  <div
                    className="w-3 h-3 rounded-sm border border-lab-border"
                    style={{ background: currentColor }}
                  />
                </div>
                {overrideCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPath) return
                      for (const prop of Object.keys(pathOverrides)) {
                        clearOverride(selectedPath, prop)
                        selectedElement.style.removeProperty(prop)
                      }
                    }}
                    className="min-h-6 rounded px-1 -mx-1 text-lab-xs font-medium text-red-400 hover:text-red-300 cursor-pointer bg-transparent border-0 transition-colors lab-focus"
                  >
                    Reset ({overrideCount})
                  </button>
                )}
              </div>
              <p className="text-lab-xs text-lab-fg-muted leading-snug">
                {truncateText(selectedElement.textContent || '', 80)}
              </p>
            </div>

            {/* Preset chips */}
            {presets.length > 0 && (
              <PresetChips presets={presets} onApply={applyPreset} onDelete={deletePreset} />
            )}

            {/* Font Family */}
            <PropertyRow label="Font" overridden={isOverridden('font-family')} onReset={() => handleReset('font-family')}>
              <select
                aria-label="Font family"
                value={getEffective('font-family')}
                onChange={(e) => handleSet('font-family', e.target.value)}
                className="w-full bg-lab-fill border border-lab-border rounded-lg px-2.5 py-2 text-lab-xs text-lab-fg focus:border-lab-border-strong cursor-pointer transition-colors lab-focus"
                style={{ WebkitAppearance: 'none' }}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </PropertyRow>

            {/* Font Weight */}
            <PropertyRow label="Weight" overridden={isOverridden('font-weight')} onReset={() => handleReset('font-weight')}>
              <PropertySlider
                label="Font weight"
                value={parseInt(getEffective('font-weight')) || 400}
                min={100} max={900} step={100}
                display={(v) => String(v)}
                onChange={(v) => handleSet('font-weight', String(v))}
              />
            </PropertyRow>

            {/* Font Size */}
            <PropertyRow label="Size" overridden={isOverridden('font-size')} onReset={() => handleReset('font-size')}>
              <PropertySlider
                label="Font size"
                value={parsePx(getEffective('font-size'))}
                min={10} max={120} step={1}
                display={(v) => `${v}px`}
                onChange={(v) => handleSet('font-size', `${v}px`)}
              />
            </PropertyRow>

            {/* Line Height */}
            <PropertyRow label="Leading" overridden={isOverridden('line-height')} onReset={() => handleReset('line-height')}>
              <PropertySlider
                label="Line height"
                value={(() => {
                  const lh = getEffective('line-height')
                  const fs = parsePx(getEffective('font-size'))
                  if (lh === 'normal') return 1.2
                  const lhPx = parsePx(lh)
                  return fs > 0 ? Math.round((lhPx / fs) * 100) / 100 : 1.2
                })()}
                min={0.8} max={2.0} step={0.05}
                display={(v) => v.toFixed(2)}
                onChange={(v) => handleSet('line-height', String(v))}
              />
            </PropertyRow>

            {/* Letter Spacing */}
            <PropertyRow label="Tracking" overridden={isOverridden('letter-spacing')} onReset={() => handleReset('letter-spacing')}>
              <PropertySlider
                label="Letter spacing"
                value={(() => {
                  const ls = getEffective('letter-spacing')
                  if (ls === 'normal' || ls === '0px') return 0
                  const fs = parsePx(getEffective('font-size'))
                  const lsPx = parsePx(ls)
                  return fs > 0 ? Math.round((lsPx / fs) * 1000) / 1000 : 0
                })()}
                min={-0.05} max={0.15} step={0.005}
                display={(v) => `${v.toFixed(3)}em`}
                onChange={(v) => handleSet('letter-spacing', `${v}em`)}
              />
            </PropertyRow>

            {/* Font Style */}
            <PropertyRow label="Style" overridden={isOverridden('font-style')} onReset={() => handleReset('font-style')}>
              <Segmented
                size="xs"
                stretch
                label="Font style"
                options={capitalised(['normal', 'italic'])}
                value={getEffective('font-style')}
                onChange={(v) => handleSet('font-style', v)}
              />
            </PropertyRow>

            {/* Text Transform */}
            <PropertyRow label="Case" overridden={isOverridden('text-transform')} onReset={() => handleReset('text-transform')}>
              <Segmented
                size="xs"
                stretch
                label="Text case"
                options={capitalised(TEXT_TRANSFORMS)}
                value={getEffective('text-transform')}
                onChange={(v) => handleSet('text-transform', v)}
              />
            </PropertyRow>

            {/* Divider */}
            <div className="border-t border-lab-border" />

            {/* Color */}
            <PropertyRow label="Color" overridden={isOverridden('color')} onReset={() => handleReset('color')}>
              <PaletteColorPicker
                value={currentColorHex}
                onChange={(color) => handleSet('color', color)}
                themedRoot={themedRoot}
                paletteName={paletteName}
              />
            </PropertyRow>

            {/* Save Preset */}
            {overrideCount > 0 && (
              <SavePresetButton
                autoName={generatePresetName(pathOverrides)}
                onSave={savePreset}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Preset helpers ---

function generatePresetName(props: Record<string, string>): string {
  const font = props['font-family']
  const weight = props['font-weight']
  let name = ''
  if (font) {
    // Extract first font name from the family string
    const match = font.match(/'([^']+)'/)
    name = match ? match[1] : font.split(',')[0].trim()
  }
  if (weight) name = name ? `${name} ${weight}` : weight
  return name || 'Custom'
}

function PresetChips({
  presets,
  onApply,
  onDelete,
}: {
  presets: TypographyPreset[]
  onApply: (p: TypographyPreset) => void
  onDelete: (id: string) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onApply(p)}
          onMouseEnter={() => setHoveredId(p.id)}
          onMouseLeave={() => setHoveredId(null)}
          type="button"
          className="relative flex items-center gap-1.5 min-h-6 pl-2 pr-2 py-1 rounded-lg border border-lab-border bg-lab-fill hover:bg-lab-fill-hover hover:border-lab-border-strong cursor-pointer transition-colors text-lab-xs text-lab-fg-muted hover:text-lab-fg lab-focus"
        >
          <span
            aria-hidden="true"
            className="text-lab-xs font-bold leading-none"
            style={{
              fontFamily: p.props['font-family'] || 'inherit',
              fontWeight: p.props['font-weight'] || 'inherit',
              fontStyle: p.props['font-style'] || 'normal',
            }}
          >
            Aa
          </span>
          <span className="truncate max-w-20">{p.name}</span>
          {hoveredId === p.id && (
            <span
              onClick={(e) => { e.stopPropagation(); onDelete(p.id) }}
              className="ml-0.5 w-3.5 h-3.5 rounded-full bg-lab-fill-selected hover:bg-red-500/30 flex items-center justify-center text-lab-fg-subtle hover:text-red-400 transition-colors"
            >
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function SavePresetButton({
  autoName,
  onSave,
}: {
  autoName: string
  onSave: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setName(autoName)
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [editing, autoName])

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full mt-1 py-2 rounded-lg border border-dashed border-lab-border hover:border-lab-border-strong bg-transparent hover:bg-lab-fill text-lab-xs font-medium text-lab-fg-subtle hover:text-lab-fg-muted cursor-pointer transition-colors flex items-center justify-center gap-1.5 lab-focus"
      >
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Save preset
      </button>
    )
  }

  return (
    <div className="flex gap-1.5 mt-1">
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        placeholder="Preset name..."
        aria-label="Preset name"
        className="flex-1 bg-lab-fill border border-lab-border focus:border-lab-border-strong rounded-lg px-2.5 py-1.5 text-lab-xs text-lab-fg placeholder:text-lab-fg-subtle transition-colors lab-focus"
      />
      <button
        type="button"
        onClick={() => { if (name.trim()) { onSave(name.trim()); setEditing(false) } }}
        className="min-h-6 px-2.5 py-1.5 rounded-lg bg-lab-fill-selected hover:bg-lab-fill-hover text-lab-xs font-semibold text-lab-fg cursor-pointer border-0 transition-colors lab-focus"
      >
        Save
      </button>
    </div>
  )
}

// --- Sub-components ---

function PropertyRow({
  label,
  overridden,
  onReset,
  children,
}: {
  label: string
  overridden: boolean
  onReset: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {overridden && <span className="w-1.5 h-1.5 rounded-full bg-lab-accent" aria-hidden="true" />}
          <span className={`text-lab-2xs font-semibold tracking-wide uppercase ${overridden ? 'text-lab-fg-muted' : 'text-lab-fg-subtle'}`}>
            {label}
            {overridden && <span className="sr-only"> (changed)</span>}
          </span>
        </div>
        {overridden && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset ${label}`}
            className="min-h-6 rounded px-1 -mx-1 text-lab-xs text-lab-fg-subtle hover:text-red-400 cursor-pointer bg-transparent border-0 transition-colors lab-focus"
          >
            reset
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

/** A labelled range with a formatted value. Kept local: the value needs a
 *  formatter (`0.020em`), and the PropertyRow above already shows the label. */
function PropertySlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="lab-range lab-focus flex-1 min-w-0"
      />
      <output className="text-lab-xs font-mono text-lab-fg-subtle w-14 text-right shrink-0 tabular-nums">
        {display(value)}
      </output>
    </div>
  )
}

function capitalised<T extends string>(values: readonly T[]): SegmentedOption<T>[] {
  return values.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))
}
