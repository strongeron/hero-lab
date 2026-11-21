import { useState, useEffect } from 'react'
import SectionLabel from '../../lab/ui/SectionLabel'

/** Semantic text color tokens — the ones you'd actually apply to text */
const TEXT_TOKENS = [
  { token: '--color-t-headline', label: 'headline' },
  { token: '--color-t-body', label: 'body' },
  { token: '--color-t-muted', label: 'muted' },
  { token: '--color-t-eyebrow', label: 'eyebrow' },
  { token: '--color-t-accent', label: 'accent' },
  { token: '--color-t-cta-bg', label: 'cta-bg' },
  { token: '--color-t-cta-text', label: 'cta-text' },
  { token: '--color-t-cta2-text', label: 'cta2-text' },
  { token: '--color-t-metric-value', label: 'metric' },
] as const

/** Background/surface tokens — less common for text but useful */
const BG_TOKENS = [
  { token: '--color-t-bg', label: 'bg' },
  { token: '--color-t-bg-surface', label: 'surface' },
] as const

function parseToRgb(input: string): [number, number, number] | null {
  // Try rgb/rgba format
  const rgbMatch = input.match(/rgba?\(\s*([\d.]+),?\s*([\d.]+),?\s*([\d.]+)/)
  if (rgbMatch) return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]

  // Try hex format (#rgb, #rrggbb, #rrggbbaa)
  const hex = input.trim().replace('#', '')
  if (/^[0-9a-fA-F]{3,8}$/.test(hex)) {
    const full = hex.length <= 4
      ? hex.split('').map(c => c + c).join('').slice(0, 6)
      : hex.slice(0, 6)
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ]
  }

  return null
}

function rgbToOklch(input: string): string {
  const parsed = parseToRgb(input)
  if (!parsed) return input

  const r = parsed[0] / 255
  const g = parsed[1] / 255
  const b = parsed[2] / 255

  // sRGB → linear
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)

  // Linear sRGB → OKLab
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l = Math.cbrt(l_)
  const m = Math.cbrt(m_)
  const s = Math.cbrt(s_)

  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const bk = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

  // OKLab → OKLCH
  const C = Math.sqrt(a * a + bk * bk)
  let H = (Math.atan2(bk, a) * 180) / Math.PI
  if (H < 0) H += 360

  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(0)})`
}

interface Props {
  value: string // current color (rgb from computed or hex from override)
  onChange: (color: string) => void
  themedRoot: HTMLElement | null
  paletteName?: string
}

interface ResolvedToken {
  token: string
  label: string
  color: string
  oklch: string
}

export default function PaletteColorPicker({ value, onChange, themedRoot, paletteName }: Props) {
  const [textTokens, setTextTokens] = useState<ResolvedToken[]>([])
  const [bgTokens, setBgTokens] = useState<ResolvedToken[]>([])
  const [hexInput, setHexInput] = useState('')
  const [showBg, setShowBg] = useState(false)

  // Resolve CSS token values from the themed root
  useEffect(() => {
    if (!themedRoot) return
    const computed = getComputedStyle(themedRoot)

    const resolve = (tokens: readonly { token: string; label: string }[]): ResolvedToken[] =>
      tokens
        .map(({ token, label }) => {
          const color = computed.getPropertyValue(token).trim()
          return { token, label, color, oklch: color ? rgbToOklch(color) : '' }
        })
        .filter((t) => t.color)

    setTextTokens(resolve(TEXT_TOKENS))
    setBgTokens(resolve(BG_TOKENS))
  }, [themedRoot, paletteName])

  function handleHexSubmit() {
    const hex = hexInput.trim()
    if (/^#?[0-9a-fA-F]{3,8}$/.test(hex)) {
      onChange(hex.startsWith('#') ? hex : `#${hex}`)
      setHexInput('')
    }
  }

  // Normalize for matching: strip spaces and lowercase
  const normalizedValue = value.replace(/\s/g, '').toLowerCase()
  function isMatch(color: string): boolean {
    return color.replace(/\s/g, '').toLowerCase() === normalizedValue
  }

  return (
    <div className="space-y-2.5 flex-1">
      {/* Current color preview */}
      <div className="flex items-center gap-2.5 bg-lab-fill rounded-lg px-2.5 py-2">
        <div
          className="w-8 h-8 rounded-lg border border-lab-border shrink-0 inset-shadow-xs"
          style={{ background: value || 'transparent' }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-lab-xs font-mono text-lab-fg-muted truncate">{value}</div>
          <div className="text-lab-xs font-mono text-lab-fg-subtle truncate">{rgbToOklch(value)}</div>
        </div>
      </div>

      {/* Semantic text tokens */}
      <div>
        <SectionLabel level={4} className="px-0.5 mb-1">
          Theme tokens
          {paletteName && <span className="ml-1 normal-case tracking-normal">({paletteName})</span>}
        </SectionLabel>
        <div className="space-y-px">
          {textTokens.map(({ token, label, color }) => (
            <button
              key={token}
              type="button"
              onClick={() => onChange(color)}
              aria-pressed={isMatch(color)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border-0 transition-colors text-left lab-focus ${
                isMatch(color)
                  ? 'bg-lab-fill-selected'
                  : 'bg-transparent hover:bg-lab-fill-hover'
              }`}
            >
              <div
                className={`w-4 h-4 rounded shrink-0 border ${
                  isMatch(color) ? 'border-lab-border-strong ring-1 ring-lab-accent/50' : 'border-lab-border'
                }`}
                style={{ background: color }}
              />
              <span className="text-lab-xs font-mono text-lab-fg-muted flex-1 truncate">{label}</span>
              {isMatch(color) && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className="text-lab-accent shrink-0">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Background tokens (collapsed) */}
      <div>
        <button
          type="button"
          onClick={() => setShowBg(!showBg)}
          aria-expanded={showBg}
          className="min-h-6 rounded text-lab-2xs font-semibold tracking-[0.1em] uppercase text-lab-fg-subtle hover:text-lab-fg-muted px-0.5 mb-1 flex items-center gap-1 bg-transparent border-0 cursor-pointer transition-colors lab-focus"
        >
          <svg
            aria-hidden="true"
            width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
            className={`transition-transform ${showBg ? 'rotate-90' : ''}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          Background tokens
        </button>
        {showBg && (
          <div className="space-y-px">
            {bgTokens.map(({ token, label, color }) => (
              <button
                key={token}
                type="button"
                onClick={() => onChange(color)}
                aria-pressed={isMatch(color)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border-0 transition-colors text-left lab-focus ${
                  isMatch(color) ? 'bg-lab-fill-selected' : 'bg-transparent hover:bg-lab-fill-hover'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded shrink-0 border ${
                    isMatch(color) ? 'border-lab-border-strong ring-1 ring-lab-accent/50' : 'border-lab-border'
                  }`}
                  style={{ background: color }}
                />
                <span className="text-lab-xs font-mono text-lab-fg-muted flex-1 truncate">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
          placeholder="Custom #hex"
          aria-label="Custom colour, hex"
          className="flex-1 bg-lab-fill border border-lab-border rounded-lg px-2.5 py-1.5 text-lab-xs text-lab-fg-muted font-mono placeholder:text-lab-fg-subtle focus:border-lab-border-strong transition-colors lab-focus"
        />
      </div>
    </div>
  )
}
