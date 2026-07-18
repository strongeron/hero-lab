# Optimization Trace — Design Panel and Dither Shader

Date: 2026-07-18  
Scope: safe runtime and panel optimizations only. `docs/design-panel-taxonomy.html` was not modified.

## Protected behavior

- Full Bleed remains the canonical top template: Problem/pink at rest, green fix on hover, Full edge mode, Point sizes tile animation, and Space Grotesk headline/response.
- Problem remains: Problem/pink at rest, green fix on hover, Error Sweep, and Color/alpha tile animation.
- No template defaults, colors, copy, scene selection, edge treatment, tile geometry, or hover behavior were changed by this optimization pass.

## Changes made

### 1. Do not mount fully transparent shader layers

`DitherHero` now returns `null` for alpha layers with `opacity <= 0` in every WebGL-backed path:

- resting alpha stack;
- warp recolor;
- regular recolor;
- hover reveal.

This avoids creating a WebGL context and draw pass for a layer that contributes no pixels. Layers with opacity above zero follow the existing render path unchanged.

Measured in the three active Problem previews after setting one authored layer to zero:

| State | Desktop canvases | Tablet canvases | Mobile canvases |
| --- | ---: | ---: | ---: |
| Before | 3 | 3 | 3 |
| One layer at opacity 0 | 2 | 2 | 2 |
| Canonical template restored | 3 | 3 | 3 |

Result: one context/pass removed per disabled layer per viewport; three contexts saved across the active three-preview row in this test.

### 2. Remove duplicate Tile Animation controls

Tile Animation remains in the Pixel Grid section, where Mask size and Point sizes derive their geometry. The duplicate block in Animation was removed.

Verification:

- one `Color / alpha` button exists in the panel;
- one `Point sizes` button exists in the panel;
- switching `Color / alpha → Point sizes` updates store state and renderer correctly;
- scene controls and fine-tuning remain in Animation.

## Full Bleed regression check

Tested in Templates view across desktop, tablet, and mobile:

| Check | Result |
| --- | --- |
| Canonical mode | `points` |
| Canonical edge | `full` |
| Resting render | 1 two-dimensional point canvas per viewport |
| Hover/fix preview | 2 two-dimensional canvases per viewport; green fix layers visible |
| Lost WebGL contexts | 0 |
| Console on clean default session | no warnings or errors |

The zero-opacity WebGL optimization is a no-op for canonical Full Bleed because it uses the direct point renderer and all authored layers are nonzero.

## Build result

`npm run build` passed:

- 119 modules transformed;
- JavaScript: 415.50 kB / 118.32 kB gzip;
- CSS: 56.18 kB / 10.33 kB gzip.

`git diff --check` passed. This pass targets conditional runtime work and panel duplication, so a material bundle-size reduction is not expected.

## Optimization tips not applied

1. **Static inactive gallery previews.** Paused color-mode previews still retain their WebGL contexts. If the gallery grows, capture inactive artboards to static preview bitmaps and unmount their shaders. This is the highest-value next optimization, but it needs a dedicated visual-regression pass because mask and blend compositing must remain exact.
2. **Stress-path context budget.** Temporarily running three-layer Color/alpha in all Full Bleed previews while the three paused Problem previews remain mounted can cross Chrome's WebGL-context warning threshold. Canonical Full Bleed does not take this path—it uses one 2D point canvas—and the clean default session reports no warning. A static inactive-preview compositor would remove this edge case.
3. **Profile before splitting the panel bundle.** The current production JavaScript is 118.32 kB gzip. Lazy-loading panel groups would add complexity; collect an interaction/profile trace first and only split if panel parse or render time is measurable.
4. **Real-device validation.** Desktop localhost verifies correctness and context behavior, not mobile thermals or Core Web Vitals. Recheck on a low-end Android device before treating animation cost as fully characterized.

## Commands and checks

- `npm run build`
- `git diff --check`
- Chrome runtime inspection of template state, canvas counts, context-loss state, panel control count, hover preview, and console output.

## Follow-up — Layers recurring blink

Date: 2026-07-18

The Layers bare-scene preview was reported as changing abruptly every few seconds while Classic was selected.

Two causes were addressed:

1. **Classic was not actually calm.** Its Paper shader speed was `0.14`, close to the normal animated baseline, so large contours reorganized fast enough to read as a blink. Classic now uses speed `0.025`, pulse amount `0.006`, and slower pulse/gap timing.
2. **Development heartbeat could replay stale state.** Vite Fast Refresh replaces the store module while existing BroadcastChannel timers survive. The sync channel now resolves its current snapshot and preview destination through a window-level bridge, and the current store snapshot is retained across module replacement. A surviving heartbeat can no longer alternate the iframe between old and new scene settings.

Clean-session verification after eight seconds:

- source and Layers iframe both remained on `solid-classic`;
- both remained at speed `0.025`, Color/alpha, grid off;
- all three original WebGL canvases remained mounted;
- lost contexts: 0;
- console warnings/errors: none.

## Follow-up — Problem state scene compatibility

Date: 2026-07-18

Switching Initial State from Fix to Problem correctly preserved the selected
scene and all authored motion values, but it replaced the responsive
`swirl/wave` shader shapes with `simplex/warp`. At the Layers view's fine 2px
baseline, the same Gentle Drift values became visually near-static even though
the animation loop and all three WebGL layers were still running.

The renderer now normalizes motion energy for the Problem shape set while a
non-Classic scene is playing in Color/alpha mode. It applies a `1.8x` render-only
multiplier to shader speed and scene drift/pulse output. Stored scene values,
scene selection, colors, shapes, and panel controls are unchanged.

Regression boundaries:

- Fix keeps every authored scene value unchanged.
- Classic remains intentionally near-static in both states.
- Point sizes is excluded, so the Full Bleed template is unchanged.
- Pausing still forces effective shader speed to zero.

