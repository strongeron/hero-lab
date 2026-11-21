import { Profiler, useRef, useState, type CSSProperties } from 'react'
import { DitherBackground, ditherScenes, type DitherSceneId } from '../components/DitherBackground/DitherBackground'

/** One hero built on <DitherBackground>, plus the four switches that change
 *  it. The Profiler counts page commits and writes the count straight to the
 *  DOM, so the readout itself never causes a render: it should only move when
 *  you press a switch, never from the animation. */
// ?grid=0 and ?renderer=points pick the starting state (used by the perf runs).
const params = new URLSearchParams(window.location.search)

export default function DitherBackgroundDemo() {
  const [scene, setScene] = useState<DitherSceneId>('gentle-drift')
  const [grid, setGrid] = useState(params.get('grid') !== '0')
  const [renderer, setRenderer] = useState<'color' | 'points'>(params.get('renderer') === 'points' ? 'points' : 'color')
  const [reveal, setReveal] = useState(true)
  const commits = useRef(0)
  const readout = useRef<HTMLSpanElement>(null)

  return (
    <Profiler
      id="page"
      onRender={() => {
        commits.current += 1
        if (readout.current) readout.current.textContent = String(commits.current)
      }}
    >
      <section style={{ position: 'relative', minHeight: '100svh', display: 'grid', alignItems: 'end', isolation: 'isolate' }}>
        <DitherBackground scene={scene} grid={grid} renderer={renderer} reveal={reveal} style={{ zIndex: -1 }} />
        <div style={{ padding: 'clamp(24px, 6vw, 80px)', maxWidth: 760 }}>
          <h1 style={{ fontSize: 'clamp(40px, 7vw, 88px)', lineHeight: 1, margin: 0, letterSpacing: '-0.02em' }}>
            Your font, our dots.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.5, color: 'rgb(255 255 255 / 0.7)', maxWidth: 520 }}>
            This page loads no web fonts and no lab CSS. The background fills its
            parent; this text is a sibling and keeps the page's own font.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            <select value={scene} onChange={(e) => setScene(e.target.value as DitherSceneId)} style={control} aria-label="Scene">
              {Object.keys(ditherScenes).map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
            <button type="button" style={control} aria-pressed={grid} onClick={() => setGrid(!grid)}>Grid {grid ? 'on' : 'off'}</button>
            <button type="button" style={control} disabled={!grid} onClick={() => setRenderer(renderer === 'color' ? 'points' : 'color')}>
              Renderer: {renderer}
            </button>
            <button type="button" style={control} aria-pressed={reveal} onClick={() => setReveal(!reveal)}>Reveal {reveal ? 'on' : 'off'}</button>
          </div>
          <p style={{ fontSize: 13, color: 'rgb(255 255 255 / 0.5)', fontVariantNumeric: 'tabular-nums' }}>
            Page renders (dev only): <span ref={readout}>0</span>
          </p>
        </div>
      </section>
      <section style={{ minHeight: '100svh', padding: 'clamp(24px, 6vw, 80px)' }}>
        <p style={{ maxWidth: 520, lineHeight: 1.5 }}>Scroll here and the background above stops animating until it is back on screen.</p>
      </section>
    </Profiler>
  )
}

const control: CSSProperties = {
  font: 'inherit', fontSize: 14, color: '#fff', background: 'rgb(255 255 255 / 0.08)',
  border: '1px solid rgb(255 255 255 / 0.2)', borderRadius: 999, padding: '8px 14px', cursor: 'pointer',
}
