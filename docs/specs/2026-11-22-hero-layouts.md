# Hero layouts: Centered and Wild type

**Date:** 2026-11-22
**Status:** approved 2026-11-22 (all recommended answers taken), implemented on `claude/interesting-feistel-363566`.
**Measured at:** `34062d4` (branch `claude/interesting-feistel-363566`, from `perf/single-pass-shader`).
**Scope:** `src/heroes/dither/` (store, hero, tile field, panel), `src/lab/TemplateGallery.tsx`
posters, DESIGN.md, GLOSSARY.md.

## Problem

Every hero today has one composition: the copy block sits at the bottom, a big
headline on the left and the response line, sub and CTA on the right (the
`problem` copy layout). The shader fills the area above the copy, or the whole
hero with clearance around each text line (`edge.mode: 'full'`).

The user asked for two more compositions, each made from the shaders and
playing live:

1. **Centered.** Headline and CTA in the centre, fewer parts (no response line,
   no right column). The shader field sits around the text block.
2. **Wild type.** Big, heavy display type. The shader plays *inside* the
   letterforms. It must work for every renderer: the Paper dither stack, the
   GPU tile field (Point sizes and snapped colour) and Fine Grain (no grid).

## How it works today

```
DitherState ─▶ DitherHero
   copyVariant ─▶ copy.layout ('problem' | 'solution')  ─▶ copy block JSX
   pixelGrid + animation.tileDisplay ─▶ renderer choice (DitherHero.tsx:502)
   edge.mode ('dissolve' | 'full') + textRectMode ─▶ where tiles stop
```

- **Copy layout.** `CopyLayout` is `"problem" | "solution"`
  (`ditherStore.ts:35`). Every copy variant uses `problem`; `grep '"solution"'`
  finds only the type definition, but the hero still has a `solution` branch
  (headline left, sub + CTA right). The layout belongs to the copy variant, not
  to the template or the panel.
- **Renderer choice** (`DitherHero.tsx:502-509`):
  - grid off → Paper stack: one `<Dithering>` WebGL context per visible layer,
    screen-blended (`paperLayers`, `DitherHero.tsx:1413`), plus a hover stack.
  - grid on, points or snapped colour → GPU tile field: one WebGL2 context,
    two passes (`tileField.ts`, ADR 0001).
  - grid on, colour, snap off → Paper stack under a CSS tile mask.
- **How the shader avoids text.** The hero measures the copy block
  (`DitherHero.tsx:798-842`). In `full` edge mode it collects one rect per
  rendered line (`textRectMode: 'lines'`) or per element (`'box'`); CTAs and
  bubbles always give their box. The GPU field gets up to `MAX_RECTS = 48`
  rects in `u_rects` and clears whole tiles inside `rect + fullPadding`, with a
  dissolving rim (`clearance()`, `tileField.ts:164`). `full` works only on the
  GPU field. On the Paper paths the shader stops at `contentTop`, and a solid
  `colorBack` panel covers everything below it (`DitherHero.tsx:1472`).
- **Fit and lock.** `useHeadlineFit` steps the headline down until it sets in
  3 lines (4 below 1024px). The baseline lock runs only for `problem`.
- **Canvas view** shows one live template and WebP posters for the others
  (`TemplateGallery.tsx:57`). **Breakpoints** runs real iframes, each with its
  own contexts.

## Constraints

- 60 fps is a hard requirement. The GPU field must stay at 2 passes per frame,
  and no per-frame work may move to the main thread (ADR 0001: the 2D-canvas
  field cost ~895 ms/s on hover).
- WebGL contexts: the GPU field uses 1. The Paper stack uses one per layer. The
  perf strip turns amber above 8. A new layout must add **no** context.
- No per-frame `mask-image` swaps or `toBlob` calls. A mask may change only on
  layout change: resize, font load, copy or type-pair change.
- Real DOM text stays the source of truth for screen readers, selection, the
  fit rule and the measured rects.
- Lab UI follows DESIGN.md: tokens only, `Segmented` for a few options,
  24 × 24 px hit areas, `lab-focus` rings.

## Layout 1: Centered

Copy: headline, optional sub, one CTA, centred on both axes. No response line,
no right column, no baseline lock. The shader fills the hero and keeps clear of
the copy block.

### Options