### Continuity correction after visual retest

The render multiplier alone did not remove the reported blink. A longer visual
sample exposed a second cause: Gentle Drift's `0.15` color-cycle rate repeats
about every 6.7 seconds, and cycling three unequal opacities changed the total
layer energy over that period. Meanwhile its `0.01 / 0.016` positional drift
needed several seconds to traverse even one `0.05` panel Offset step, so the
geometry appeared frozen between those brightness changes.

Corrections:

- Color/alpha cycling now normalizes every frame back to the authored combined
  alpha. Layers still trade emphasis, but the complete shader no longer pulses.
- Gentle Drift now advances at `0.035 / 0.05` on X/Y. The scene stays soft while
  producing visible geometric movement every second in both Problem and Fix.

Fresh-session evidence:

- eleven alpha samples across 7.5 seconds all totaled exactly `2.1500`;
- with Color Cycle temporarily set to `0`, screenshots 1.2 seconds apart still
  differed, confirming geometric scene motion independent of opacity;
- switching `Fix → Problem` preserved Gentle Drift and `0.035 / 0.05` motion;
- three WebGL canvases remained mounted; lost contexts: 0.

## Follow-up — snapped Color/alpha continuity

Date: 2026-07-18

The recurring flash could still be reproduced after progressively adding the
Pixel grid and Snap layers. This was separate from the alpha-cycle issue: hard
WebGL snap sizes the dither to one binary sample per tile, so a smooth scene
crossing a threshold replaces a large group of tiles in one frame. Adding
Multi-color amplified the effect and raised the preview from three to six WebGL
contexts.

Snapped Color/alpha now uses the existing stable tile canvas rather than the
binary WebGL snap path. It keeps fixed grid geometry and samples scene-driven
alpha/color continuously at 24fps. Multi-color is folded into that same field.
Free (unsnapped) Color/alpha remains the Paper shader, and Point sizes remains
unchanged.

Exact 3/5 Layers-stack verification (`Color Flow + Pixel grid + Snap +
Multi-color`):

- renderer: one 2D canvas, zero WebGL canvases;
- 20 samples at 100ms intervals: average channel delta `0.37`, maximum `1.39`;
- sampled brightness stayed within `66.54–70.88` with no discontinuous jump;
- switching to Problem preserved Color Flow and produced the red/orange field;
- lost contexts: 0.

## Full Layers wiring audit

Date: 2026-07-18

The complete Layers surface was exercised after the continuity corrections.
This pass covered every progressive stack level, all three tile renderers, all
eleven scenes, both initial states, live Design Panel edits, hover reveal, and
the protected Full Bleed template.

### Corrections

1. **Initial-state changes preserve authored opacity.** Problem/Fix still swaps
   the canonical state colors and shapes, but no longer replaces per-layer
   opacity values authored in the Design Panel.
2. **Progressive stack changes are atomic.** Store updates can now be batched,
   and every Layers action—including Full stack, Bare scene, renderer changes,
   and individual rows—publishes one complete configuration. This removes the
   transient renderer rebuilds that appeared as a blink.
3. **Snapped Color/alpha honors the shader panel.** Its stable tile canvas maps
   offset, origin, scale, rotation, frame, speed, and color cycle. Layer colors
   interpolate continuously, and alpha remains proportional down to the panel's
   `0.1` minimum instead of using an artificial visibility floor.
4. **Reduced motion is explicit.** `prefers-reduced-motion` scales spatial
   shader, drift, scan, wave, rotation, pulse, gap, loop-break, and tile-sample
   motion to 15%. Color cycling stays responsive so the selected authoring mode
   does not appear broken.
5. **Problem baseline locking is bounded.** The layout no longer lists
   `baselineNudge` as a dependency of the effect that updates it. It performs
   three convergence measurements after an input change, preventing fractional
   font metrics from causing a maximum-update-depth loop when Full stack turns
   on text flow.

### Verification matrix

- Structural: `396/396` combinations passed (`6 stack levels × 11 scenes × 2
  initial states × 3 renderers`). Every combination kept source/preview scene
  and state in sync, used the correct Problem/Fix shape set, remained Playing,
  mounted the expected renderer, and reported zero lost contexts.
- Snapped Color/alpha motion: `22/22` scene/state pairs changed visually, with
  no dead scene and no continuity spike in steady-state sampling.
- Mask size motion: `22/22` pairs produced six unique sampled mask URLs, kept
  six expected WebGL canvases, and lost zero contexts.
- Point sizes motion: `22/22` pairs changed. Large readings were confined to
  the first transition frame after selecting a new state; steady-state samples
  continued normally.
- Hover: Problem rest revealed green and Fix rest revealed pink in Color/alpha,
  Mask size, and Point sizes.
- Live panel mapping: fixed-frame edits to Offset X/Y, Origin X/Y, Scale,
  Rotation, and Frame all changed the snapped canvas; Color Cycle changed from
  one unique sampled RGB at `0` to 10–12 at `1`.
- Alpha: setting all three layers to `0.1` reduced mean canvas alpha from
  `20.51` to `11.12`, confirming proportional opacity.
- Full Bleed: remained on Point sizes; all three responsive previews retained
  one animated canvas each and zero lost contexts.
- Reduced motion: spatial frame delta fell from `1.848` to `0.885` over 700ms,
  while Color Cycle still produced 12 distinct sampled RGB values.
- Clean-session soak: `Full stack → Color Flow → Fix → Problem` ran for more
  than ten seconds with one stable snapped canvas, zero lost contexts, and no
  React/page errors.
- Production build: 119 modules, 418.84 kB JavaScript / 119.41 kB gzip.
- `git diff --check`: passed.
