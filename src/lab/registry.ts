import type { ComponentType } from 'react'
import DitherHero from '../heroes/dither/DitherHero'
import { applyDitherUrlParams } from '../heroes/dither/urlParams'

/** One hero = one registry entry. Adding a background engine (shader / 3D /
 *  gradient) is a new entry here, not a new project. The lab shell reads this
 *  list to drive the hero switcher and `?hero=` routing. */
export interface HeroEntry {
  id: string
  name: string
  tagline: string
  engine: 'shader' | '3d' | 'gradient'
  component: ComponentType
  /** Mutate the hero's store from URL params BEFORE React mounts. */
  applyUrlParams?: (params: URLSearchParams) => void
}

export const heroes: HeroEntry[] = [
  {
    id: 'dither',
    name: 'Dither',
    tagline: 'Dot-field dithering shader · Problem ⇄ Fix reveal',
    engine: 'shader',
    component: DitherHero,
    applyUrlParams: applyDitherUrlParams,
  },
]

export const DEFAULT_HERO = 'dither'

export function getHero(id: string | null): HeroEntry {
  return heroes.find((h) => h.id === id) ?? heroes[0]
}
