# Slow-connection audit: Hero Lab Live view

**Date:** 2026-11-21
**Branch / rev:** `perf/single-pass-shader` at `faad982` (production build, `base=/hero-lab/`)
**Scope:** what a visitor sees and waits for on Slow 4G and 3G. No `src/` changes were made.

## Answer first

On 3G the Live view shows a blank navy screen for 5.0 s. Nothing paints until the single 121 KB (gzip) JS bundle arrives and React renders. Fonts arrive 3.2 s after that. The hero itself is cheap: the default template (Full Bleed, `tileDisplay: "points"`) paints its dot field on a **2D canvas** about 20 ms after first paint. Paper's WebGL `Dithering` does not run at all on first load of the Live view.

The biggest win is a static HTML/CSS shell in `index.html` plus a trimmed font request. A hand-patched copy of `dist/` measured:

| Profile (CPU 4x) | FCP now | FCP with shell + trimmed fonts | Fonts ready now → fixed | CLS now → fixed |
|---|---|---|---|---|
| Slow 4G desktop | 1524 ms | **660 ms** | 2388 → 1226 ms | 0.019 → 0.002 |
| 3G desktop | 4956 ms | **1328 ms** | 8171 → 4305 ms | 0.019 → 0.002 |
| Slow 4G mobile 390 px | 1552 ms | **460 ms** | 2488 → 1231 ms | 0.025 → 0.034 |

LCP does not improve much (3G: 4956 → 4580 ms). React replaces the shell `<h1>` with a larger `<h1>`, and the browser counts the new element as the LCP. Code-splitting is the lever for LCP (fix 3).

The default first visit is not the Live view. A first-time visitor lands on **Templates** (`HeroLab.tsx`, `viewMode` defaults to `'templates'`). That view is 3.7x heavier: 1161 KB, 61 requests, LCP 5.8 s on Slow 4G (a poster JPEG).

## Method

1. Build: `npx vite build --sourcemap --outDir <scratch>/dist` (same config as `npm run build`, base `/hero-lab/`). The build went to the scratchpad so the repo `dist/` stays untouched.
2. Serve: `npx vite preview --outDir <scratch>/dist --port 5181`. Port 5180 was already taken by another session's **dev** server, so the first measurement round hit unbundled dev modules (3.5 MB, FCP 18 s on Slow 4G). Those numbers were discarded.
3. Measure: puppeteer-core with the same Chrome launch flags as `bench/measure.mjs`. One fresh incognito context per run, cache disabled, `Emulation.setCPUThrottlingRate 4`, and `Network.emulateNetworkConditions`:
   - Slow 4G: 1.6 Mbps down, 750 kbps up, 150 ms RTT.
   - 3G: 400 kbps down, 400 kbps up, 400 ms RTT.
   - Viewport 1440x900 DPR 1. Mobile: 390x844 DPR 2, touch.
4. Instrumentation (injected with `evaluateOnNewDocument`): `PerformanceObserver` for `paint`, `largest-contentful-paint`, `layout-shift`; hooks on WebGL `drawArrays/drawElements` and on 2D `fill/fillRect/drawImage/putImageData/arc` (first canvas paint); `document.fonts.ready`; CDP Network events for the waterfall.
5. Live view forced with `localStorage['hero-lab-view-mode']='live'`. The Design Panel is open by default (`text-inspector:enabled` is not `'0'`), so the default runs include the panel.
6. Screenshots at 0.5, 1, 2, 4, 8 s and "done": `docs/research/shader-options/bench/slow-net/<run>-<ms>.jpg` (resized to 960 px wide).

The measurement script stays in the session scratchpad (not committed). Third-party font hosts were reached over the real internet under emulation, so font timings carry some jitter.

## Bundle

Single JS chunk, single CSS chunk. No dynamic `import()` or `React.lazy` anywhere in `src/` (`grep -rnE "lazy\(|import\(" src` returned nothing).

