export type FontPairName =
  // ── Humanistic / Organic (metaball-friendly) ──
  | 'jakarta-dm'
  | 'sora-source'
  | 'general-nunito'
  | 'outfit-inter'
  | 'cabinet-source'
  | 'switzer-inter'
  // ── Monospace / Technical ──
  | 'jetbrains-inter'
  | 'space-mono-inter'
  | 'geist-mono-inter'
  // ── Statement / Wide ──
  | 'anybody-inter'
  | 'georama-inter'
  | 'science-gothic-inter'
  | 'special-gothic-inter'
  // ── Warm Serifs ──
  | 'literata-dm'
  | 'lora-source'
  | 'fraunces-inter'
  // ── Original set ──
  | 'instrument-inter'
  | 'satoshi-inter'
  | 'space-inter'
  | 'bodoni-inter'
  | 'bricolage-inter'

export interface FontPair {
  id: FontPairName
  label: string
  headline: string                        // CSS font-family for headlines
  body: string                            // CSS font-family for body
  highlightStyle: 'italic' | 'normal'     // accent text style
  highlightWeight: number | 'inherit'     // accent text weight ('inherit' = color only)
  headlineStretch?: string                // CSS font-stretch for variable width fonts (e.g. '150%')
}

export const fontPairs: Record<FontPairName, FontPair> = {
  // ── Humanistic / Organic (metaball-friendly) ──
  'jakarta-dm': {
    id: 'jakarta-dm',
    label: 'Soft',
    headline: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },
  'sora-source': {
    id: 'sora-source',
    label: 'Liquid',
    headline: "'Sora', sans-serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },
  'general-nunito': {
    id: 'general-nunito',
    label: 'Warm',
    headline: "'General Sans', sans-serif",
    body: "'Nunito Sans', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },
  'outfit-inter': {
    id: 'outfit-inter',
    label: 'Refined',
    headline: "'Outfit', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },
  'cabinet-source': {
    id: 'cabinet-source',
    label: 'Bold',
    headline: "'Cabinet Grotesk', sans-serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },
  'switzer-inter': {
    id: 'switzer-inter',
    label: 'Swiss',
    headline: "'Switzer', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },

  // ── Monospace / Technical ──
  'jetbrains-inter': {
    id: 'jetbrains-inter',
    label: 'Terminal',
    headline: "'JetBrains Mono', monospace",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 400,
  },
  'space-mono-inter': {
    id: 'space-mono-inter',
    label: 'Dev Talk',
    headline: "'Space Mono', monospace",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 400,
  },
  'geist-mono-inter': {
    id: 'geist-mono-inter',
    label: 'Geist Mono',
    headline: "'Geist Mono', monospace",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 400,
  },

  // ── Statement / Wide ──
  'anybody-inter': {
    id: 'anybody-inter',
    label: 'Anybody',
    headline: "'Anybody', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 400,
    headlineStretch: '150%',         // wdth 150 — ultra-expanded
  },
  'georama-inter': {
    id: 'georama-inter',
    label: 'Georama',
    headline: "'Georama', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 400,
    headlineStretch: '150%',         // wdth 150 — extra-expanded
  },
  'science-gothic-inter': {
    id: 'science-gothic-inter',
    label: 'Science',
    headline: "'Science Gothic', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'normal',        // slant axis only, not true italic
    highlightWeight: 'inherit',
    headlineStretch: '200%',         // wdth 200 — maximum expansion
  },
  'special-gothic-inter': {
    id: 'special-gothic-inter',
    label: 'Special',
    headline: "'Special Gothic Expanded One', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'normal',        // no italic available
    highlightWeight: 'inherit',      // single weight (400) — color-only highlights
  },

  // ── Warm Serifs ──
  'literata-dm': {
    id: 'literata-dm',
    label: 'Human',
    headline: "'Literata', Georgia, serif",
    body: "'DM Sans', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 400,
  },
  'lora-source': {
    id: 'lora-source',
    label: 'Script',
    headline: "'Lora', Georgia, serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 400,
  },
  'fraunces-inter': {
    id: 'fraunces-inter',
    label: 'Literary',
    headline: "'Fraunces', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 300,
  },

  // ── Original set ──
  'instrument-inter': {
    id: 'instrument-inter',
    label: 'Elegant',
    headline: "'Instrument Serif', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 400,
  },
  'satoshi-inter': {
    id: 'satoshi-inter',
    label: 'Clean',
    headline: "'Satoshi', 'Inter', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },
  'space-inter': {
    id: 'space-inter',
    label: 'Geometric',
    headline: "'Space Grotesk', 'Inter', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },
  'bodoni-inter': {
    id: 'bodoni-inter',
    label: 'Editorial',
    headline: "'Bodoni Moda', 'Times New Roman', serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'italic',
    highlightWeight: 400,
  },
  'bricolage-inter': {
    id: 'bricolage-inter',
    label: 'Expressive',
    headline: "'Bricolage Grotesque', 'Inter', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    highlightStyle: 'normal',
    highlightWeight: 'inherit',
  },
}

export const fontPairNames: FontPairName[] = [
  // Humanistic / Organic — try these first with metaballs
  'jakarta-dm',
  'sora-source',
  'general-nunito',
  'outfit-inter',
  'cabinet-source',
  'switzer-inter',
  // Monospace / Technical
  'jetbrains-inter',
  'space-mono-inter',
  'geist-mono-inter',
  // Statement / Wide
  'anybody-inter',
  'georama-inter',
  'science-gothic-inter',
  'special-gothic-inter',
  // Warm Serifs
  'literata-dm',
  'lora-source',
  'fraunces-inter',
  // Original set
  'instrument-inter',
  'satoshi-inter',
  'space-inter',
  'bodoni-inter',
  'bricolage-inter',
]
