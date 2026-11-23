import { useLayoutEffect, useMemo, useRef, useState , type ReactNode } from 'react'
import { getTabSourceId } from '../heroes/dither/ditherStore'
import LabToolbarTitle from './LabToolbarTitle'
import Segmented from './ui/Segmented'

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

/** `actions`: toolbar buttons from the lab shell (the Design toggle). */
export default function PreviewCanvas({ onHome, actions }: { onHome?: () => void; actions?: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availWidth, setAvailWidth] = useState(0)
  const [zoom, setZoom] = useState<ZoomMode>('fit')

  // Layout effect: measure before first paint, so frames do not jump from
  // the fallback scale (same fix as TemplateGallery).
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
    <div className="h-dvh flex flex-col bg-lab-canvas">
      {/* Pinned canvas toolbar */}
      <div className="shrink-0 z-10 h-lab-bar flex items-center justify-between px-6 border-b border-lab-border bg-lab-toolbar">
        <LabToolbarTitle
          onHome={onHome}
          view="Breakpoints"
        />
        <div className="flex items-center gap-2">
        <Segmented
          size="xs"
          label="Zoom"
          value={zoom}
          onChange={setZoom}
          options={[
            { value: 'fit', label: `Fit ${Math.round(fitScale * 100)}%` },
            { value: 0.5, label: '50%' },
            { value: 1, label: '100%' },
          ]}
        />
        {actions}
        </div>
      </div>

      {/* Scrollable / pannable canvas area */}
      <div ref={wrapRef} className="flex-1 overflow-auto">
      <div className="flex items-start" style={{ gap: GAP * scale, padding: PAD }}>
        {DEVICES.map((d) => (
          <div key={d.id} className="shrink-0">
            <div className="flex items-baseline gap-2" style={{ height: LABEL_H }}>
              <span className="text-lab-sm font-semibold text-lab-fg">{d.label}</span>
              <span className="text-lab-xs font-mono text-lab-fg-subtle">
                {d.width}×{d.height}
              </span>
            </div>
            <div
              className="rounded-xl border border-lab-border overflow-hidden bg-lab-artboard shadow-lab-raised"
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
