# Shader background review — architecture and library options

**Date:** 2026-11-21
**Branch:** `claude/research-shader-options-ca8b39` (measured at `ab4cb3f`, before the `perf/canvas-hot-paths` changes)
**Scope:** a read-only review of `src/heroes/dither/DitherHero.tsx`, `ditherStore.ts` and Paper's `shader-mount.js`; a library survey; and throwaway demos in [`shader-options/`](shader-options/index.html). No `src/` file changed.

## Answer

The layered approach is **in between, leaning sloppy**. It is a reasonable way to start: each `<Dithering>` is one Paper component, so stacking them is the quickest way to art-direct colour layers. At the current size (3 layers at rest, 3 more on hover, optional 3 multi-colour layers, CSS masks, and a second CPU renderer for the point modes) it costs far more than the look needs.

The look itself is cheap. The single-pass prototype draws the same frame with **1 WebGL context and 1 draw per frame**, where the current stack uses 3 contexts at rest and 6 on hover. For the points mode, it uses about **3 ms of main-thread script per second**, where the lab's 2D canvas uses 51 ms/s at rest and 895 ms/s during a hover sweep.

There are two separate problems:

1. **The free Color/alpha path** stacks Paper WebGL contexts and asks the compositor to blend and mask them.
2. **The canonical templates (Full Bleed, URL defaults, snapped Color/alpha)** do not use WebGL at all. They draw about 2,300 rounded rectangles per redraw on a 2D canvas with JS noise per tile, and rebuild the hover mask on the CPU.

One fragment shader can replace both renderers.

## 1. What runs today (measured)

Method: headless Chrome 157 with ANGLE Metal on an Apple M4 Pro, 1440×900 CSS px at DPR 2. A script injected before page load counts `getContext`, `drawArrays`, `uniform*`, 2D `fill`/`fillRect`, `toBlob`/`toDataURL`, `style` attribute mutations, and rAF frames. CDP `Performance.getMetrics` gives main-thread time. Each scenario runs 3 s idle and then a 3 s circular hover sweep. The scripts and raw results are in [`shader-options/bench/`](shader-options/bench/) (`measure.mjs`, `instrument.js`, `shots.mjs`, `results-*.json`). They import puppeteer-core from a local npx cache path; change that import to run them elsewhere. Usage: `node measure.mjs <base-url> <out.json> '<{"name":"path"}>'`.

Dev server: `npm run dev -- --port 5174 --strictPort`. Pages: `/hero-lab/?preview=1&tile=…&grid=…&state=…`.

| Scenario (bare hero) | State | WebGL canvases | GL draws/s | Uniform calls/s | 2D fills/s | `toDataURL`/s | Style mutations/s | Main-thread script ms/s | rAF fps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Free Color/alpha (`tile=color&grid=0&state=problem`) | idle | 3 | 263 | 563 | 0 | 0 | 180 | 58 | 60 |
|  | hover | 6 | 549 | 1,228 | 0 | 0 | 180 | 107 | 60 |
| Point sizes (`tile=points&grid=1`) | idle | 0 | 0 | 0 | 8,899 | 0 | 0 | 51 | 60 |
|  | hover | 0 | 0 | 0 | 94,929 | 54.5 | 100 | **895** | **31** |
| Snapped Color/alpha (`tile=color&grid=1`) | idle | 0 | 0 | 0 | 17,222 | 0 | 0 | 67 | 60 |
|  | hover | 0 | 0 | 0 | 120,916 | 52.5 | 99 | **894** | **29** |
| Default lab view (3 preview iframes, points) | idle | 0* | — | — | 36,102 | 0 | 0 | 148 | 60 |
|  | hover | 0* | — | — | 98,073 | 33.4 | 57 | 666 | 39 |

\* One 20×20 WebGL2 canvas exists in the lab chrome. It is not part of the hero.

Notes on the numbers:

