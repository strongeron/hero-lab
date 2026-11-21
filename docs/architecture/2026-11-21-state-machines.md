# Dither hero state machines — map before the panel cleanup

Date: 2026-11-21. Measured at `2d8f17b` (branch `perf/single-pass-shader`).
Files: `src/heroes/dither/ditherStore.ts`, `DitherHero.tsx`, `DitherPanel.tsx`,
`urlParams.ts`, `tileField.ts`, `src/lab/HeroLab.tsx`, `LayerExplorer.tsx`,
`TemplateGallery.tsx`, `PreviewCanvas.tsx`.

This map lists every state holder (explicit and implicit), who writes it, who reads
it, and the paths that are dead, duplicated or in conflict. The refactor that follows
is driven from the last section.

## 1. Overview

```
 writers                          store (one per window)                readers
 ───────                          ──────────────────────                ───────
 Design Panel ─┐                  DitherState                        ┌─ DitherHero (render)
 URL params ───┤  set*Config()    ├ shader      (look + speed)       │   ├ Paper <Dithering> stack
 applyHero-    ├─────────────────▶├ animation   (scene motion)  ────▶│   ├ GPU tile field (tileField.ts)
   Template ───┤  applyScene...   ├ pixelGrid   (tile geometry)      │   └ copy block + overlays
 applyScene-   │                  ├ edge        (where tiles end)    ├─ DitherPanel (controls)
   Template ───┤                  ├ hover       (warp reveal)        ├─ LayerExplorer (steps)
 LayerExplorer ┤                  ├ initialState / activeScene /     └─ TemplateGallery (picker)
 HeroLab ──────┘                  │ activeTemplate / stableColorField
   (topInset)                     └─ emit() ──▶ BroadcastChannel ──▶ preview iframes
                                                 (source → preview, 1.5 s heartbeat)

 DitherHero implicit state (refs + local state), one rAF loop each:

   inView (IntersectionObserver) ─┐
   reducedMotion (media query) ───┼─▶ anim.playing / spatialMotionScale
   document.hidden ───────────────┘          │
                                             ▼
   [1] drift loop ── driftRef (offset, loop, rotation, pulse, colorPhase, gap)
         │            ├─▶ alpha wrapper opacity (colour swing)
         │            ├─▶ pushPaperUniforms() ─▶ Paper mounts
         │            └─▶ setDriftTick 24 fps (gap pulse, Paper path only)
   [2] mask loop ─── maskAnimTRef ─▶ setMaskAnimT 12/24 fps (CSS masks)
   [3] ripple loop ─ ripplePhase 24 fps (ripple edge only)
   [4] hover loop ── hoverAnim ref (px, py, radius, velocity, dwell)
         │            ├─▶ warp PNG masks ─▶ setWarp (CPU warp, grid on)
         │            ├─▶ clip-path / mask-image on fix layer (other modes)
         │            ├─▶ setTip 12 fps (error text, GPU warp)
         │            ├─▶ haptics
         │            └─▶ pushPaperUniforms() (mouse influence)
   [5] GPU loop ──── reads driftRef, maskAnimTRef, hoverAnim; draws when moving or dirty
   [6] size-mask effect (toBlob per maskAnimT step, 'size' tile display)
   [7] baseline lock (3 settle frames + ResizeObserver)
   timers: GL context-loss poll (3 s) ─▶ glEpoch remount;
           hover release (2 s after leave) ─▶ hoverActive=false unmounts hover stack
```

## 2. Explicit state — the store

| Holder | Written by | Read by |
| --- | --- | --- |
| `shader.*` (colours, layers, type, size, speed, frame, fit, scale, rotation, offset, origin, world) | Panel, templates, scenes (`speed`, `colorCycleSpeed`), Layers (`size`), `setInitialState` (layers, `colorFront`), `setTerminalTheme` (`colorBack`) | Paper props, `pushPaperUniforms`, GPU frame, drift loop (`colorCycleSpeed`) |
| `animation.*` (playing, drift, pulse, scan, wave, gap pulse, loop break, tile display, tile size) | Panel, scenes (all motion keys), templates, Layers (`tileDisplay`, `playing`), URL (`tileDisplay`, tile size), pinned previews | drift loop, mask loop, renderer choice (`tileDisplay`) |
| `pixelGrid.*` | Panel, templates, Layers, URL (whole grid), pinned previews (`enabled`) | renderer choice (`enabled && snap`), CSS tile mask, warp masks, GPU grid |
| `edge.*` | Panel, templates, Layers (`bareEdge`), HeroLab (`topInset` from header height) | dissolve / ripple / text-clear masks, GPU edge, copy-area background |
| `hover.*` | Panel, templates, Layers (`enabled`), `setInitialState` (`hoverLayers`, `fixColor`, `fixShape`) | hover loop, hover Paper stack, GPU warp, tooltip |
| `multiColor.*` | Panel | extra Paper layers, GPU rest layers |
| `haptic.*` | Panel | hover loop |
| `layout.*` | Panel, URL (`guides`, `baselines`); templates keep the two debug flags | copy grid, baseline lock, overlays |
| `button.*`, `headerBg`, `copyVariant`, `copyVariants[id]` (mutated in place by `setCopyFont`) | Panel, templates, URL (`copy`) | copy block, header |
| `initialState` | Panel, templates, URL (`state`), pinned previews | `problemMotionBoost`, tooltip pool, hints |
| `activeScene` | `applySceneTemplate`, templates; set to `null` by any scene key in `setShaderConfig` / `setAnimationConfig` (not by `setLoopBreak`) | drift loop baseline reset (`sceneStartDrift`), `problemMotionBoost`, scene highlight |
| `activeTemplate` | `applyHeroTemplate` | gallery highlight, preview frames (live vs canonical) |
| `stableColorField` | Layers on enter/leave | drift loop (opacity swing off) |
| `terminalTheme` | URL (`theme`) | CTA colours, `hoverFixColor`, `colorBack` |
| `wtfTitlePositions` | Panel (only when `copyVariant === 'wtf'`) | nothing in the hero |

