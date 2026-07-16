/** Header brand + nav content, decoupled from the hero so the lab ships
 *  neutral. Swap the preset to reskin the chrome without touching a hero. */
export interface NavLink {
  label: string
  dropdown?: boolean
}

export interface ContentPreset {
  id: string
  name: string
  brand: string
  navLinks: NavLink[]
  signIn: string
  cta: string
}

export const contentPresets: Record<string, ContentPreset> = {
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    brand: 'ACME',
    navLinks: [
      { label: 'Platform', dropdown: true },
      { label: 'AI Workflows', dropdown: true },
      { label: 'DevTools', dropdown: true },
      { label: 'Docs' },
      { label: 'Changelog' },
      { label: 'Pricing' },
    ],
    signIn: 'Sign in',
    cta: 'Launch sandbox',
  },
}

export const DEFAULT_PRESET = 'neutral'

export function getContentPreset(id: string | null): ContentPreset {
  return contentPresets[id ?? DEFAULT_PRESET] ?? contentPresets[DEFAULT_PRESET]
}