- **Contexts.** `DitherHero.tsx` has 10 `<Dithering>` JSX sites. At most 9 mount at once per hero (3 base + 3 multi-colour + 3 hover). In the Breakpoints view that may be 27 contexts across 3 iframes. Chrome warns above about 16 active contexts; I did not reproduce that warning here.
- **Draws above 60 × contexts.** 263 draws/s from 3 contexts means about 83 extra draws/s. Paper's `setUniforms()` calls `render()` right away (`shader-mount.js:357–361`), so every React prop change triggers one more full-screen draw outside the rAF loop.
- **Backing size.** Each Paper canvas is 894×559 (0.5 MP). The lab caps `maxPixelCount` at 500,000 on desktop, so Paper renders at 0.62× CSS px and the compositor scales it up to the 2880×1800 device surface.
- **Style mutations.** 180/s = 3 alpha wrappers × 60 fps. The colour-cycle opacity goes through React into `style`.
- **The hover numbers for the 2D paths are pre-fix.** They still use sync `toDataURL`, which the main session is moving to `toBlob`. The 2D fill counts (95–121k/s) stay after that fix: the reveal canvas and the warp mask both redraw every tile on the CPU.

### The concrete costs

1. **One WebGL context and one full-screen pass per layer.** Paper creates a `<canvas>` and calls `getContext('webgl2')` per `ShaderMount` (`shader-mount.js:62`). Its API has no way to share a context. Every layer pays for its own program, uniforms, rAF loop, `ResizeObserver` and drawing buffer.
2. **Compositor overdraw.** The browser composites each canvas as its own layer at device resolution, applies `opacity` and `mix-blend-mode: screen`, and then the container's `mask-image`. At rest that is 3 blended 5.2 MP layers plus a mask; on hover it is 6 layers plus 2 masks. I could not measure GPU time in headless Chrome, so treat this as derived from the layer count, not measured.
3. **Masks built on the CPU.** The tile mask and the hover mask are images (SVG data URLs or canvas blobs) that the compositor samples. The hover mask is redrawn tile by tile in JS and encoded to PNG on every cursor move.
4. **React drives uniforms.** Drift (24 fps), `maskAnimT` (12 fps), `mouse` (10 fps) and `warp` live in `useState` (`DitherHero.tsx:1117, 1172, 1829, 1881`). Each update re-renders the whole hero, rebuilds the props of every `<Dithering>`, and pushes uniforms. The main session counts about 37 renders/s at idle.
5. **Two renderers for one look.** Point sizes and snapped Color/alpha moved to a 2D canvas (`drawPointSizeCanvas`, `DitherHero.tsx:317`) to avoid threshold flicker. That canvas evaluates 2 fbm noise maps per tile in JS and draws each tile as a path. At 1440×900 that is about 2,300 tiles per redraw, on the main thread.

### A bug found while porting

`noiseFade` at `DitherHero.tsx:133` returns `t³·(t·(6t − 15) + 1)`. Perlin's quintic fade is `t³·(t·(6t − 15) + 10)`. With `+ 1`, the fade falls from 0 to −8 across each lattice cell instead of rising from 0 to 1:

```
t      0     0.25    0.5     0.75   1.0
+1     0    -0.04   -0.63   -2.90  -8.00
+10    0     0.10    0.50    0.90   1.00
```

So `valueNoise2` jumps at every integer lattice line. The tile-size map, the alpha map and the dissolve rim then show hard seams that `clamp` hides only partly. Fixing it changes the look, so it needs a visual sign-off. The prototype keeps the lab's formula by default; add `?fadefix=1` to `b-single-pass.html?mode=points` to see the corrected version.

## 2. Optimisation options, ranked by gain ÷ effort

