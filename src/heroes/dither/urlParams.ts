import {
  applySceneTemplate,
  copyVariantIds,
  sceneTemplates,
  setAnimationConfig,
  setCopyVariant,
  setInitialState,
  setLayoutConfig,
  setPixelGridConfig,
  setTerminalTheme,
  type CopyVariantId,
  type SceneTemplateId,
} from './ditherStore'

const DEFAULT_SCENE: SceneTemplateId = 'radar-scan'
const DEFAULT_STATE = 'fix' // green "fix" at rest; ?state=problem flips to pink errors

/* ── URL-param driven state injection ──
   /?hero=dither&state=<problem|fix>&copy=<id>&scene=<id>&theme=<id>&guides=1&baselines=1
   Mutate the Dither store BEFORE React mounts so the hero's initial
   useSyncExternalStore read picks up the right values. */
export function applyDitherUrlParams(params: URLSearchParams): void {
  try {
    const copy = params.get('copy')
    if (copy && (copyVariantIds as readonly string[]).includes(copy)) {
      setCopyVariant(copy as CopyVariantId)
    }
    const scene = params.get('scene')
    applySceneTemplate(
      scene && Object.prototype.hasOwnProperty.call(sceneTemplates, scene)
        ? (scene as SceneTemplateId)
        : DEFAULT_SCENE,
    )
    setPixelGridConfig({
      enabled: true,
      cell: 96,
      divisions: 4,
      gap: 6,
      radius: 40,
      snap: true,
      alignX: 0,
      alignY: 0,
    })
    setAnimationConfig({
      tileDisplay: 'points',
      tileSizeSpread: 0.55,
      tileSizeSpeed: 0.06,
      tileSizeNoise: 1.2,
    })
    // ?guides=1 / ?baselines=1 turn on the alignment overlays (handy for
    // headless screenshots of a pinned preview frame).
    if (params.get('guides') === '1') setLayoutConfig({ showGuides: true })
    if (params.get('baselines') === '1') setLayoutConfig({ showBaselines: true })
    const theme = params.get('theme')
    if (theme) setTerminalTheme(theme)
    // Apply state last so a scene switch can't clobber the layer swap.
    const state = params.get('state') ?? DEFAULT_STATE
    if (state === 'problem') setInitialState('problem')
    else setInitialState('fix')
  } catch {
    /* URLSearchParams / store access can't really fail; ignore defensively */
  }
}
