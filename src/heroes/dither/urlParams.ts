import {
  applyHeroTemplate,
  applySceneTemplate,
  copyVariantIds,
  heroTemplates,
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

const PREVIEW_SCENE: SceneTemplateId = 'radar-scan'

/* ── URL-param driven state injection ──
   /?hero=dither&state=<problem|fix>&copy=<id>&scene=<id>&theme=<id>&guides=1&baselines=1
   Mutates the Dither store BEFORE React mounts, so the first render reads it.

   The main window starts on the first hero template and lays the params on
   top. (Before, the params were applied first and the template then
   overwrote them, so ?copy, ?state, ?scene and ?theme did nothing there.)
   A preview frame keeps its pinned baseline: the radar scene, the 96px point
   grid and the fix state, unless a param says otherwise. */
export function applyDitherUrlParams(params: URLSearchParams): void {
  const preview = params.get('preview') === '1'
  const scene = params.get('scene')
  const validScene = scene && Object.prototype.hasOwnProperty.call(sceneTemplates, scene)
    ? (scene as SceneTemplateId)
    : null
  if (preview) {
    applySceneTemplate(validScene ?? PREVIEW_SCENE)
    setPixelGridConfig({ enabled: true, cell: 96, divisions: 4, gap: 6, radius: 40, snap: true })
    setAnimationConfig({ tileDisplay: 'points', tileSizeSpread: 0.55, tileSizeSpeed: 0.06, tileSizeNoise: 1.2 })
  } else {
    applyHeroTemplate(heroTemplates[0].id)
    if (validScene) applySceneTemplate(validScene)
  }
  const copy = params.get('copy')
  if (copy && (copyVariantIds as readonly string[]).includes(copy)) setCopyVariant(copy as CopyVariantId)
  // ?guides=1 / ?baselines=1 / ?boxes=1 turn on the alignment overlays (handy for
  // headless screenshots of a pinned preview frame).
  if (params.get('guides') === '1') setLayoutConfig({ showGuides: true })
  if (params.get('baselines') === '1') setLayoutConfig({ showBaselines: true })
  if (params.get('boxes') === '1') setLayoutConfig({ showBoxes: true })
  const theme = params.get('theme')
  if (theme) setTerminalTheme(theme)
  // State last, so a scene switch cannot clobber the layer swap.
  const state = params.get('state') ?? (preview ? 'fix' : null)
  if (state === 'problem' || state === 'fix') setInitialState(state)
}