| | How | Renderers | Cost | Tradeoffs |
| --- | --- | --- | --- | --- |
| **A. Halo** | One clear zone around the whole copy block. GPU field: the block's box goes in `u_rects` as one rect, with a larger padding and the existing dissolve rim. Paper stack: a static CSS `mask-image` (radial or rounded-rect gradient) on the shader container, made once per resize. | All | GPU: 1 rect, cheaper than today's per-line rects. Paper: one static mask, composited. | Simple, reuses `clearance()`. On the Paper tile-mask path a soft gradient cuts tiles; it needs a whole-tile mask (the dissolve mask builder already makes one). |
| **B. Hug lines** | Today's `full` edge with `textRectMode: 'lines'`, centred copy. | GPU field only | Same as today. | Busy: tiles creep into every line gap. Fine Grain and Problem cannot use it. |
| **C. Frame** | The field lives only in a band near the hero edges (ring or top/bottom bands); the centre stays plain. GPU field: a new edge term in the tile pass. Paper: static CSS mask. | All | Same as A. | Calmer, more "poster"; less of the shader is seen. |

### Recommended: A (Halo)

Halo works on all three renderers, adds no pass and no context, and reuses the
clearance maths. Two knobs: halo size (padding) and halo shape (box or ellipse).
On the GPU field, a point-size falloff toward the halo (dots shrink near the
text) can come later as a feel of the same option.

## Layout 2: Wild type

Copy: a short display headline in a heavy face, set very large (fits the hero
width, 2–4 lines). The live shader is the fill of the letters. Sub and CTA stay
solid, small, below the headline. Outside the letters: plain `colorBack`
(an open question allows a dim field).

### Options

| | How | Renderers | Cost per frame | Tradeoffs |
| --- | --- | --- | --- | --- |
| **A. `background-clip: text`** | Clip a background to the glyphs. | None live | — | Rejected. It clips a CSS background image, not a WebGL canvas. `element()` is Firefox-only. |
| **B. Inline SVG `<clipPath><text>`** | Real `<text>` in an inline SVG, used as `clip-path: url(#id)` on the shader container. | Paper, GPU (both are DOM canvases) | Unknown: an SVG clip on an animated canvas can force a repaint of the clip every frame, and Safari handles `url()` clips on HTML badly. | Uses page fonts, no raster. Text layout in SVG has no wrapping, so line breaks must be computed by hand and can drift from the DOM `h1`. |
| **C. Text-alpha bitmap (one mask, two consumers)** | After fonts load, draw the headline lines into an offscreen 2D canvas as white-on-transparent, at the positions measured from the DOM `h1` (one rect per line, as today). The GPU field uploads it once as an R8 texture; the pixel pass multiplies coverage by it. The Paper stack (and its hover stack) gets the same bitmap once as a static `mask-image` (blob URL). The DOM `h1` stays, with a transparent fill. | All | GPU: one texture fetch per pixel, upload only on layout change (~1.3 MB at 1440 × 900, under 1 ms). Paper: one static, composited mask. | One code path for all renderers. Risk: canvas `fillText` must match the DOM glyphs (font, weight, tracking via `ctx.letterSpacing`, kerning). The DOM text is invisible, so a small drift shows only in the selection highlight. |
| **D. Blend sandwich** | Inside an `isolation: isolate` group: shader, then the DOM `h1` in white on black with `mix-blend-mode: multiply`. Shader shows only inside the letters. | All | A composited blend over a moving canvas each frame; nested blends can fall off the GPU path in Safari. | Zero raster, real text, exact glyphs. Outside the letters becomes pure black, so it breaks any `colorBack` that is not black, and it stacks a second blend on the Paper screen-blend layers. |

### Recommended: C (text-alpha bitmap)

C is the only option that works the same on all three renderers with a known,
small per-frame cost and no new context. B and D are worth one perf
measurement each as a fallback if glyph matching in C fails.

GPU field detail: the mask can apply per pixel (crisp letter edges that cut
tiles) or per tile (sample at the tile centre in the tile pass: whole tiles
only, a chunky pixel-font look). Offer both as one **Letter edge** choice
(Crisp / Tiles). The warp keeps working: it is computed before the mask, so the
cursor reveals the other state inside the letters.

Readability floor: a dither fill has holes, so a letter can fade out when the
field is sparse. Under the shader, inside the letters, draw a flat tint of the
first layer colour at low opacity. The letter then always reads as a shape.

## Panel UI

A new group **Layout**, directly under **Start from**, as a `Segmented` with
three options:

```
Start from   [ template tiles ]
Layout       [ Split | Centered | Wild type ]   ← new
At rest  ·  Palette  ·  Grid  ·  Shape  ·  Speed  ·  Hover · warp  ·  Copy …
```