Store transitions with side effects:

- `applyHeroTemplate(id)` = defaults + template patch. Keeps `edge.topInset`,
  `layout.showGuides`, `layout.showBaselines`. Resets `stableColorField`,
  `terminalTheme`, `multiColor`, `haptic`. Swaps layers by `initialState`.
- `applySceneTemplate(id)` = motion keys reset to defaults, scene motion on top,
  `loopBreak` from `SCENE_LOOP_BREAK`, `playing = true`.
- `setInitialState(id)` swaps colours and shapes, keeps opacities by index.
- Preview sync: a pinned artboard shows its template paused (`playing = false`) and
  goes live only while its template is the active one in the source window. A bound
  frame (`sid`) ignores other tabs unless its source is silent for more than 5 s.

## 3. Implicit state — DitherHero

| Holder | Kind | Drives |
| --- | --- | --- |
| `inView` | IntersectionObserver | `anim.playing = false` off screen: stops loops 1–3, Paper speed 0, GPU loop idles |
| `reducedMotion` | media query | `spatialMotionScale = 0.15`: scales motion amplitudes and Paper speed, not loop time |
| `driftRef` | ref, loop 1 | Paper offset / rotation / scale uniforms, GPU flow, colour swing, gap pulse |
| `renderedSceneRef` | ref | on `activeScene` change: drift jumps to `sceneStartDrift[scene]` |
| `problemMotionBoost` | derived | ×1.8 motion when `initialState = problem`, tile display colour and a scene is active — Paper path only |
| `maskAnimTRef` / `maskAnimT` | ref + state, loop 2 | dissolve rim motion, snapped colour field time, point size time |
| `ripplePhase` | state, loop 3 | ripple edge |
| `hoverAnim` | ref, loop 4 | warp position and radius (eased 0.08 per frame), dwell radius, velocity |
| `mouseRef` | ref | Paper origin (`mouseInfluence`) |
| `hoverActive` + release timer | state | mounts the hover Paper stack on first move, unmounts 2 s after leave |
| `warp` + `warpCommittedRef` | state + ref | CPU warp masks; fix layer is shown only after its mask commits (no blink) |
| `tip` | state | error-text tooltip for the GPU warp |
| `containerSize`, `textRects`, `contentTop`, `baselineNudge`, guides | state + ResizeObserver | masks, GPU edge, copy alignment |
| `glEpoch` | state + 3 s poll | remounts every WebGL stack after a context loss |
| `tileDirtyRef` | ref | one GPU frame after any commit when nothing moves |

Renderer choice (implicit, from four store keys):

```
pixelGrid.enabled ─┬─ no ──────────────────────────────▶ Paper stack, no tile mask   (Fine Grain)
                   └─ yes ─ tileDisplay ─┬─ points ────▶ GPU tile field             (Full Bleed)
                                         ├─ color ─ snap ─┬─ yes ▶ GPU tile field   (defaults)
                                         │                └─ no ─▶ Paper + CSS tile mask (Problem)
                                         └─ size ──────▶ Paper + canvas size mask (not offered)
hover warp:  GPU path draws it in the shader; Paper + grid builds PNG masks;
             Paper without grid builds a "warp-only grid" from hover.fixSize.
```

## 4. Control → effect map (Design Panel before)

