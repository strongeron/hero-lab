export interface TerminalTheme {
  id: string
  name: string
  tier: 's' | 'a' | 'b' | 'c'
  bg: string
  fg: string
  accent: string
  accent2: string
  surface: string
  comment: string
}

export const terminalThemes: TerminalTheme[] = [
  // ── S-TIER ──
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', tier: 's', bg: '#1E1E2E', fg: '#CDD6F4', accent: '#CBA6F7', accent2: '#F5C2E7', surface: '#181825', comment: '#585B70' },
  { id: 'dracula', name: 'Dracula', tier: 's', bg: '#282A36', fg: '#F8F8F2', accent: '#BD93F9', accent2: '#FF79C6', surface: '#44475A', comment: '#6272A4' },
  { id: 'solarized-dark', name: 'Solarized Dark', tier: 's', bg: '#002B36', fg: '#839496', accent: '#268BD2', accent2: '#2AA198', surface: '#073642', comment: '#586E75' },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', tier: 's', bg: '#282828', fg: '#EBDBB2', accent: '#FE8019', accent2: '#B8BB26', surface: '#3C3836', comment: '#928374' },
  { id: 'github-dark', name: 'GitHub Dark', tier: 's', bg: '#101216', fg: '#8B949E', accent: '#6CA4F8', accent2: '#56D364', surface: '#161B22', comment: '#484F58' },

  // ── A-TIER ──
  { id: 'one-dark', name: 'One Dark', tier: 'a', bg: '#282C34', fg: '#ABB2BF', accent: '#61AFEF', accent2: '#C678DD', surface: '#21252B', comment: '#5C6370' },
  { id: 'tokyo-night', name: 'Tokyo Night', tier: 'a', bg: '#1A1B26', fg: '#C0CAF5', accent: '#7AA2F7', accent2: '#BB9AF7', surface: '#24283B', comment: '#565F89' },
  { id: 'nord', name: 'Nord', tier: 'a', bg: '#2E3440', fg: '#D8DEE9', accent: '#88C0D0', accent2: '#81A1C1', surface: '#3B4252', comment: '#4C566A' },
  { id: 'material-palenight', name: 'Material Palenight', tier: 'a', bg: '#292D3E', fg: '#A6ACCD', accent: '#82AAFF', accent2: '#C792EA', surface: '#2B2F40', comment: '#676E95' },
  { id: 'monokai-pro', name: 'Monokai Pro', tier: 'a', bg: '#2D2A2E', fg: '#FCFCFA', accent: '#FF6188', accent2: '#AB9DF2', surface: '#403E41', comment: '#727072' },
  { id: 'night-owl', name: 'Night Owl', tier: 'a', bg: '#011627', fg: '#D6DEEB', accent: '#82AAFF', accent2: '#C792EA', surface: '#0B2942', comment: '#637777' },

  // ── B-TIER ──
  { id: 'kanagawa-wave', name: 'Kanagawa Wave', tier: 'b', bg: '#1F1F28', fg: '#DCD7BA', accent: '#7E9CD8', accent2: '#957FB8', surface: '#16161D', comment: '#727169' },
  { id: 'rose-pine', name: 'Rosé Pine', tier: 'b', bg: '#191724', fg: '#E0DEF4', accent: '#C4A7E7', accent2: '#EB6F92', surface: '#1F1D2E', comment: '#6E6A86' },
  { id: 'everforest-dark', name: 'Everforest Dark', tier: 'b', bg: '#2D353B', fg: '#D3C6AA', accent: '#A7C080', accent2: '#83C092', surface: '#232A2E', comment: '#7A8478' },
  { id: 'nightfox', name: 'Nightfox', tier: 'b', bg: '#192330', fg: '#CDCECF', accent: '#719CD6', accent2: '#9D79D6', surface: '#212E3F', comment: '#526176' },
  { id: 'ayu-dark', name: 'Ayu Dark', tier: 'b', bg: '#0A0E14', fg: '#B3B1AD', accent: '#39BAE6', accent2: '#D2A6FF', surface: '#0D1117', comment: '#475B6B' },

  // ── C-TIER ──
  { id: 'vesper', name: 'Vesper', tier: 'c', bg: '#101010', fg: '#FFFFFF', accent: '#99FFE4', accent2: '#FFC799', surface: '#1A1A1A', comment: '#7E7E7E' },
  { id: 'vitesse-dark', name: 'Vitesse Dark', tier: 'c', bg: '#121212', fg: '#DBD7CA', accent: '#4D9375', accent2: '#D9739F', surface: '#1A1A1A', comment: '#555555' },
  { id: 'flexoki-dark', name: 'Flexoki Dark', tier: 'c', bg: '#100F0F', fg: '#CECDC3', accent: '#4385BE', accent2: '#CE5D97', surface: '#1C1B1A', comment: '#575653' },
  { id: 'poimandres', name: 'Poimandres', tier: 'c', bg: '#1B1E28', fg: '#A6ACCD', accent: '#5DE4C7', accent2: '#FAE4FC', surface: '#1E2130', comment: '#506477' },
  { id: 'moonlight', name: 'Moonlight', tier: 'c', bg: '#222436', fg: '#C8D3F5', accent: '#82AAFF', accent2: '#C099FF', surface: '#2F334D', comment: '#636DA6' },
  { id: 'andromeda', name: 'Andromeda', tier: 'c', bg: '#23262E', fg: '#D5CED9', accent: '#00E8C6', accent2: '#C74DED', surface: '#2A2D36', comment: '#555555' },
  { id: 'synthwave-84', name: 'SynthWave 84', tier: 'c', bg: '#262335', fg: '#FFFFFF', accent: '#FF7EDB', accent2: '#36F9F6', surface: '#2A2139', comment: '#495495' },
  { id: 'cobalt2', name: 'Cobalt2', tier: 'c', bg: '#193549', fg: '#FFFFFF', accent: '#FFC600', accent2: '#0088FF', surface: '#15232D', comment: '#0D3A58' },
  { id: 'shades-of-purple', name: 'Shades of Purple', tier: 'c', bg: '#2D2B55', fg: '#A599E9', accent: '#FAD000', accent2: '#FF628C', surface: '#1E1E3F', comment: '#7E7EC0' },
  { id: 'bluloco-dark', name: 'Bluloco Dark', tier: 'c', bg: '#282C34', fg: '#ABB2BF', accent: '#3691FF', accent2: '#9F7EFE', surface: '#21252B', comment: '#636D83' },
  { id: 'gruvbox-material', name: 'Gruvbox Material', tier: 'c', bg: '#282828', fg: '#D4BE98', accent: '#E78A4E', accent2: '#D3869B', surface: '#32302F', comment: '#928374' },
]

/** Grouped by tier for rendering */
export const tierLabels: Record<string, string> = {
  s: 'S-Tier',
  a: 'A-Tier',
  b: 'B-Tier',
  c: 'C-Tier',
}

export const tiers = ['s', 'a', 'b', 'c'] as const

export function getThemeById(id: string): TerminalTheme | undefined {
  return terminalThemes.find((t) => t.id === id)
}
