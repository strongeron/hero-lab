import { useLayoutEffect, useMemo, useRef, useState , type ReactNode } from 'react'
import { useDitherStore, applyHeroTemplate, heroTemplates, getTabSourceId } from '../heroes/dither/ditherStore'
import LabToolbarTitle from './LabToolbarTitle'
import { DEVICES } from './PreviewCanvas'
import Segmented from './ui/Segmented'

const GAP = 32
const PAD = 40
const BOARD_GAP = 56

/** Canvas view — one artboard (3 breakpoint frames) per template, all
 *  visible at once. Frames are pinned to their template via ?template=<id>:
 *  they render the canonical look until their artboard is clicked, which loads
 *  the template into the Design Panel and switches just that artboard to live
 *  sync. Other artboards snap back to canonical. */
type ZoomMode = 'fit' | 0.75 | 1

/** `actions`: toolbar buttons from the lab shell (the Design toggle). */
export default function TemplateGallery({ actions }: { actions?: ReactNode }) {
  const state = useDitherStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availWidth, setAvailWidth] = useState(0)
  const [zoom, setZoom] = useState<ZoomMode>('fit')

  // Layout effect: measure before the first paint, so the artboards do not
  // paint at the 0.3 fallback scale and then jump (CLS 0.078 on Slow 4G).
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => setAvailWidth(el.clientWidth)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const totalNativeWidth =
    DEVICES.reduce((sum, d) => sum + d.width, 0) + GAP * (DEVICES.length - 1)
  const fitScale =
    availWidth > 0 ? Math.min(1, (availWidth - PAD * 2) / totalNativeWidth) : 0.3
  const scale = zoom === 'fit' ? fitScale : zoom

  const frameSrc = useMemo(() => {
    return (templateId: string) => {
      const p = new URLSearchParams(window.location.search)
      p.set('preview', '1')
      p.set('template', templateId)
      // Bind to THIS tab's source so other Hero Lab tabs on the shared channel
      // can't force a template mismatch → the preview would snap back to its
      // paused canonical frame every heartbeat (the ~1.5s stutter on select).
      p.set('sid', getTabSourceId())
      return `${window.location.pathname}?${p.toString()}`
    }
  }, [])

  // Baked static snapshot for a non-active artboard — a real frame of the hero
  // captured to an image. Non-active templates render these (zero WebGL); the
  // live shader mounts only for the selected template. Keeps the gallery at one
  // artboard's worth of GPU contexts instead of one per template.
  // Bump when posters are re-baked. Without this the browser keeps serving the
  // cached image and the gallery silently shows the previous bake — the artboard
  // looks stale (old fonts, old state) while the file on disk is already right.
  // WebP at full bake size plus a half-size copy (slow-connection audit, fix 4):
  // the artboards render at well under bake size, so the browser picks the
  // half copy at Fit zoom and the full one at 100% / on 2x screens.
  const POSTER_VERSION = 4
  const posterSrc = (templateId: string, deviceId: string, half = false) =>
    `${import.meta.env.BASE_URL}posters/${templateId}-${deviceId}${half ? '-half' : ''}.webp?v=${POSTER_VERSION}`
  /** Bake width per device: desktop is baked at 1x, tablet and mobile at 2x. */
  const bakeWidth = (d: (typeof DEVICES)[number]) => (d.id === 'desktop' ? d.width : d.width * 2)

  const rowHeight = Math.max(...DEVICES.map((d) => d.height)) * scale

  return (
    <div className="h-dvh flex flex-col bg-lab-canvas">
      {/* Pinned toolbar */}
      <div className="shrink-0 z-10 flex items-center justify-between px-6 py-3 border-b border-lab-border bg-lab-toolbar backdrop-blur-xl">
        <LabToolbarTitle
          view="Canvas"
          strap="baked snapshots — select an artboard to load the live animation & edit in the Design Panel"
        />
        <div className="flex items-center gap-2">
        <Segmented
          size="xs"
          label="Zoom"
          value={zoom}
          onChange={setZoom}
          options={[
            { value: 'fit', label: `Fit ${Math.round(fitScale * 100)}%` },
            { value: 0.75, label: '75%' },
            { value: 1, label: '100%' },
          ]}
        />
        {actions}
        </div>
      </div>

      {/* Scrollable artboard stack */}
      <div ref={wrapRef} className="flex-1 overflow-auto">
        <div className="flex flex-col w-max min-w-full" style={{ padding: PAD, gap: BOARD_GAP }}>
          {heroTemplates.map((t) => {
            const active = state.activeTemplate === t.id
            return (
              <div key={t.id}>
                <div className="flex items-baseline gap-3 mb-2.5">
                  <span className={`text-lab-md font-semibold ${active ? 'text-lab-accent' : 'text-lab-fg'}`}>
                    {t.name}
                  </span>
                  {active && (
                    <span className="text-lab-2xs font-semibold px-2 py-0.5 rounded-full bg-lab-accent/15 text-lab-accent border border-lab-accent/25">
                      Editing
                    </span>
                  )}
                  <span className="text-lab-xs text-lab-fg-subtle">{t.desc}</span>
                </div>

                <div
                  className={`relative rounded-2xl transition-opacity ${
                    active ? '' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ minHeight: rowHeight }}
                >
                  <div className="flex items-start" style={{ gap: GAP * scale }}>
                    {DEVICES.map((d) => (
                      <div key={d.id} className="shrink-0">
                        <div
                          className="rounded-xl border border-lab-border overflow-hidden bg-lab-artboard shadow-lab-raised"
                          style={{ width: d.width * scale, height: d.height * scale }}
                        >
                          {active ? (
                            // Selected artboard: the real animating hero (WebGL).
                            // Only ONE template is ever live, so the gallery holds
                            // one artboard's worth of GPU contexts, not N.
                            <iframe
                              src={frameSrc(t.id)}
                              title={`${t.name} — ${d.label} preview`}
                              style={{
                                width: d.width,
                                height: d.height,
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left',
                                border: 0,
                                display: 'block',
                              }}
                            />
                          ) : (
                            // Non-selected: baked static snapshot for this exact
                            // breakpoint — no iframe, no shader, no WebGL context.
                            // Clicking (overlay below) mounts the live hero.
                            <img
                              src={posterSrc(t.id, d.id)}
                              srcSet={`${posterSrc(t.id, d.id, true)} ${bakeWidth(d) / 2}w, ${posterSrc(t.id, d.id)} ${bakeWidth(d)}w`}
                              sizes={`${Math.ceil(d.width * scale)}px`}
                              width={bakeWidth(d)}
                              height={Math.round((bakeWidth(d) * d.height) / d.width)}
                              alt={`${t.name} — ${d.label} preview`}
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                              style={{ width: d.width * scale, height: d.height * scale, objectFit: 'cover', objectPosition: 'top', display: 'block' }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Click-to-edit overlay — removed on the active artboard so
                      its frames stay fully interactive (hover reveal etc.) */}
                  {!active && (
                    <button
                      onClick={() => applyHeroTemplate(t.id)}
                      aria-label={`Edit ${t.name} in the Design Panel`}
                      className="absolute inset-0 z-10 rounded-2xl cursor-pointer bg-transparent border-0 group lab-focus"
                    >
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity text-lab-xs font-semibold px-3 py-1.5 rounded-full bg-lab-toolbar border border-lab-border-strong text-lab-fg shadow-lab-float whitespace-nowrap">
                        Edit in Design Panel
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