| Panel group | Controls | Store keys | What they drive |
| --- | --- | --- | --- |
| Scene | Initial state | `initialState` + layer swap | resting and revealed colours |
| Dithering shader | Back, Alpha/Solid, 3 × (colour, shape, opacity), Colour cycle, Front, Shape, Type, Cell size | `shader.*` | Paper props; GPU layers |
| Motion | Speed, Frame | `shader.speed`, `shader.frame` | Paper time; Frame is a static offset |
| Sizing | Fit, Scale, Rotation, Offset X/Y, Origin X/Y, World W/H | `shader.*` | Paper uniforms; GPU snapped colour |
| Pixel grid | On, Snap, Tile size, Divide, Gap, Radius, Align X/Y, Tile animation, Size spread, Size speed, Map scale | `pixelGrid.*`, `animation.tile*` | renderer choice and geometry |
| Multi-colour | On, 3 colours, Spread, Blend | `multiColor.*` | extra layers |
| Section edge | 6 modes, Position, Top start, + up to 12 mode-specific rows | `edge.*` | masks, GPU edge |
| Animation | Play, 11 scenes, Break loop + amount, fine-tune (13 rows) | `animation.*`, `shader.speed` | loop 1, loop 2 |
| Hover | On, 4 modes, Preview, warp (4 sliders, 3 toggles, reach, overlay), Trigger, Dwell (2), Area shape, Tint, Hover layers, 7 reveal overrides, Radius, Height, Dynamic size, Mouse influence | `hover.*` | loop 4, hover stack, GPU warp |
| Haptics | On, debug, tick (3), events (2), dwell (2) | `haptic.*` | loop 4 |
| Text | Header, Buttons (3), Copy, Layout (3 + 2 debug), WTF positions, Typography (18 choices) | `headerBg`, `button`, `copyVariant`, `layout`, `copyVariants[id]` | copy block |

Before: 38 sliders, 36 choice groups, 4 colour inputs, 163 buttons, 22 section
headings (Live view, Full Bleed, measured in the browser).

## 5. Dead, duplicated and conflicting paths

Dead (no template, URL param or offered control reaches it):

1. `tileDisplay: 'size'` — `drawTileSizeMask`, the blob size mask, `buildSizeMaskContainerStyle`. Only `?tile=size` in a pinned preview reaches it.
2. Paper with `gridSnap` — `snapDotSize`, rotation 0, the snap branch in `pushPaperUniforms`. Snap always routes to the GPU field.
3. `wtf` copy variant and `wtfTitlePositions` — not offered; the URL guard rejects it; the hero never reads the positions.
4. `hover.warpShrink` — never read.
5. `buildMask('full')` — returns a fade gradient, but the Paper base layer never mounts in Full mode.
6. Hover reveal overrides in the GPU point path — `mapScale` uses `tileSizeNoise`, so `fixScale` is ignored.

Duplicated:

1. Copy Config button three times; Reshuffle, Dissolve depth and rim motion three times; Clearance follows and Whole tiles twice each; button radius as segmented and slider.
2. The recolor branch is rendered twice (warp recolor, recolor mode); the per-layer Paper stack is copy-pasted four times.
3. Pixel-circle snapping in three places (`tileInHoverArea`, `buildWholeTileCircleClip`, GLSL `inHover`).
4. `TILE_SIZE_*` constants and the grid metrics exist in both the panel and the hero.

Conflicting (break the hover, the initial state or pixel alignment):

1. `mouseInfluence: 1` moves the Paper origin with the cursor and leaves it offset after the pointer leaves (`mouseRef` keeps the last position) — the resting state changes after one hover.
2. Panel toggles create renderer combinations no template uses: Pixel grid off under Points, Solid background (single layer, single hover colour), Full edge without the GPU field (fade gradient), Snap with Paper.
3. Non-warp hover modes, dwell, square and circle areas cut tiles at the rim (partial tiles), unlike the pixel circle.
4. Fine Grain warp: no grid, so the warp builds tiles from `hover.fixSize` (18.5 px) and reveals the other state with `fixType 2x2`, `fixSize 18.5`, `fixScale 0.81` — the tile shapes of the first templates, not the Fine Grain field (`8x8`, size 2, scale 0.6). The tiles also rotate (`warpRotate 35`).
5. Pixel alignment:
   - odd gaps centre each piece on a half pixel (`inset = gap / 2`; Problem gap 13 → 6.5 px);
   - the snapped grid phase is `width / 2 mod pitch` (half pixel on odd widths);
   - gap pulse makes the gap fractional (sub-pixel tiles, plus 24 fps React commits);
   - point sizes and warp sizes are fractional (sub-pixel dots);
   - non-integer Paper `size` (18.5) gives uneven dither cells;
   - the 500 k Paper pixel cap gives a fractional render scale on desktop (blurred dots).
6. URL params (`copy`, `state`, `theme`, `scene`) are applied before mount, then the first template overwrites them in the main window. They only survive in pinned previews.
7. `problemMotionBoost` scales the Paper path only; the GPU field ignores it, so the same scene runs at two speeds.
8. Hover effect deps include `hover.radius` and `hoverActive`, so a radius change or the first hover re-subscribes the listeners mid-gesture.

## 6. Refactor plan (from this map)

- Panel keeps colour, size, speed, shape and warp. Everything in section 5 "conflicting" 1–3 leaves the panel.
- Hover is warp-reveal only, pixel circle only. Delete recolor, reveal, overlay, dwell, square/circle areas, mouse influence, preview, dynamic size, haptics and the reveal overrides.
- Delete dead paths 1–6 and the unused edge modes (ripple, sharp, fade, overlap) and Scene behind text: no template uses them.
- Delete multi-colour (Layers already marks it redundant; no template uses it) and Solid background (no template uses it).
- Fine Grain warp reveals whole dither cells of its own field: no rotation, base type, size and scale.
- Pixel alignment: integer pieces on whole device pixels, integer grid phase, no gap pulse, integer Paper size, integer Paper render scale.
- URL params apply after the first template.