- "Split" is today's composition (headline left, response + CTA right).
- When Layout is Centered: a **Halo** row (size, shape).
- When Layout is Wild type: a **Letter edge** row (Crisp / Tiles) on the GPU
  field only, and the Type pair list shows heavy display faces already loaded
  in `index.html` (Dela Gothic One, Special Gothic Expanded One, Anybody 900,
  Syne 800, Bricolage 800).
- Each Layout option gets a `LivePreview` mini-hero in `panelSketch.ts`, like
  the template tiles.

Store: a new hero-level key (proposed `composition: 'split' | 'centered' |
'wild'`), not the copy variant's `CopyLayout`, so any template and any copy can
take any layout. `DitherLayoutConfig` keeps its name and its column settings.
The unused `solution` copy layout can be removed in the same change.
GLOSSARY.md gets **Composition**, **Halo** and **Letter fill**.

Templates: add one hero template per new layout (for example "Center Stage",
"Wild Type") so the Canvas view shows them, with their own posters.

## Scope

- Store key, the two layouts in `DitherHero.tsx`, halo and letter mask in
  `tileField.ts`, the static masks for the Paper paths.
- Panel group, previews, 2 templates, posters, DESIGN.md and GLOSSARY.md entries.
- Perf check on all three renderers at 1440 and 390 px: FPS, worst frame, GPU
  time, WebGL count from the perf strip.

## Non-goals

- Free placement of text (drag, left/right/top variants of Centered).
- Sub or CTA drawn with the shader. Only the headline is a letter fill.
- New shader looks, new fonts, a light theme.
- Keeping Design Panel edits across a Recipe visit (separate open question).

## Risks

**Responsive (tablet, mobile).**
- Centered: the halo must grow with the wrapped copy; at 390 px the halo can
  cover most of the hero, so the field reads only above and below. The
  measured box already follows resize.