| File | Raw | gzip -9 | brotli |
|---|---|---|---|
| `assets/index-*.js` | 430.4 KB | 122.6 KB | 104.7 KB |
| `assets/index-*.css` | 58.1 KB | 10.6 KB | 8.9 KB |
| `index.html` | 2.2 KB | 1.0 KB | 0.7 KB |

What is in the JS chunk (source-map attribution, raw minified bytes):

| Module | KB | % | Needed for Live first paint? |
|---|---|---|---|
| react-dom | 176.6 | 42.2 | yes |
| `DitherPanel.tsx` | 68.2 | 16.3 | no (panel UI) |
| `DitherHero.tsx` | 50.4 | 12.0 | yes |
| `@paper-design/shaders` + `-react` | 27.6 | 6.6 | **no** for the default template (2D points path) |
| `ditherStore.ts` | 19.7 | 4.7 | yes |
| `TextInspectorPanel.tsx` | 12.9 | 3.1 | no (panel UI) |
| `LayerExplorer.tsx` | 10.1 | 2.4 | no (other view) |
| react + scheduler | 11.7 | 2.8 | yes |
| `HeroLab.tsx` | 7.9 | 1.9 | yes |
| `web-haptics` | 6.6 | 1.6 | no (only on interaction) |
| `PaletteColorPicker.tsx` | 5.0 | 1.2 | no (panel UI) |
| `TemplateGallery.tsx` + `PreviewCanvas.tsx` | 5.6 | 1.3 | no (other views) |

About 136 KB raw (32 %) of the chunk is not needed to paint the Live hero. That may be about 40 KB gzip, which is about 0.8 s at 3G speed.

The CSS chunk starts with **6 `@import`s of third-party font CSS** (`src/index.css` lines 2–17): 5 Google Fonts sheets and 1 Fontshare sheet, about 70 families. One of them (the Rubik/Syne/… sheet) alone holds 274 `@font-face` rules. They chain behind `index.css`, so the browser discovers them only after the CSS arrives. The font CSS adds about 48 KB of render-blocking CSS. The Live view then uses 4 font files: Outfit, Inter, JetBrains Mono, Geist Mono (about 133 KB).

## Results (production build)

| Run | FCP | LCP | First canvas paint | Fonts ready | CLS | Bytes | Req |
|---|---|---|---|---|---|---|---|
| live, no throttle, CPU 1x | 324 | 324 | 284 (2D) | 388 | 0.019 | 310 KB | 15 |
| live, Slow 4G | 1524 | 1524 | 1537 (2D) | 2388 | 0.019 | 315 KB | 15 |
| live, 3G | 4956 | 4956 | 4974 (2D) | 8171 | 0.019 | 315 KB | 15 |
| live, Slow 4G, panel closed | 1424 | 1424 | 1451 (2D) | 2133 | 0.020 | 284 KB | 14 |
| live, Slow 4G, mobile | 1552 | 1552 | 1568 (2D) | 2488 | 0.025 | 315 KB | 15 |
| **templates (first visit)**, Slow 4G | 1544 | **5800** (poster img) | 1761 (WebGL) | 3347 | **0.079** | **1161 KB** | 61 |

All times in ms from navigation start. LCP element on Live is always the hero `<h1>` ("Something broke…").

### 3G waterfall (Live)

```
 0 ms ─ HTML (1.2 KB) ──┐ 419
430    ├─ index.css (10.8 KB) ───────────┐ 1353
430    ├─ Google CSS from index.html ─┐ 1081
430    └─ index.js (120.8 KB) ─────────────────────────────────────────────┐ 4682
1354        └─ 6 @import font sheets (48 KB) ─────────────┐ 3513
4798                                      fonts requested only after render ─┐ 8072
4956   FCP = LCP = first 2D canvas paint (JS-bound)
```

What the visitor sees:

