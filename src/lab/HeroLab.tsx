import { useEffect, useRef, useState } from 'react'
import { TextInspectorProvider, useTextInspector } from '../components/playground/TextInspectorContext'
import TextInspectorPanel, { PANEL_WIDTH } from '../components/playground/TextInspectorPanel'
import { useTextSelection } from '../components/playground/useTextSelection'
import { useApplyOverrides } from '../components/playground/useApplyOverrides'
import { fontPairs } from '../themes/fonts'
import { useDitherStore, setEdgeConfig, initDitherSync, applySceneTemplate, setPixelGridConfig, setAnimationConfig, setInitialState, applyHeroTemplate, heroTemplates } from '../heroes/dither/ditherStore'
import { heroes, getHero } from './registry'
import { getContentPreset } from '../content/presets'
import BrandMark from '../components/BrandMark'
import SiteFooter from '../components/SiteFooter'
import PreviewCanvas from './PreviewCanvas'
import TemplateGallery from './TemplateGallery'
import LayerExplorer from './LayerExplorer'

const params = new URLSearchParams(window.location.search)
const activeHero = getHero(params.get('hero'))
const preset = getContentPreset(params.get('preset'))
/** True when this window is a breakpoint-preview iframe: bare hero, no lab
 *  chrome, store mirrored from the main window. */
const isPreviewFrame = params.get('preview') === '1'
/** Template a preview frame is pinned to (Templates gallery artboards). */
const previewTemplate = params.get('template')
/** Independent config pins for a preview frame (docs real-preview gallery):
 *  ?preview=1&scene=<id>&grid=0|1&tile=color|size|points&state=problem|fix.
 *  When any is present the frame applies them locally and does NOT sync. */
const pinScene = params.get('scene')
const pinGrid = params.get('grid')
const pinTile = params.get('tile') as 'color' | 'size' | 'points' | null
const pinState = params.get('state') as 'problem' | 'fix' | null
const isPinnedPreview = isPreviewFrame && !!(pinScene || pinGrid || pinTile || pinState)
/** Source tab this preview binds to. Set by same-tab previews (Layers) so the
 *  frame ignores other Hero Lab tabs broadcasting on the shared channel. */
const previewSourceId = params.get('sid')

// Mutate the active hero's store from the URL before React mounts.
activeHero.applyUrlParams?.(params)

function ActiveHero() {
  const heroRef = useRef<HTMLDivElement>(null)
  useTextSelection(heroRef)
  useApplyOverrides(heroRef)
  const Hero = activeHero.component

  return (
    <div ref={heroRef} className="min-h-screen">
      <Hero />
    </div>
  )
}