- Wild type: the letter stroke must hold several tiles. At a 24 px pitch a
  heavy 240 px headline has ~50 px stems, about 2 tiles; on mobile it is less
  than 1. Wild type needs a fine grid (8–12 px) below tablet, or the Tiles
  letter edge turns words into noise. The mask is rebuilt on resize (debounced,
  like today's rect measuring) and in every Breakpoints iframe.
- `useHeadlineFit` targets 3 lines for long copy. Wild type needs a fit-to-width
  rule for short words instead.

**Accessibility of text inside a shader.**
- Contrast: the letter fill moves and has holes, so no single contrast ratio
  holds. The flat tint floor keeps the letter shape; the sub and CTA stay solid
  and keep normal contrast. Check the tint against `colorBack` at 3:1 (large
  text, WCAG 1.4.3).
- Readable fallback: the DOM `h1` stays real text. If WebGL2 fails, or under
  `forced-colors: active` or `prefers-reduced-transparency`, the `h1` shows a
  solid fill instead of the mask.
- Reduced motion: the hero already cuts spatial motion to 0.15 × under
  `prefers-reduced-motion`. For Wild type, pause the fill entirely, because
  motion inside letters is read as text that moves.

**CTA hit area.** In both layouts the CTA stays a DOM link above the shader
(`z-10`), never part of the mask, at least 44 px tall (it is ~48 px today). In
Centered its box joins the halo, so no tile sits under it. The hover warp must
not cover it: the warp tooltip is `z-40`, so it needs a check near the CTA.

**Perf.** Paper path: a static `mask-image` on a container of 2–4 animated
canvases. Chromium composites this; Safari may not. Measure before committing
to C on the Paper path.

## Decisions (2026-11-22, grilling round)

The user accepted every recommended answer:

1. Rebased onto `perf/single-pass-shader` (`bd7d9c7`) before building.
2. Layout is a store axis, `composition: { mode, halo, letterEdge }`, and
   templates can set it. Glossary: **Composition**, **Halo**, **Letter fill**.
3. Wild type works on all three renderers from one text-alpha canvas.
4. Centered shows headline, sub and one CTA. No response line, no baseline lock.
5. Copy variants get an optional `shortHeadline`; Wild type falls back to `headline`.
6. Outside the letters: plain `colorBack`.
7. Letter edge on the GPU field: Crisp (default) or Whole tiles. Paper is Crisp.
8. The warp works inside the letters. Reduced motion pauses the Wild type field.
9. Panel names: Layout → Split / Centered / Wild type. The unused `solution`
   copy layout is removed (`CopyLayout` and `DitherCopy.layout` are gone).
10. Two templates, **Center Stage** and **Wild Type**, with baked posters.

## As built

- Halo shape is not a knob. The GPU field and the Paper tile-grid path clear a
  box (whole tiles); the Paper no-grid path (Fine Grain) clears a soft ellipse.
  The only knob is Halo size: Tight (24 px) or Wide (72 px), `haloPad`.
- Letter mask: `buildLetterMask` draws each glyph at the position the DOM
  measured for it, so tracking and kerning cannot drift. GPU: R8 texture,
  premultiplied on upload so the red channel is coverage. Paper: a data: URL
  mask on the shader container and on the hover stack (a static wrapper,
  because the reveal layer rewrites its own mask on every hover step).
- Two heavy type pairs, **Heavy** (Anybody 900) and **Poster** (Dela Gothic
  One). Wild Type uses Heavy.
- `useDisplayFit`: largest size where no word breaks, ≤ 3 lines and ≤ 60 % of
  the hero height.
- Letter tint floor: the DOM `h1` at 22 % of the first layer colour, drawn over
  the field. Solid colour when the GPU field fails. `forced-colors` overrides it.

## Measured

Headless Chrome 157, ANGLE Metal (Apple M4 Pro), 1440 × 900 at DPR 2, Live
view, 3 s idle and 3 s with a hover sweep (script in the session scratchpad):

| Template | Layout | Idle fps / worst frame | Hover fps / worst frame |
| --- | --- | --- | --- |
| Full Bleed | Split | 60 / 16.8 ms | 60 / 16.8 ms |
| Center Stage | Centered | 60 / 16.8 ms | 60 / 16.8 ms |
| Wild Type | Wild type | 60 / 16.8 ms | 60 / 16.8 ms |
| Fine Grain | Split, Centered, Wild type | 60 / 16.8 ms each | 60 / 16.8 ms each |
| Problem | Split, Centered, Wild type | 60 / 16.8 ms each | 60 / 16.8 ms each |

No new WebGL context: the letter mask is one more texture on the existing GPU
field, and a CSS mask layer on the Paper paths. Not measured: Safari, Firefox,
a phone, or a low-end GPU.

Contrast of the tint floor alone against `#0A1714` (sRGB mix): 1.6:1 on the fix
green, 1.2:1 on the problem pink. It fails the 3:1 target; the full dots pass
(9.7:1 green, 4.4:1 pink). Letter legibility rests on the dots, not the tint.
Open: raise the tint (it washes out the field) or accept it for display text.

## 2026-11-22 outcome

- **Wild type dropped** as a failed experiment. The letter fill read as noise
  more than as type, and it needed its own type pairs, short headlines and a
  second fit routine. Removed: the `'wild'` composition, the letter mask
  (GPU texture and Paper CSS mask), the Letter edge control, the Wild Type and
  Center Stage templates with their posters, the Heavy and Poster type pairs,
  `shortHeadline` and `useDisplayFit`.
- **Centered is a layout option only**, on top of any template (Layout:
  Split / Centered). "Start from" keeps Full Bleed, Problem and Fine Grain.
- **Centered hugs the lines.** The halo box is gone. Centered is the 'full'
  edge on centred copy: the field fills the hero and clears each text line
  (headline lines, sub lines, CTA box) by `edge.fullPadding`, with a rim of
  `dissolveDepth` rows. Picking Centered sets Full Bleed's values (8px, 2 rows,
  Lively rim); Split puts back the template's own. The GPU field uses its
  `clearance()`; the Paper paths get a static SVG mask from the same measured
  rects (`buildClearanceMask`: whole tiles with a seeded rim on the tile grid,
  rounded blurred holes on grid-off Fine Grain; no rim motion on Paper).
- **Controls:** the Layout group shows Clearance (Hug 4 / Tight 8 / Snug 16
  px), Rim (Crisp 1 / Soft 2 / Feathered 4 rows), Rim motion (Still / Calm /
  Lively, GPU field only) and Clear round (Each line / Each block), with a
  live preview of the field round centred copy. They replace the Halo control.
- **Liveliness:** on Point sizes, Centered raises Size contrast to 0.7 when it
  is 0. Paper templates have no per-tile size, so the lever does not apply
  there.
- **Measured** (smoke, 1440 × 900, paused, copy hidden): field on the text
  lines 0.00 % on all three templates; field in the band just past the
  clearance vs far away: Full Bleed 9.28 % vs 9.63 %, Problem 9.40 % vs
  17.03 %, Fine Grain 48.45 % vs 83.16 %.
