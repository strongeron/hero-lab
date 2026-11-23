/** Hero Lab's mark: one shape that keeps morphing — circle, soft square,
 *  diamond, blob — the lab's "one scene, many formations" idea at 20px.
 *
 *  It was a 28px Dithering shader over a seeded dot grid. At that size the
 *  field read as a handful of noisy points rather than a mark, and it cost a
 *  WebGL context. One CSS-animated shape reads at a glance and costs nothing.
 *
 *  Hover speeds the same morph up (updatePlaybackRate keeps the current frame,
 *  so it never jumps). With `onClick` the mark is a button — the lab toolbars
 *  use it to go back to Templates. Reduced motion holds one shape.
 *
 *  This is Hero Lab's own mark, not the demo brand's: ACME keeps its fixed
 *  mark inside the artboards. */
import { useRef } from 'react'

const HOVER_RATE = 4

export default function BrandMark({
  size = 20,
  onClick,
  label,
}: {
  size?: number
  onClick?: () => void
  /** Accessible name when the mark is a button. */
  label?: string
}) {
  const shapeRef = useRef<HTMLSpanElement>(null)
  const setRate = (rate: number) => {
    for (const a of shapeRef.current?.getAnimations() ?? []) a.updatePlaybackRate(rate)
  }
  const hover = { onPointerEnter: () => setRate(HOVER_RATE), onPointerLeave: () => setRate(1) }

  const mark = (
    <span className="grid place-items-center" style={{ width: size, height: size }}>
      <span
        ref={shapeRef}
        className="brand-morph block"
        style={{
          width: size * 0.78,
          height: size * 0.78,
          background: 'linear-gradient(135deg, #2DD4A8, #1A8A70)',
        }}
      />
    </span>
  )

  if (!onClick) return <span className="block" {...hover}>{mark}</span>

  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={() => setRate(HOVER_RATE)}
      onBlur={() => setRate(1)}
      aria-label={label}
      title={label}
      className="block cursor-pointer rounded-md border-0 bg-transparent p-0 leading-none lab-focus"
      {...hover}
    >
      {mark}
    </button>
  )
}
