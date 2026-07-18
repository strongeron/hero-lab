import { useEffect, useMemo, useRef, useState } from 'react'
import { useDitherStore, applyHeroTemplate, heroTemplates, getTabSourceId } from '../heroes/dither/ditherStore'
import { DEVICES } from './PreviewCanvas'

const GAP = 32
const PAD = 40
const BOARD_GAP = 56

/** Templates canvas — one artboard (3 breakpoint frames) per template, all
 *  visible at once. Frames are pinned to their template via ?template=<id>:
 *  they render the canonical look until their artboard is clicked, which loads
 *  the template into the Design Panel and switches just that artboard to live
 *  sync. Other artboards snap back to canonical. */
type ZoomMode = 'fit' | 0.75 | 1

export default function TemplateGallery() {
  const state = useDitherStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availWidth, setAvailWidth] = useState(0)
  const [zoom, setZoom] = useState<ZoomMode>('fit')

  useEffect(() => {
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
  const POSTER_VERSION = 3
  const posterSrc = (templateId: string, deviceId: string) =>
    `${import.meta.env.BASE_URL}posters/${templateId}-${deviceId}.jpeg?v=${POSTER_VERSION}`

  const rowHeight = Math.max(...DEVICES.map((d) => d.height)) * scale

  return (
    <div className="h-screen flex flex-col bg-[#0b0c14]">
      {/* Pinned toolbar */}
      <div className="shrink-0 z-10 flex items-center justify-between px-6 py-3 border-b border-white/6 bg-[rgba(11,12,20,0.9)] backdrop-blur-xl">
        <span className="text-[12px] font-semibold text-white/90 flex items-baseline gap-2">
          Hero Lab
          <span className="font-normal text-white/45">Templates</span>
          <span className="font-normal text-white/25">
            baked snapshots — select an artboard to load the live animation &amp; edit in the Design Panel
          </span>
        </span>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/8">
          {([['fit', `Fit ${Math.round(fitScale * 100)}%`], [0.75, '75%'], [1, '100%']] as const).map(
            ([mode, label]) => (
              <button
                key={String(mode)}
                onClick={() => setZoom(mode)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-md cursor-pointer border-0 transition-colors ${
                  zoom === mode
                    ? 'bg-white/12 text-white/90'
                    : 'bg-transparent text-white/40 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ),
          )}
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
                  <span className={`text-[13px] font-semibold ${active ? 'text-emerald-300/90' : 'text-white/80'}`}>
                    {t.name}
                  </span>
                  {active && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300/80 border border-emerald-400/25">
                      Editing
                    </span>
                  )}
                  <span className="text-[11px] text-white/30">{t.desc}</span>
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
                          className="rounded-xl border border-white/10 overflow-hidden bg-black shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
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
                              alt={`${t.name} — ${d.label} preview`}
                              loading="lazy"
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
                      className="absolute inset-0 z-10 rounded-2xl cursor-pointer bg-transparent border-0 group"
                    >
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[rgba(11,12,20,0.9)] border border-white/15 text-white/85 shadow-[0_8px_24px_rgba(0,0,0,0.5)] whitespace-nowrap">
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
