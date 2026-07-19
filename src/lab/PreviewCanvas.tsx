import { useEffect, useMemo, useRef, useState } from 'react'
import { getTabSourceId } from '../heroes/dither/ditherStore'
import LabToolbarTitle from './LabToolbarTitle'

/** The three breakpoints shown side by side, at true relative scale. Each is a
 *  real same-origin iframe at native device width, so viewport media queries
 *  and the WebGL shader behave exactly as they would on that device. */
export const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
  { id: 'tablet', label: 'Tablet', width: 834, height: 1112 },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
] as const

const GAP = 40
const PAD = 40
/** Extra headroom for the label row above each frame */
const LABEL_H = 28

type ZoomMode = 'fit' | 0.5 | 1

export default function PreviewCanvas() {
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

  // Same app, same hero/preset params — preview=1 strips the lab chrome and
  // switches the store into mirror mode. Bind to THIS tab's source (&sid) so the
  // frames mirror only this tab's live hero, never another Hero Lab tab on the
  // shared channel (which otherwise makes the frames flip chaotically).
  const frameSrc = useMemo(() => {
    const p = new URLSearchParams(window.location.search)
    p.set('preview', '1')
    p.set('sid', getTabSourceId())
    return `${window.location.pathname}?${p.toString()}`
  }, [])

  return (
    // Column layout: the toolbar lives OUTSIDE the scroll container so it stays
    // pinned no matter how far the canvas is panned or zoomed.
    <div className="h-screen flex flex-col bg-[#0b0c14]">
      {/* Pinned canvas toolbar */}
      <div className="shrink-0 z-10 flex items-center justify-between px-6 py-3 border-b border-white/6 bg-[rgba(11,12,20,0.9)] backdrop-blur-xl">
        <LabToolbarTitle
          view="Breakpoints"
          strap="the current hero across devices — reflects Live & the selected template"
        />
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/8">
          {([['fit', `Fit ${Math.round(fitScale * 100)}%`], [0.5, '50%'], [1, '100%']] as const).map(
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

      {/* Scrollable / pannable canvas area */}
      <div ref={wrapRef} className="flex-1 overflow-auto">
      <div className="flex items-start" style={{ gap: GAP * scale, padding: PAD }}>
        {DEVICES.map((d) => (
          <div key={d.id} className="shrink-0">
            <div className="flex items-baseline gap-2" style={{ height: LABEL_H }}>
              <span className="text-[12px] font-semibold text-white/80">{d.label}</span>
              <span className="text-[11px] font-mono text-white/35">
                {d.width}×{d.height}
              </span>
            </div>
            <div
              className="rounded-xl border border-white/10 overflow-hidden bg-black shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
              style={{ width: d.width * scale, height: d.height * scale }}
            >
              <iframe
                src={frameSrc}
                title={`${d.label} preview`}
                style={{
                  width: d.width,
                  height: d.height,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  border: 0,
                  display: 'block',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}