1. 0–5.0 s: a flat `#13141F` screen (body `--color-navy`). See `live-3g-00500ms.jpg` to `live-3g-04000ms.jpg`.
2. 5.0 s: the colour jumps to the hero background `#0A1714`. Header, headline, dot field and Design Panel appear at once in fallback fonts.
3. 7.8–8.2 s: web fonts swap in. CLS stays low (0.019 total), mostly the bottom CTA row (`DIV.relative z-10 mt-auto`) and nav text.

The CPU cost after the JS arrives is small: about 270 ms from JS end to FCP at 4x throttle. On these profiles the network is the bottleneck, not the main thread.

### Templates first visit (Slow 4G)

- 9 poster JPEGs are requested at once (820 KB of images). `loading="lazy"` does not help: on slow connections Chrome's lazy-load margin is large, so rows below the fold still load.
- The 3 Full Bleed artboards are live `<iframe>`s. Each loads the full app again. Until ~5.8 s they show black boxes (`templates-first-slow4g-04000ms.jpg`). With a warm HTTP cache the iframes reuse `index.js`; this run had the cache disabled, so treat iframe bytes as worst case.
- CLS 0.079 comes from the artboard grid (`DIV.relative rounded-2xl`) at 1.8 s.

## Recommended fixes, ranked by gain / effort

### 1. Static shell in `index.html` + inline hero background — high gain, low effort

- **Files:** `index.html` only.
- **Change:** add an inline `<style>` that sets `html,body{background:#0A1714}` (matches `theme-color` and the hero `colorBack`). Put a static shell inside `#root`: the headline text and a CSS-only dot field (`radial-gradient(circle,#E6307A 30%,transparent 33%) 0 0/24px 24px`). `createRoot().render()` replaces it, so React needs no change.
- **Measured gain** (patched `dist/` copy, together with fix 2): FCP 4956 → 1328 ms on 3G, 1524 → 660 ms on Slow 4G, 1552 → 460 ms on mobile. The navy-to-green colour jump goes away. Screenshot: `fix-live-3g-02000ms.jpg`.
- **Caveats:** the shell must follow the active template (colour, headline). A `?template=` or `?preset=` URL can show a different hero after hydration. The safe version uses only the background colour and the default headline. A baked poster image is an option, but the smallest current poster is 119 KB, which costs about 2.4 s on 3G. The CSS dot field costs 0 bytes.

### 2. Stop the `@import` font chain; request only the fonts in use — high gain, low effort

- **Files:** `src/index.css` (lines 2–17, delete the 6 `@import`s), `index.html` (one `<link>` for the families the default view uses, with `rel="preload" as="style"`), optionally `src/themes/fonts.ts` / the Design Panel to load other families on demand when a user picks them.
- **Why:** `@import` inside the bundled CSS is discovered late (after `index.css`) and is render-blocking. About 70 families and 48 KB of font CSS block render for 4 fonts that are used.
- **Measured gain:** requests 15 → 9, bytes 315 → 267 KB, fonts ready 8171 → 4305 ms on 3G, CLS 0.019 → 0.002 on desktop. With the shell in place, the `@import` chain (done at 3.5 s on 3G) would otherwise become the new blocker.
- **Also:** add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for Outfit (the headline face) if the Google URL is stable, or self-host the 4 woff2 files to remove the 2 third-party origins. `display=swap` is already on every Google URL.
- **Side finding:** the first Google `@import` asks for `Satoshi`, which is a Fontshare family, not a Google one. Google seems to ignore it, so Satoshi may never load from that URL.

### 3. Code-split panel and other views from the Live hero — medium gain, low–medium effort

- **Files:** `src/lab/HeroLab.tsx` (`React.lazy` for `TextInspectorPanel`, `TemplateGallery`, `PreviewCanvas`, `LayerExplorer`), `src/components/playground/TextInspectorPanel.tsx` / wherever `DitherPanel` is imported.
- **Expected gain:** about 136 KB raw / ~40 KB gzip off the critical chunk. That may move LCP on 3G from ~4.6 s to ~3.8 s. Measured hint: closing the panel already cuts FCP on Slow 4G from 1524 to 1424 ms and saves 1 font file (Inter/JetBrains for the panel).
- **Caveat:** the panel is open by default, so the panel chunk still loads right after first paint. Mount it after the hero's first frame (e.g. in `requestIdleCallback`), not in the same render.

