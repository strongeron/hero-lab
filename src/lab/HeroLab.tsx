import { useEffect, useRef, useState } from 'react'
import { TextInspectorProvider } from '../components/playground/TextInspectorContext'
import TextInspectorPanel from '../components/playground/TextInspectorPanel'
import { useTextSelection } from '../components/playground/useTextSelection'
import { useApplyOverrides } from '../components/playground/useApplyOverrides'
import { fontPairs } from '../themes/fonts'
import { useDitherStore, setEdgeConfig } from '../heroes/dither/ditherStore'
import { heroes, getHero } from './registry'
import { getContentPreset } from '../content/presets'

const params = new URLSearchParams(window.location.search)
const activeHero = getHero(params.get('hero'))
const preset = getContentPreset(params.get('preset'))

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

function LabHeader({ headerBg }: { headerBg: 'transparent' | 'solid' }) {
  const bgClass = headerBg === 'solid'
    ? 'bg-t-bg border-b border-white/10'
    : 'bg-transparent'

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${bgClass}`}>
      <div className="max-w-[1440px] mx-auto px-8 xl:px-16 py-4 flex items-center justify-between">
        <a href="#" className="flex items-center gap-3 shrink-0 no-underline text-t-headline">
          <span className="relative grid size-7 place-items-center rounded-lg border border-t-border-strong bg-t-bg-surface overflow-hidden">
            <span className="absolute inset-0 opacity-70" style={{
              background: 'radial-gradient(circle at 30% 20%, var(--color-t-cta-bg), transparent 55%)',
            }} />
            <span className="relative block size-2.5 rounded-sm bg-current rotate-45" />
          </span>
          <span className="text-[18px] font-semibold tracking-[-0.03em]">{preset.brand}</span>
        </a>

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
            className="text-base no-underline px-5 py-1.5 rounded-full transition-colors whitespace-nowrap text-t-cta2-text border border-t-border-strong bg-transparent hover:bg-t-bg-surface"
          >
            {preset.signIn}
          </a>
          <a
            href="#"
            className="text-base no-underline px-5 py-1.5 rounded-full border transition-colors whitespace-nowrap text-t-cta-text bg-t-cta-bg border-t-cta-bg hover:opacity-90"
          >
            {preset.cta}
          </a>
        </div>
      </div>
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

export default function HeroLab() {
  const fontPair = fontPairs['jakarta-dm']
  const heroState = useDitherStore()
  const [showInspector, setShowInspector] = useState(() => {
    try {
      const saved = localStorage.getItem('hero-lab-show-inspector')
      if (saved === '1') return true
      if (saved === '0') return false
    } catch { /* ignore */ }
    return false
  })
  const themedRef = useRef<HTMLDivElement>(null)
  const [themedNode, setThemedNode] = useState<HTMLDivElement | null>(null)

  useEffect(() => { setThemedNode(themedRef.current) }, [])
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
    try { localStorage.setItem('hero-lab-show-inspector', showInspector ? '1' : '0') } catch { /* ignore */ }
  }, [showInspector])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault()
        setShowInspector((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <TextInspectorProvider activeVariant={activeHero.id}>
      <div
        ref={themedRef}
        data-palette="glass"
        className="min-h-screen"
        style={{
          '--font-display': fontPair.headline,
          '--font-sans': fontPair.body,
          '--font-display-stretch': fontPair.headlineStretch ?? 'normal',
          '--font-display-hl-style': fontPair.highlightStyle,
          '--font-display-hl-weight': fontPair.highlightWeight,
          fontStretch: fontPair.headlineStretch ?? 'normal',
        } as React.CSSProperties}
      >
        <LabHeader headerBg={heroState.headerBg} />
        <ActiveHero />
      </div>

      {showInspector && <TextInspectorPanel themedRoot={themedNode} paletteName="glass" />}

      <HeroSwitcher />

      <button
        onClick={() => setShowInspector((v) => !v)}
        title="Toggle design controls (⌘/Ctrl + Shift + E)"
        className="fixed bottom-4 right-4 z-[1002] px-3 py-2 rounded-full border cursor-pointer transition-all backdrop-blur-xl bg-[rgba(20,21,35,0.92)] border-white/10 hover:border-white/25 hover:bg-[rgba(30,31,50,0.95)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-[12px] font-semibold text-white/70 hover:text-white/95 flex items-center gap-2"
      >
        <span aria-hidden style={{ opacity: showInspector ? 1 : 0.5 }}>
          {showInspector ? '◉' : '○'}
        </span>
        {showInspector ? 'Hide controls' : 'Design controls'}
      </button>
    </TextInspectorProvider>
  )
}
