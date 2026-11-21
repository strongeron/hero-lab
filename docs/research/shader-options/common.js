// Shared scene config + HUD for the shader-option demos. Throwaway research
// code — not imported by the app. Serve this folder over HTTP (ES modules do
// not load from file://):  python3 -m http.server 8090
//
// Scene values mirror the lab's defaults: src/heroes/dither/ditherStore.ts
// (problemLayers, fixLayers, defaultShaderConfig) and the URL-param pixel grid
// in src/heroes/dither/urlParams.ts (cell 96 / divisions 4 / gap 6 / radius 40).

export const params = new URLSearchParams(location.search)

export const SCENE = {
  colorBack: '#0A1714',
  problem: [
    { color: '#E6307A', opacity: 0.9, shape: 1 }, // simplex
    { color: '#FF6B2B', opacity: 0.7, shape: 2 }, // warp
    { color: '#FF3366', opacity: 0.55, shape: 3 }, // dots
  ],
  fix: [
    { color: '#2DD4A8', opacity: 0.9, shape: 6 }, // swirl
    { color: '#3ECF8E', opacity: 0.7, shape: 4 }, // wave
    { color: '#1A8A70', opacity: 0.55, shape: 3 }, // dots
  ],
  type: 4, // 8x8 Bayer
  pxSize: 16, // defaultShaderConfig.size
  speed: 0.12,
  scale: 0.81, // 'Problem' hero template (ditherStore heroTemplates)
  rotation: 8,
  alphaSpread: 0.04,
  fit: 2, // cover
  // Color/alpha uses the 'Problem' template grid (cell 96 / 3 → 32, gap 13, square);
  // Point sizes uses the URL-param grid (96 / 4 → 24, gap 6, radius 40 → clamps to 9).
  grid: { pitch: 32, gap: 13, radius: 0 },
  gridPoints: { pitch: 24, gap: 6, radius: 9 },
  hoverRadius: 170,
  maxPixelCount: 500_000, // the lab's desktop cap (DitherHero shaderMaxPixelCount)
}

// ?t=<seconds> freezes time (for screenshot diffs); ?mx=&my= fakes a cursor.
export const frozenT = params.has('t') ? parseFloat(params.get('t')) : null
export const fakeMouse = params.has('mx') ? { x: +params.get('mx'), y: +params.get('my') } : null

export function hexToVec(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Same backing-store sizing as Paper's ShaderMount.handleResize (devicePixelContentBox path). */
export function backingSize(cssW, cssH, maxPixelCount = SCENE.maxPixelCount, minPixelRatio = 1) {
  const dpr = Math.max(1, devicePixelRatio)
  const s = Math.max(1, minPixelRatio / dpr)
  const tw = Math.round(cssW * dpr) * s
  const th = Math.round(cssH * dpr) * s
  const k = Math.min(1, Math.sqrt(maxPixelCount) / Math.sqrt(tw * th))
  const w = Math.round(tw * k)
  const h = Math.round(th * k)
  return { w, h, renderScale: w / Math.round(cssW) }
}

/** Line boxes of the hero copy, in CSS px relative to `root` (the lab's 'lines' text-rect mode). */
export function textLineRects(root) {
  const base = root.getBoundingClientRect()
  const out = []
  for (const el of root.querySelectorAll('[data-text]')) {
    const range = document.createRange()
    range.selectNodeContents(el)
    for (const r of range.getClientRects()) {
      if (r.width < 4) continue
      out.push({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height })
    }
  }
  return out
}

export const COPY_HTML = `
  <div class="copy">
    <h1 data-text>Your AI built the app.<br>Who's watching it run?</h1>
    <p data-text>Hover the field: the problem state flips to the fix under the cursor.</p>
  </div>`

export const BASE_CSS = `
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; background: #0A1714; color: #e8f2ee; font: 15px/1.45 ui-sans-serif, system-ui, sans-serif; overflow: hidden; }
  .hero { position: fixed; inset: 0; }
  .copy { position: absolute; left: 8vw; top: 34vh; max-width: 720px; pointer-events: none; z-index: 5; }
  .copy h1 { font-size: clamp(32px, 5vw, 64px); line-height: 1.05; margin: 0 0 18px; font-weight: 700; letter-spacing: -0.02em; }
  .copy p { margin: 0; max-width: 46ch; color: #b9cdc6; }
  .hud { position: fixed; right: 10px; top: 10px; z-index: 10; font: 12px/1.5 ui-monospace, monospace; background: rgb(0 0 0 / .72); color: #d8efe6; padding: 8px 10px; border-radius: 6px; white-space: pre; pointer-events: none; }
  .hud b { color: #fff; }
  @media (max-width: 600px) { .copy { left: 16px; right: 16px; top: 28vh; } }
`

/** On-screen HUD + window.__stats for the measurement script. */
export function makeHud(label, getCounts) {
  const el = document.createElement('div')
  el.className = 'hud'
  document.body.append(el)
  const stats = (window.__stats = { label, frames: 0, jsMs: 0 })
  let last = performance.now(), f0 = 0, js0 = 0, c0 = getCounts()
  setInterval(() => {
    const now = performance.now(), dt = (now - last) / 1000, c = getCounts()
    const fps = (stats.frames - f0) / dt
    const jsPerFrame = (stats.jsMs - js0) / Math.max(1, stats.frames - f0)
    el.innerHTML = `<b>${label}</b>\ncontexts  ${c.contexts}\ndraws/s   ${((c.draws - c0.draws) / dt).toFixed(0)}\nfps       ${fps.toFixed(0)}\nJS/frame  ${jsPerFrame.toFixed(2)} ms` + (c.extra ? `\n${c.extra}` : '')
    last = now; f0 = stats.frames; js0 = stats.jsMs; c0 = c
  }, 1000)
  return stats
}