### 4. Make Templates cheaper for first-time visitors — high gain for the default path, medium effort

- **Files:** `src/lab/TemplateGallery.tsx`, `public/posters/`, possibly `src/lab/HeroLab.tsx`.
- **Changes:**
  1. Re-encode posters to WebP (or AVIF). Measured with `cwebp -q 75`: all 9 posters 2.44 MB → 1.19 MB at full size, 0.55 MB at half size. The artboards render far smaller than the 1440–1668 px sources, so add `srcset`/`sizes` or ship a half-size set.
  2. Add `fetchpriority="high"` on the first visible poster, and `decoding="async"` on all.
  3. Show the poster inside the active artboard until its iframe has painted, instead of a black box. The iframes take ~4 s on Slow 4G.
  4. Reserve the artboard grid height before layout to remove the 0.078 shift.
- **Expected gain:** image bytes may fall from 820 KB to about 200 KB on the first screen. LCP (a poster) should then fall from 5.8 s toward 2.5–3 s on Slow 4G. Not measured.

### 5. Respect data-saver and slow-network signals — low gain on these profiles, low effort

- **Files:** `src/heroes/dither/DitherHero.tsx` (motion), `src/lab/HeroLab.tsx` (view default).
- Today nothing reads these signals (`grep -rnE "saveData|effectiveType|navigator\.connection|prefers-reduced-data|deviceMemory|hardwareConcurrency" src` returned nothing). Only `prefers-reduced-motion` is honoured (`spatialMotionScale = 0.15`).
- **Change:** if `navigator.connection?.saveData` or `effectiveType` is `2g`/`slow-2g`/`3g`, or `prefers-reduced-data: reduce` matches, do this:
  1. default first visit to Live instead of Templates (saves ~850 KB);
  2. keep the iframes and the hover WebGL layer unmounted until interaction;
  3. pause the scene animation (use the reduced-motion path).
- `navigator.connection` and `prefers-reduced-data` exist only in Chromium. Treat them as hints.
- **Expected gain:** large for the Templates path, small for Live, because the Live hero is already only one 2D canvas.

### 6. Lazy-load Paper (`@paper-design/shaders-react`) — low gain, medium effort

- **Files:** `src/heroes/dither/DitherHero.tsx` (another agent is editing this file now).
- The default Full Bleed template uses the 2D points path, and the hover WebGL layer is already lazy-mounted on first hover. So Paper's 27.6 KB raw (~9 KB gzip) is dead weight on first load. A `lazy(() => import('@paper-design/shaders-react').then(m => ({ default: m.Dithering })))` saves about 0.2 s on 3G.
- Lower priority than fixes 1–3, and it touches the file under rewrite. Do it after that rewrite lands.

### Not recommended now

- **Reduce motion on slow devices:** the CPU after JS arrival is small (~270 ms to FCP at 4x). No evidence of a slow-device problem from these runs. The existing `bench/` FPS measurements are the better source.
- **Server-side render / prerender of the full hero:** larger change. Fix 1 gets most of the FCP gain.

## Open questions

1. Should the first visit stay on Templates? It is the heaviest path (1161 KB, LCP 5.8 s on Slow 4G).
2. Should the static shell follow URL params (`?template`, `?preset`), or show only the default hero?
3. Self-host the 4 woff2 files, or keep Google Fonts with a trimmed URL?
4. Should the measurement script be committed next to `bench/measure.mjs`? It is in the session scratchpad now.
5. Netlify serves brotli, so the real JS transfer may be about 105 KB, not the 121 KB gzip that `vite preview` served. The ratios above still hold.