| # | Option | Gain | Effort | Notes |
|---|---|---|---|---|
| 1 | `toBlob` for hover masks + IntersectionObserver pause | High on hover (removes the sync PNG encode); full savings off screen | Low | The main session is doing this on `perf/canvas-hot-paths`. |
| 2 | **Move Point sizes / snapped Color/alpha to one fragment shader** | Very high: main-thread script for the field drops from 51 → 3 ms/s idle and 895 → 3 ms/s on hover (demo B-points vs app). It removes the reveal canvas, the warp mask canvas and the blob pipeline. | Medium | `single-pass.js` already ports `tileThreshold`, `fbmNoise`, `tileSizeMapValue`, `tilePointAlpha`, `scaledGridPiece`, colour interpolation, the 'full' text clearance with rim, and a tile-quantised reveal. JS keeps measuring text rects and uploads them as a uniform array. Still to port: warp tile rotate/round, size spread on reveal, ripple/sharp/fade edge modes, `topInset`, the tooltip. |
| 3 | **Drive uniforms from one rAF loop, not React state** | Medium–high: removes the ~37 renders/s and the extra `setUniforms` draws; style mutations go to 0 | Low–medium | Keep drift, `maskAnimT`, mouse and warp in refs. Write uniforms directly (Paper: hold the `ShaderMount` through a ref and call `setUniforms`; custom shader: `gl.uniform*`). React re-renders only on panel changes. Works with or without #2 and #4. |
| 4 | **Collapse the Paper alpha stack + hover stacks into one shader** | High: contexts 3 → 1 at rest, 6 → 1 on hover; draws 263 → 60/s; no CSS blend layers, no mask images | Medium–high | Demo B-color matches the stack (see §4). The work is in the number of hover modes (reveal, recolor, warp recolor, overlay, multi-colour layers, ripple `clip-path`, edge masks). Each mode becomes a uniform branch. |
| 5 | Render the single pass at native DPR | Sharper tile edges than today (the stack renders the dither at 0.62× and the compositor masks at full res) | Low (after #4) | One pass at 5.2 MP may cost less GPU than 3–6 passes at 0.5 MP plus 3–6 blended full-res layers. Not measured; check on a low-end Android first. |
| 6 | Fix `noiseFade` (`+ 1` → `+ 10`) | Removes lattice seams | Trivial | Changes the look; needs sign-off. |
| 7 | Bump `@paper-design/shaders-react` 0.0.71 → 0.0.82 | Licence clarity (see §3) | Trivial | The dithering fragment shader is byte-identical between 0.0.71 and 0.0.82 (`diff` of `dist/shaders/dithering.js`). |
| — | Share one canvas between several Paper mounts | — | — | **Not possible with Paper's API.** Each `ShaderMount` creates its own canvas and context. Doing this means writing your own mount, which is #4. |

Suggested order: 1 → 3 → 2 → 4. Steps 1 and 3 are low risk. Step 2 removes the worst main-thread cost on the canonical templates. Step 4 is the cleanest result but touches the most behaviour.

## 3. Library survey

Sources: npm registry (`npm view <pkg> version license time dist.unpackedSize`), GitHub API (`gh api repos/<owner>/<repo>` and `…/commits?per_page=1`), bundlephobia API for sizes. Checked 2026-11-21. Sizes are bundlephobia min+gzip of the whole entry point, not a tree-shaken single import.

| Library | Licence | Size (min+gz) | Latest release | Maintained? (last commit) | Dither + hover reveal | One context for many layers | Fit |
|---|---|---|---|---|---|---|---|
| [Paper Shaders](https://github.com/paper-design/shaders) (`@paper-design/shaders-react`) | Apache-2.0 from 0.0.78; 0.0.71 is unclear (see below) | 83.0 kB (react), 64.3 kB (core) | 0.0.82 (2026-10-21) | Yes (2026-11-10) | Dithering is native; the reveal needs a custom `fragmentShader` | No — one context per mount | Keep for the shader *code*; stop stacking mounts. |
| [OGL](https://github.com/oframe/ogl) | Unlicense | 34.2 kB | 1.0.11 (2025-01-27) | Slow (2025-04-13) | Via custom shader (demo C) | Yes | Fine, but buys only resize/uniform plumbing. |
| [twgl.js](https://github.com/greggman/twgl.js) | MIT | 22.7 kB | 7.0.0 (2025-07-16) | Yes (2026-10-19) | Via custom shader | Yes | Smallest maintained helper. |
| [regl](https://github.com/regl-project/regl) | MIT | 37.7 kB | 2.1.1 (2024-11-12) | Yes (2026-06-22) | Via custom shader | Yes | Works; releases are rare. |
| [three.js](https://github.com/mrdoob/three.js) | MIT | 185.7 kB | 0.187.0 (2026-10-30) | Yes (2026-11-21) | Via `ShaderMaterial` / TSL | Yes | Too heavy for one full-screen triangle. |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) | MIT | 57.7 kB + three | 9.8.2 (2026-10-14) | Yes | Via custom shader | Yes | Only if 3D is planned. |
| [@react-three/drei](https://github.com/pmndrs/drei) | MIT | 521.5 kB (tree-shakes) | 10.7.9 (2025-09-25) | Yes (2026-09-30) | Helper only (`shaderMaterial`) | Yes (via r3f) | Not needed. |
| [ShaderGradient](https://github.com/ruucm/shadergradient) | MIT (npm) | 49.5 kB (may exclude three) | 2.4.20 (2025-12-08) | Yes (2026-09-23) | No — 3D gradient meshes | — | Wrong look. |
| [curtains.js](https://github.com/martinlaxenaire/curtainsjs) | MIT | 23.5 kB | 8.1.6 (2024-05-02) | No (2025-04-03) | Via custom shader | Yes | Superseded by gpu-curtains. |
| [gpu-curtains](https://github.com/martinlaxenaire/gpu-curtains) | MIT | 120.0 kB | 0.17.4 | Yes (2026-11-16) | Via WGSL | Yes | WebGPU only (fallback not verified). |
| [TypeGPU](https://github.com/software-mansion/TypeGPU) | MIT | 90.5 kB | 0.12.10 (2026-11-06) | Yes (2026-11-20) | Via TS→WGSL | Yes | WebGPU only, 0.x. Later experiment. |
| [Vanta](https://github.com/tengbao/vanta) | MIT | 2.7 kB + three/p5 | 0.5.24 (2022-09-16) | No (2023-01-12) | No (fixed effects) | No | Abandoned. |
| [glslCanvas](https://github.com/patriciogonzalezvivo/glslCanvas) | MIT | 9.1 kB | 0.2.6 (2022-11-23) | No | Via custom shader | One per canvas | Abandoned. |
| Unicorn Studio (`unicornstudio-react`) | Wrapper MIT; runtime has no licence file | 236.4 kB (wrapper) | 2.4.0 (2026-10-11) | Yes | Likely in the editor (not verified) | Not verified | Editor lock-in; licence unclear. |
| Raw WebGL2, one canvas (demos B) | Own code | Own code only: ~110-line driver + ~250-line shader file | — | — | Yes, full control | Yes | **Recommended.** |

**Paper licence detail.** The `LICENSE` file shipped inside the installed `node_modules/@paper-design/shaders@0.0.71` tarball says **MIT** (© 2024 Lost Coast Labs). The npm `license` field for 0.0.71 says "SEE LICENSE IN https://github.com/paper-design/shaders/blob/main/LICENSE". The repo's LICENSE history (`gh api repos/paper-design/shaders/commits?path=LICENSE`) shows PolyForm Shield from 2025-08-22 to 2026-06-27, and Apache-2.0 since then. So 0.0.71 (published 2026-01-19) points at a URL that then held PolyForm Shield (it has a noncompete clause), while its own tarball says MIT. Version 0.0.78 and later declare Apache-2.0 on npm, and 0.0.82 ships the Apache-2.0 text. Bumping removes the ambiguity. I am not giving legal advice here.

**Recommendation for this lab.** Do not change libraries. Keep Paper's GLSL (now Apache-2.0) as the source for the dither shapes, and write a small raw WebGL2 mount that runs one combined shader. A library such as OGL or twgl adds 23–34 kB gzip and saves perhaps 60 lines; it does not change the GPU cost (demo C draws the same frame through OGL with the same 1 context and 60 draws/s). three.js/R3F and the WebGPU options are only worth it if the lab adds 3D or compute work.

## 4. Demos

Folder: [`docs/research/shader-options/`](shader-options/). These are throwaway pages with no build step. Serve the folder over HTTP, because ES modules do not load from `file://`:

```bash
cd docs/research/shader-options && python3 -m http.server 8090
```

Then open `http://localhost:8090/`. `index.html` shows all four side by side.

| Page | What it is |
|---|---|
| `a-paper-stack.html` | Replica of the current free Color/alpha architecture. Uses Paper 0.0.82 from jsDelivr: 3 `ShaderMount`s with CSS opacity + screen blend, a repeating SVG tile mask, 3 more mounts lazy-mounted on hover behind a `toBlob` canvas mask, drift pushed through `setUniforms` at 24 fps, opacities written every frame. |
| `b-single-pass.html` | One WebGL2 context, one fragment shader (`single-pass.js`), one draw per frame. Color/alpha mode: the three Paper dither layers, screen blend, tile mask and reveal all run in the shader. |
| `b-single-pass.html?mode=points` | The same shader in Point sizes mode: a GPU port of the lab's 2D point canvas, with whole-tile text clearance and the dissolve rim. |
| `c-ogl.html` | B's shader mounted through OGL 1.0.11, to show what a helper library adds. |

Query flags: `?t=3` freezes time, `?mx=980&my=300` fakes the cursor, `?grid=0` drops the tile mask, `?fadefix=1` applies the `noiseFade` fix.

The Color/alpha demos use the **Problem** template values (scale 0.81, 32 px square tiles, gap 13). The store defaults (scale 0.21) give an almost flat field: only the warp layer survives the dither, in both A and B, so it is a poor test scene.

### Look parity (B vs the real Paper stack)

Both pages frozen at `t=3` and rendered at 1440×900 DPR 2. The HUD and nav are excluded from the diff.

| Comparison | Mean abs diff (0–255) | Pixels differing by > 24 |
|---|---:|---:|
| A vs B, no tile mask, no hover | 0.30 | 1.31 % |
| A vs B, tile mask + hover reveal | 2.16 | 5.57 % |
| B vs C (same shader, OGL) | 2.19 | 4.95 % |

With no mask, the remaining difference is resampling at dither-cell edges. With the mask, the extra difference is at tile edges: B evaluates the tile mask at the capped 0.5 MP backing size, while the browser masks A at device resolution. Option #5 (native DPR) would remove it. B vs C differs because OGL rounds the backing height to 558 instead of 559. By eye, the A and B frames are the same, including the reveal (screenshots were checked side by side).

### Measured cost of the demos

Same harness as §1.

| Demo | State | WebGL canvases | Backing MP | GL draws/s | Uniform calls/s | 2D fills/s | `toBlob`/s | Style mutations/s | Script ms/s | Task ms/s | fps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A · Paper stack | idle | 3 | 1.5 | 181 | 303 | 0 | 0 | 162 | 4 | 20 | 60 |
|  | hover | 6 | 3.0 | 357 | 613 | 2,579 | 30.7 | 188 | 140 | 422 | 59 |
| B · single pass, Color/alpha | idle | 1 | 0.5 | 60 | 301 | 0 | 0 | 0 | 3 | 11 | 60 |
|  | hover | 1 | 0.5 | 60 | 300 | 0 | 0 | 0 | 3 | 15 | 60 |
| B · single pass, Point sizes | idle | 1 | 5.2 | 60 | 300 | 0 | 0 | 0 | 3 | 12 | 60 |
|  | hover | 1 | 5.2 | 60 | 300 | 0 | 0 | 0 | 3 | 15 | 60 |
| C · OGL | idle | 1 | 0.5 | 60 | 180 | 0 | 0 | 0 | 5 | 13 | 60 |
|  | hover | 1 | 0.5 | 60 | 240 | 0 | 0 | 0 | 6 | 19 | 60 |

Demo A has no React, so its idle script time (4 ms/s) is far below the lab's 58 ms/s. The gap between the two is React re-rendering the hero to push uniforms (option #3). On hover, A's task time rises to 422 ms/s from the mask draw, PNG encode and mask re-decode alone.

## 5. Limits of this review

- All numbers come from one fast desktop GPU in headless Chrome. GPU time per frame was not measured (no timer query in this setup). Low-end mobile may rank the options differently, especially option #5.
- The prototype does not port every hover mode, edge mode or the warp tile transform. The parity check covers the Problem-style reveal only.
- I measured the app at `ab4cb3f`. The `perf/canvas-hot-paths` branch changes the hover numbers for the 2D paths.

## Evidence

- Code read: `src/heroes/dither/DitherHero.tsx` (render tree 2225–2570, `drawPointSizeCanvas` 317, `buildWarpMask` 930, noise helpers 120–238, state hooks 1068–1881), `src/heroes/dither/ditherStore.ts` (layers 699–725, templates 1631–1680), `src/heroes/dither/urlParams.ts`, `node_modules/@paper-design/shaders/dist/shader-mount.js` (62, 150–209, 357–361), `dist/shaders/dithering.js`.
- Commands: `npm run dev -- --port 5174 --strictPort`; puppeteer-core 25.11.0 measurement scripts in `shader-options/bench/`; `npm pack @paper-design/shaders@0.0.82` + `diff` of the dithering shader against 0.0.71; `gh api repos/paper-design/shaders/commits?path=LICENSE`; `npm view` for every library; PIL/numpy pixel diff of frozen screenshots.
- URLs: the repository links in the §3 table; https://github.com/paper-design/shaders/blob/main/LICENSE; https://bundlephobia.com/api/size?package=…; https://cdn.jsdelivr.net/npm/@paper-design/shaders@0.0.82/+esm; https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm.