function LabHeader({ headerBg, rightOffset, button }: { headerBg: 'transparent' | 'solid'; rightOffset: number; button: { radius: number; uppercase: boolean } }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const bgClass = headerBg === 'solid'
    ? 'bg-t-bg border-b border-white/10'
    : 'bg-transparent'
  // Header buttons follow the shared CTA styling (corner radius + caps) and
  // carry the active template's display face — brand and action surfaces should
  // share the hero's character instead of sitting in neutral UI type. Nav links
  // below deliberately stay on the body sans: at 14px a display face (a hairline
  // serif especially) loses legibility and stops scanning as navigation.
  const brandFont = 'var(--font-hero-display, inherit)'
  // CTAs read from their own var so a template whose display face goes weak at
  // button size can opt them out while the wordmark keeps the character.
  const btnStyle: React.CSSProperties = { borderRadius: button.radius, textTransform: button.uppercase ? 'uppercase' : undefined, fontFamily: 'var(--font-hero-cta, inherit)' }

  return (
    <header
      className={`fixed top-0 left-0 z-40 transition-colors duration-300 ${bgClass}`}
      style={{ right: rightOffset }}
    >
      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 xl:px-16 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 shrink-0 text-t-headline">
          {/* Static here, in every context. This is the demo brand's mark inside
              a hero that is itself a moving shader — a second animation at 28px
              competes with the thing the page exists to show. It stays
              generative (a new formation each visit, click to reroll); it just
              doesn't move. The animated version lives on the Templates toolbar,
              where it marks the project rather than the demo. */}
          <BrandMark size={28} static interactive={!isPreviewFrame} />
          <a href="#" className="no-underline text-t-headline text-[18px] font-semibold tracking-[-0.03em]" style={{ fontFamily: brandFont }}>
            {preset.brand}
          </a>
        </div>

        <nav className="hidden xl:flex items-center">
          {preset.navLinks.map((link) => (
            <a
              key={link.label}
              href="#"
              className="text-base no-underline py-2 px-2 xl:px-3 transition-colors whitespace-nowrap select-none cursor-pointer text-t-body hover:text-t-headline"
            >
              {link.label}
              {link.dropdown && (
                <svg
                  aria-hidden="true"
                  className="inline-block pb-0.5 ml-2 w-auto h-[0.625rem] text-t-muted"
                  viewBox="0 0 448 512"
                  fill="currentColor"
                >
                  <path d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
                </svg>
              )}
            </a>
          ))}
        </nav>

        <div className="hidden xl:flex items-center gap-4 shrink-0">
          <a
            href="#"
            style={btnStyle}
            className="text-base no-underline px-5 py-1.5 transition-colors whitespace-nowrap text-t-cta2-text border border-t-border-strong bg-transparent hover:bg-t-bg-surface"
          >
            {preset.signIn}
          </a>
          <a
            href="#"
            style={btnStyle}
            className="text-base no-underline px-5 py-1.5 border transition-colors whitespace-nowrap text-t-cta-text bg-t-cta-bg border-t-cta-bg hover:opacity-90"
          >
            {preset.cta}
          </a>
        </div>

        {/* Mobile / tablet (< xl): compact CTAs + hamburger. Sign in fits from
            md up; on phones it lives in the menu instead. */}
        <div className="flex xl:hidden items-center gap-2.5">
          <a
            href="#"
            style={btnStyle}
            className="hidden md:block text-[14px] no-underline px-4 py-1.5 border transition-colors whitespace-nowrap text-t-cta2-text border-t-border-strong bg-transparent hover:bg-t-bg-surface"
          >
            {preset.signIn}
          </a>
          <a
            href="#"
            style={btnStyle}
            className="text-[14px] no-underline px-4 py-1.5 border transition-colors whitespace-nowrap text-t-cta-text bg-t-cta-bg border-t-cta-bg hover:opacity-90"
          >
            {preset.cta}
          </a>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="grid size-9 place-items-center rounded-lg border border-t-border-strong bg-transparent text-t-headline cursor-pointer transition-colors hover:bg-t-bg-surface"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen
                ? <path d="M18 6L6 18M6 6l12 12" />
                : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown menu — absolutely positioned below the bar so the header's
          measured height (which drives the dot field's Top start) never moves. */}
      {menuOpen && (
        <div className="xl:hidden absolute top-full left-0 right-0 bg-t-bg border-b border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          <nav className="max-w-[1440px] mx-auto px-5 sm:px-8 py-2 flex flex-col">
            {preset.navLinks.map((link) => (
              <a
                key={link.label}
                href="#"
                className="text-base no-underline py-3 text-t-body hover:text-t-headline border-b border-white/5 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a href="#" className="md:hidden text-base no-underline py-3 text-t-cta2-text hover:text-t-headline transition-colors">
              {preset.signIn}
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}

/** Switch heroes by navigating to `?hero=<id>`. Renders only when there is more
 *  than one hero — a one-item switcher is noise. Adding a second registry entry
 *  lights this up automatically. */
function HeroSwitcher() {
  if (heroes.length < 2) return null
  return (
    <div className="fixed bottom-4 left-4 z-[1002] flex items-center gap-1 p-1 rounded-full border backdrop-blur-xl bg-[rgba(20,21,35,0.92)] border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {heroes.map((h) => {
        const active = h.id === activeHero.id
        const url = new URL(window.location.href)
        url.searchParams.set('hero', h.id)
        return (
          <a
            key={h.id}
            href={url.pathname + url.search}
            title={h.tagline}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-full no-underline transition-all ${
              active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white/90 hover:bg-white/5'
            }`}
          >
            {h.name}
          </a>
        )
      })}
    </div>
  )
}

type ViewMode = 'live' | 'breakpoints' | 'templates' | 'layers'

function LabLayout() {
  const fontPair = fontPairs['jakarta-dm']
  const heroState = useDitherStore()
  const { enabled: panelOpen, setEnabled } = useTextInspector()
  const themedRef = useRef<HTMLDivElement>(null)
  const [themedNode, setThemedNode] = useState<HTMLDivElement | null>(null)
  // Read on first render, not in the effect: initialising to false gives a
  // phone one frame with the 320px desktop offset applied.
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 639px)').matches)
  // Templates is the starter page: a first-time visitor lands on the gallery of
  // artboards, which shows what the lab is (many looks, three breakpoints each)
  // rather than dropping them into one hero with no context for it. A returning
  // visitor keeps whatever view they last used.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('hero-lab-view-mode')
      return saved === 'breakpoints' || saved === 'templates' || saved === 'layers' || saved === 'live'
        ? saved
        : 'templates'
    } catch {
      return 'templates'
    }
  })
  // The Layers tab is a single stack-only surface: the progressive stack IS the
  // interface there, so the Design Panel would be a redundant second control
  // surface writing the same store. Hide it (and drop its layout offset) while
  // in Layers; panelOpen is preserved so the panel returns on other views.
  const showPanel = panelOpen && viewMode !== 'layers'
  // Below `sm` the panel goes full-width and overlays instead of sitting beside
  // the content, so no offset — shifting the canvas by 320px there would push
  // the thing being edited off-screen behind the panel.
  const panelOffset = showPanel && !isNarrow ? PANEL_WIDTH : 0

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  useEffect(() => { setThemedNode(themedRef.current) }, [])
  useEffect(() => {
    if (isPinnedPreview) {
      // Independent real preview — apply pinned config, no cross-window sync.
      if (pinState) setInitialState(pinState)
      if (pinScene) applySceneTemplate(pinScene as Parameters<typeof applySceneTemplate>[0])
      if (pinTile) setAnimationConfig({ tileDisplay: pinTile, playing: true })
      if (pinGrid != null) setPixelGridConfig({ enabled: pinGrid === '1' })
      return
    }
    initDitherSync(isPreviewFrame ? 'preview' : 'source', isPreviewFrame ? previewTemplate : null, isPreviewFrame ? previewSourceId : null)
    // On a fresh load the main window has no active template, so nothing plays
    // and the gallery shows every artboard static. Select + animate the FIRST
    // template so the initial hero is a real, playing template; the gallery then
    // animates only it and keeps the rest paused (one live WebGL context, not N).
    // Skipped on HMR because the persisted store already has an active template.
    if (!isPreviewFrame && !heroState.activeTemplate && heroTemplates.length > 0) {
      applyHeroTemplate(heroTemplates[0].id)
    }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('hero-lab-view-mode', viewMode) } catch { /* ignore */ }
  }, [viewMode])
  useEffect(() => {
    document.title = `Hero Lab — ${activeHero.name}`
  }, [])
  // Default Top start to the measured header height so the first row of shapes
  // begins whole below the filled nav — the panel slider can still override it.
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const apply = () => {
      const h = Math.round(header.getBoundingClientRect().height)
      if (h > 0) setEdgeConfig({ topInset: h + 4 })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault()
        setEnabled(!panelOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, setEnabled])

  const themedVars = {
    '--font-display': fontPair.headline,
    '--font-sans': fontPair.body,
    '--font-display-stretch': fontPair.headlineStretch ?? 'normal',
    '--font-display-hl-style': fontPair.highlightStyle,
    '--font-display-hl-weight': fontPair.highlightWeight,
    fontStretch: fontPair.headlineStretch ?? 'normal',
  } as React.CSSProperties

  // Breakpoint-preview iframe: bare hero only — no panel, no switcher, no
  // toggles. The store mirrors the main window via initDitherSync above.
  if (isPreviewFrame) {
    return (
      <div ref={themedRef} data-palette="glass" className="min-h-screen" style={themedVars}>
        <LabHeader headerBg={heroState.headerBg} rightOffset={0} button={heroState.button} />
        <ActiveHero />
      </div>
    )
  }

  return (
    <>
      {viewMode === 'templates' ? (
        <div style={{ marginRight: panelOffset }}>
          <TemplateGallery />
        </div>
      ) : viewMode === 'layers' ? (
        <div style={{ marginRight: panelOffset }}>
          <LayerExplorer />
        </div>
      ) : viewMode === 'breakpoints' ? (
        <div style={{ marginRight: panelOffset }}>
          <PreviewCanvas />
        </div>
      ) : (
        <div
          ref={themedRef}
          data-palette="glass"
          className="min-h-screen"
          style={{ ...themedVars, marginRight: panelOffset }}
        >
          <LabHeader headerBg={heroState.headerBg} rightOffset={panelOffset} button={heroState.button} />
          <ActiveHero />
          {/* Live view only — the artboard/breakpoint views are about the hero
              in isolation, and preview iframes render the bare hero. */}
          <SiteFooter />
        </div>
      )}

      {showPanel && <TextInspectorPanel themedRoot={themedNode} paletteName="glass" />}

      <HeroSwitcher />

      {/* View toggle — anchored to the VIEWPORT centre, not the content area.
          It used to sit inside the panel-narrowed column (`right: panelOffset`),
          which meant it jumped sideways whenever the panel opened or closed —
          most visibly on Layers, where the panel is hidden entirely, so the one
          control that is present on every view was the one that moved between
          them. It is global chrome; it should be in the same place everywhere.
          At 1440 the pill spans roughly 505–935px and the panel starts at
          1040px, so viewport-centring does not put it under the panel. */}
      <div className="fixed bottom-4 left-0 right-0 z-[1002] flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-full border backdrop-blur-xl bg-[rgba(20,21,35,0.92)] border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {([['live', 'Live'], ['breakpoints', 'Breakpoints'], ['templates', 'Templates'], ['layers', 'Layers']] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer border-0 transition-all ${
                viewMode === mode
                  ? 'bg-white/15 text-white'
                  : 'bg-transparent text-white/60 hover:text-white/90 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default function HeroLab() {
  return (
    <TextInspectorProvider activeVariant={activeHero.id}>
      <LabLayout />
    </TextInspectorProvider>
  )
}
