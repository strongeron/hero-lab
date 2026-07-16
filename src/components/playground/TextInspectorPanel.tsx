import { useEffect, useState, useRef } from 'react'
import { useTextInspector, type TypographyPreset } from './TextInspectorContext'
import PaletteColorPicker from './PaletteColorPicker'
import DitherPanel from '../../heroes/dither/DitherPanel'

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

  if (!enabled) {
    return (
      <button
        onClick={() => setEnabled(true)}
        className="fixed top-20 right-6 z-[1001] px-3 py-2 rounded-xl border cursor-pointer transition-all backdrop-blur-xl bg-[rgba(20,21,35,0.92)] border-white/10 hover:border-white/20 hover:bg-[rgba(30,31,50,0.95)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-[12px] font-semibold text-white/70 hover:text-white/90 flex items-center gap-2"
        title="Open Control Panel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
        Inspector
      </button>
    )
  }

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

  return (
    <div
      ref={panelRef}
      data-inspector-panel
      className="fixed top-16 right-4 bottom-4 z-[1000] w-[300px] rounded-2xl border shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl bg-[rgba(20,21,35,0.95)] border-white/8 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 shrink-0">
        <span className="text-[12px] font-semibold text-white/90 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
          </svg>
          Control Panel
        </span>
        <div className="flex items-center gap-1.5">
          {totalOverrides > 0 && (
            <button
              onClick={clearAll}
              className="text-[10px] font-medium text-red-400/70 hover:text-red-400 cursor-pointer bg-transparent border-0 px-1.5 py-0.5 transition-colors"
            >
              Reset all ({totalOverrides})
            </button>
          )}
          <button
            onClick={() => setEnabled(false)}
            className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer bg-transparent border-0 text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/20">
                <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="text-[12px] text-white/25 leading-relaxed">
              Click any text element in the hero to inspect and override its typography.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Selected element preview */}
            <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.04]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded">
                    {selectedElement.tagName.toLowerCase()}
                  </span>
                  {/* Inline color preview */}
                  <div
                    className="w-3 h-3 rounded-sm border border-white/10"
                    style={{ background: currentColor }}
                  />
                </div>
                {overrideCount > 0 && (
                  <button
                    onClick={() => {
                      if (!selectedPath) return
                      for (const prop of Object.keys(pathOverrides)) {
                        clearOverride(selectedPath, prop)
                        selectedElement.style.removeProperty(prop)
                      }
                    }}
                    className="text-[9px] font-medium text-red-400/50 hover:text-red-400 cursor-pointer bg-transparent border-0 transition-colors"
                  >
                    Reset ({overrideCount})
                  </button>
                )}
              </div>
              <p className="text-[11px] text-white/50 leading-snug">
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
                value={getEffective('font-family')}
                onChange={(e) => handleSet('font-family', e.target.value)}
                className="w-full bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-2 text-[11px] text-white/80 outline-none focus:border-white/15 cursor-pointer transition-colors"
                style={{ WebkitAppearance: 'none' }}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </PropertyRow>

            {/* Font Weight */}
            <PropertyRow label="Weight" overridden={isOverridden('font-weight')} onReset={() => handleReset('font-weight')}>
              <SliderRow
                value={parseInt(getEffective('font-weight')) || 400}
                min={100} max={900} step={100}
                display={(v) => String(v)}
                onChange={(v) => handleSet('font-weight', String(v))}
              />
            </PropertyRow>

            {/* Font Size */}
            <PropertyRow label="Size" overridden={isOverridden('font-size')} onReset={() => handleReset('font-size')}>
              <SliderRow
                value={parsePx(getEffective('font-size'))}
                min={10} max={120} step={1}
                display={(v) => `${v}px`}
                onChange={(v) => handleSet('font-size', `${v}px`)}
              />
            </PropertyRow>

            {/* Line Height */}
            <PropertyRow label="Leading" overridden={isOverridden('line-height')} onReset={() => handleReset('line-height')}>
              <SliderRow
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
              <SliderRow
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
              <SegmentedControl
                options={['normal', 'italic']}
                value={getEffective('font-style')}
                onChange={(v) => handleSet('font-style', v)}
              />
            </PropertyRow>

            {/* Text Transform */}
            <PropertyRow label="Case" overridden={isOverridden('text-transform')} onReset={() => handleReset('text-transform')}>
              <SegmentedControl
                options={[...TEXT_TRANSFORMS]}
                value={getEffective('text-transform')}
                onChange={(v) => handleSet('text-transform', v)}
              />
            </PropertyRow>

            {/* Divider */}
            <div className="border-t border-white/[0.04]" />

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
          className="relative flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-lg border border-white/8 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/15 cursor-pointer transition-all text-[10px] text-white/60 hover:text-white/80"
        >
          <span
            className="text-[11px] font-bold leading-none"
            style={{
              fontFamily: p.props['font-family'] || 'inherit',
              fontWeight: p.props['font-weight'] || 'inherit',
              fontStyle: p.props['font-style'] || 'normal',
            }}
          >
            Aa
          </span>
          <span className="truncate max-w-[80px]">{p.name}</span>
          {hoveredId === p.id && (
            <span
              onClick={(e) => { e.stopPropagation(); onDelete(p.id) }}
              className="ml-0.5 w-3.5 h-3.5 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors"
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
        onClick={() => setEditing(true)}
        className="w-full mt-1 py-2 rounded-lg border border-dashed border-white/10 hover:border-white/20 bg-transparent hover:bg-white/[0.03] text-[10px] font-medium text-white/30 hover:text-white/50 cursor-pointer transition-all flex items-center justify-center gap-1.5"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
        className="flex-1 bg-white/[0.04] border border-white/10 focus:border-white/20 rounded-lg px-2.5 py-1.5 text-[11px] text-white/80 outline-none transition-colors"
      />
      <button
        onClick={() => { if (name.trim()) { onSave(name.trim()); setEditing(false) } }}
        className="px-2.5 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-[10px] font-semibold text-primary-soft cursor-pointer border-0 transition-colors"
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
          {overridden && <span className="w-1.5 h-1.5 rounded-full bg-primary-soft" />}
          <span className={`text-[10px] font-medium tracking-wide uppercase ${overridden ? 'text-white/60' : 'text-white/30'}`}>
            {label}
          </span>
        </div>
        {overridden && (
          <button
            onClick={onReset}
            className="text-[9px] text-white/20 hover:text-red-400/60 cursor-pointer bg-transparent border-0 transition-colors"
          >
            reset
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function SliderRow({
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
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
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 cursor-pointer"
      />
      <span className="text-[11px] font-mono text-white/45 w-[56px] text-right shrink-0 tabular-nums">
        {display(value)}
      </span>
    </div>
  )
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.05] flex-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 text-[10px] font-medium py-1.5 cursor-pointer border-0 transition-all capitalize ${
            value === opt
              ? 'bg-white/10 text-white/80'
              : 'bg-transparent text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
