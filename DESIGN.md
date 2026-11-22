# Hero Lab design

Hero Lab has two kinds of interface. The **hero** is the product being designed:
the dither background, headline and CTA that a visitor of the demo site sees. The
**lab UI** is the tool around it: the bottom view bar, view toolbars, the Design
Panel, Recipe, Canvas, Breakpoints and the perf strip. This file governs the lab
UI. The hero keeps its own palette tokens (`--color-t-*`, `[data-palette]` in
`src/index.css`) and is out of scope here.

## Intent and shared rules

The lab UI is a dark, quiet instrument panel. It must never compete with the hero
for attention: low-contrast surfaces, one neutral selected state, colour only for
meaning (the emerald accent marks "editing" and "on"; `lab-danger` marks a
destructive action).

Required:

- **Tokens only.** Lab UI colour, surface, border, fill, shadow and font size come from the
  `lab-*` tokens below. No raw `white/NN`, `rgba(...)`, hex or `text-[Npx]` in lab
  UI code. A scoped exception needs a comment naming why.
- **Text contrast.** Text is `text-lab-fg`, `text-lab-fg-muted` or
  `text-lab-fg-subtle`. Nothing dimmer: `lab-fg-subtle` (0.5 white) is 5.4:1 on the
  lab canvas, the AA floor for small text.
- **Type floor.** `text-lab-2xs` (10px) only for uppercase section labels and
  badges. Labels, values and body text use `text-lab-xs` (11px) or larger.
- **One control per job.** A choice among a few options is `Segmented`. A numeric
  setting is `SliderRow`. An independent on/off setting is `Toggle`. A settings
  group opens with `SectionLabel`. More than about six options is a native
  `<select>`. Do not re-create these with local class strings.
- **Keyboard.** Every interactive element shows the `lab-focus` ring on
  `:focus-visible`, has an accessible name, and toggles expose `aria-pressed`.
- **Hit area.** Controls are at least 24×24 CSS px (WCAG 2.5.8).

Recommended: group related settings under one `SectionLabel`; prefer hiding rarely
used settings behind a disclosure over adding more rows.

## Design-system sources

- Components: [index](design-system/COMPONENTS.md)
- Layouts: [index](design-system/LAYOUTS.md)
- Patterns: [index](design-system/PATTERNS.md)
- Tokens: `@theme` block in [`src/index.css`](src/index.css), the `--color-lab-*`
  `--text-lab-*` and `--shadow-lab-*` entries, plus the `lab-focus` utility and the `input.lab-range`
  styles in the same file. Tailwind v4 turns them into `bg-lab-*`, `text-lab-*`,
  `border-lab-*`, `shadow-lab-*` utilities.

| Token | Role |
| --- | --- |
| `lab-canvas` | Page background of lab views (Canvas, Breakpoints, Recipe) |
| `lab-artboard` | Black behind each artboard, before the hero paints |
| `lab-toolbar` | Sticky view toolbar, translucent over the canvas |
| `lab-surface` | Floating chrome: bottom view bar, popovers |
| `lab-panel` | Docked Design Panel |
| `lab-fg` / `lab-fg-muted` / `lab-fg-subtle` | Primary, secondary, tertiary text (floor) |
| `lab-fill` / `lab-fill-hover` / `lab-fill-selected` | Control track, hover, selected option |
| `lab-border` / `lab-border-strong` | Hairlines; emphasised edge |
| `lab-focus` | Focus ring colour |
| `lab-accent` | "Editing" / "on" meaning only |
| `lab-danger` | Destructive actions only (Reset, Clear, Remove) |
| `lab-good` / `lab-warn` / `lab-poor` | Measured status only (perf strip ratings) |
| `text-lab-2xs` … `text-lab-md` | 10 / 11 / 12 / 13 px |
| `shadow-lab-float` | Floating chrome and chips: bottom view bar, toolbar pill, hover chip |
| `shadow-lab-raised` | Artboards on the canvas (Canvas, Breakpoints, Recipe) |

- Themes: the lab UI has one dark theme. Hero palettes do not apply to it.

## Contracts and public use

Component contracts live in `design-system/components/`, layouts in
`design-system/layouts/` and patterns in `design-system/patterns/`, each with its
uppercase index. Contract frontmatter owns id, description, status and paths.

Public imports: `src/lab/ui/Segmented.tsx`, `src/lab/ui/SliderRow.tsx`,
`src/lab/ui/SectionLabel.tsx`, `src/lab/ui/Toggle.tsx` (default exports) and
`src/lab/LabToolbarTitle.tsx`. Consumers: `src/lab/*` views and the Design Panel
(`src/components/playground/*`, `src/heroes/dither/DitherPanel.tsx`).
Component internals and business logic (store, handlers, effects) stay project-owned.

## Verification

- Types: `npm run typecheck`. Build: `npm run build`.
- Preview: `npm run dev -- --port 5174`, open `http://localhost:5174/hero-lab/`.
- Contract checks: `node ~/.claude/skills/ai-design-system/scripts/check-contract.mjs`
  and `generate-indexes.mjs --check .` from the repo root.
- Accessibility: WCAG 2.2 AA for the lab UI (contrast, focus visible, names,
  target size). Browsers: current Chromium, Safari, Firefox.
- Verification choice for the 2026-11-21 connection and polish: run.

## Gaps and decisions

No open gaps. Decisions taken 2026-11-21 with the user: connect the design system,
then align the lab chrome and the Design Panel on it. No Storybook in this repo.

2026-11-22, Design toggle: the bottom view bar only switches views. `DesignToggle`
(`src/lab/ui/DesignToggle.tsx`) opens the Design Panel from the right end of the
Canvas and Breakpoints toolbars, and from an edge tab in Live, which has no lab
toolbar. Recipe shows no toggle: the panel does not edit that view.

2026-11-22, view rename: the Layers view is now called **Recipe** ("how the hero
is made"). The internal mode id stays `layers`, and the code keeps the
`LayerExplorer` name. Older entries below say "Layers" for this view.

2026-11-21, panel cleanup: the Design Panel keeps only colour, size, speed, shape
and warp settings (the state map is in
`docs/architecture/2026-11-21-state-machines.md`). Added `Toggle` and
`lab-danger`. Scoped exception kept: the Layers verdict badges use Tailwind palette
colours because each colour carries one fixed meaning. (2026-11-22: the perf strip
ratings moved to `lab-good`, `lab-warn`, `lab-poor`, tokens for measured status
only.)

2026-11-22, opinionated panel: the Design Panel offers curated presets instead of
free values. Palette pairs (`palettes`), whole-pixel grain and gap stops
(`grainPitch`, `gapFor`), warp feels (`warpFeels`) and tested type pairs
(`typePairs`, laid over the copy by `resolveCopy`) live in `ditherStore.ts`. Picks
are tiles built from lab tokens (`aria-pressed` for the selected state). Shape
thumbnails are canvas sketches, not the shader.

2026-11-22, panel header: the "Why" switch and its per-section reasons are gone;
the previews show what a pick does. Shuffle, Copy and Reset sit in one track with
the `box` Segmented's track and item styles (`actionTrack`, `action` in
`DitherPanel.tsx`), without `aria-pressed`, because they are commands, not a
choice. Reset keeps `text-lab-danger`.

2026-11-22, panel previews: every Design Panel pick shows its result in a
`LivePreview` (new part, contract in `design-system/components/live-preview.md`)
drawn by `panelSketch.ts`: template mini-heroes, palette strips with a moving
reveal, a 1:1 grain strip, per-layer shape previews that run at the hero's speed,
and warp feels under a looping pointer. Shape is hidden on the GPU tile field
(points or snapped colour) because that renderer ignores layer shapes; the panel
says so. Prism and Aurora give each layer its own hue (the old multi-colour mode
stays removed).

2026-11-22, faithful previews: the Grid and Shape previews use `drawHero`
(`panelSketch.ts`), a port of Paper's Dithering shape maths in hero CSS px. They
show the hero's own tile pitch, gap, shape scale (new **Shape size** slider,
`shader.scale`) and shape clock (`shader.speed` × Speed), one dither cell per
tile, layers screen-blended. The Grid strip (was "Grain") draws whole tiles only,
at 1:1. Scene scan, drift and colour cycling are not drawn. Each preview caps at
~4000 cells.

2026-11-22, shared picks: `pickTile` (`src/lab/ui/pickTile.ts`) is the one class
string for a pickable preview tile in the Design Panel and Layers (padding at the
call site). `speedStops` / `speedStop` in `ditherStore.ts` are the one list of
Speed stops (Pause, Slow, Normal, Fast, Rapid). Layers restores the Design Panel look on
exit with `snapshotDitherState` / `restoreDitherState`.

2026-11-22, text inspector removed: click-to-inspect typography overrides are
gone (they drew under the Design Panel, out of view, and their `!important`
styles fought the hero's own type and the headline fit). Type is chosen with the
Design Panel's Type pair. `src/lab/DesignPanel.tsx` is the docked shell (header,
close, `DitherPanel` body); HeroLab owns its open state (`design-panel:open`).

2026-11-22, Layers previews (`docs/specs/2026-11-22-layers-previews.md`): every
Layers step row ends in a `LivePreview` thumbnail of the hero after that step,
drawn by `src/lab/layerSketch.ts` (`stepLook`, `drawStep`) on top of
`panelSketch.drawField`. Thumbnails zoom in (up to 3×) so one tile is at least
4 CSS px; all steps of a template share the zoom. The template picker uses the
Design Panel's "Start from" pick tiles. Layers speaks the Panel's words: Speed is
the same `Segmented` (Pause / Slow / Normal / Fast / Rapid on `animation.speed`), and steps
are named Tile grid, Snapped colour, Point sizes, Full edge and Hover · warp, with
the Panel's grain, gap and warp-feel names in their values. Open: the pick-tile
class string exists in both views; the Panel still says "pieces" for tiles.

2026-11-22, perf strip ratings: green / amber / red mean good / needs improvement /
poor. LCP, INP, CLS, FCP and TTFB use the web.dev field thresholds through
`web-vitals` (`m.rating`); these are not Lighthouse lab scores, which use other
curves and TBT instead of INP. Frame cells use the 60 Hz budget, so 120 Hz screens
stay green; blocked time and the WebGL count are lab rules. Each cell's `title`
names its bands and source.

2026-11-22, perf strip cells: the strip shows only what moves while you tune a
hero — FPS, worst frame, blocked, GPU, INP, CLS and WebGL. Median frame time sits
in the FPS tooltip. LCP, FCP and TTFB are measured once per load, and canvases,
heap and network do not change while tuning, so they sit in the "Perf" heading's
tooltip. GPU is the hero's two passes from `EXT_disjoint_timer_query_webgl2`
(`gpuTimer` in `tileField.ts`, queried only while the strip is shown; desktop
Chromium only, hidden elsewhere); green ≤ half the 60 Hz budget, amber ≤ the
budget. "rAF capped" shows when frames are even at about 30 fps: the browser caps
rAF (Low Power Mode, battery saver), and the page is not the cause.


2026-11-22, lab chrome colour and bar height: the chrome is a fixed neutral dark
in three OKLCH steps, `--color-lab-canvas` (L 0.145) < `-toolbar` / `-panel`
(L 0.175) < `-surface` (L 0.215), with a faint hint of the site's hue 178
(chroma ≤ 0.007). An earlier version bound the chrome to the hero `colorBack`;
that tinted the whole lab per palette (maroon, blue) and was reverted. The demo site
header, the lab view toolbars and the Design Panel header share one height,
`h-lab-bar` (56px since the 2026-11-22 trim; was 68px), so their bottom lines meet across the page. Lab toolbars carry no strap: mark (24px), "Hero Lab", a slash and the view name.

2026-11-22, monospace scale: a mono face reads ~15% larger than a proportional
one at the same px (fixed advance), so mono copy runs ~0.85× the sans sizes.
`ai` (Problem): headline `clamp(2.5rem, 4vw + 1rem, 4.5rem)`, response 28px, and
the new `subSize` / `ctaSize` copy fields at 15–17px and 14–16px (sans copies keep
17/20px and 16/18px). `broke-fixed` and the Terminal pair cap at 3.875rem with
-0.04em tracking. A type pair drops `subSize`/`ctaSize`, since its body face is
proportional. `html` sets `font-synthesis: none`.

2026-11-22, palette strips: each Palette pick draws the current look in its own
colours. Layer shapes move at the hero's pace (`rate = 0.35 × Speed`, still when
paused), and tiles follow the grid: dots for Point sizes, the grid's corner
radius otherwise, and the grid's gap share (`swatchTile` in `DitherPanel.tsx`).

2026-11-22, shape lift: Paper centres object shapes (ripple, swirl, sphere) on
the canvas centre, which banded layouts hide behind the copy panel, so a picked
ripple showed only its edge. `shapeLift` in `DitherHero.tsx` moves every Paper
layer up to the middle of the visible band (header inset to copy top); `edge`
mode `full` keeps the centre. Panel previews pass the same lift to `drawHero`
(`lift`, fixed at 24% of the height as a stand-in for the measured band).

2026-11-22, Prism vs Aurora: the two were near twins (warm trio at rest, a
teal-led cool trio on hover, the same `#2DD4A8` CTA). Prism is now RGB → CMY on
neutral black with its own violet accent (`cta: "#6D5BFF"`, white text); Aurora is
sunset → aurora on a night blue and keeps a mint CTA (`#3DFFB0`, dark text).

2026-11-22, point-size previews and Size contrast: on Point sizes the hero is the
GPU field, which ignores layer shapes and moves on its own clocks, while the
Grid and Palette previews drew Paper shapes on `shader.speed` — so preview and
hero disagreed on pattern and pace. `drawPointField` in `panelSketch.ts` ports
the tile pass (`fieldDot`: same hash, value-noise fbm, size, alpha and colour
maths), and those previews run it on the hero's clocks: field time at
`tileSizeSpeed × Speed`, colour phase at `colorCycleSpeed × Speed`. Not ported:
the scene drift pan (flow), so a preview may show a still crop where the hero
pans. New `animation.tileSizeContrast` (0–1, default 0, Point sizes only, slider
"Size contrast" in Grid): weights the travelling wave up, steepens the size
curve and lets the smallest dots vanish, so dots swing between specks and full
pieces. Problem's Paper tile path has no per-tile size, so the control does not
apply there.

2026-11-22, Recipe and the new parts: the Recipe stack gains a **Layout** step
(`Layout · Centered`, the Layout group's word) only when Centered was applied in
the Design Panel before Recipe opened; Centered is not part of any template, so
the target stays the template as authored and "Not used by this template" never
lists the Layout. Order: Tile grid, Snapped colour, Point sizes, Full edge,
Layout, Hover. Layout sits after Full edge because it lays its line-hugging
edge values over the edge below it, and `applyLevel` turns steps off top-down
before it turns steps on bottom-up, so Layout's Split restore runs before the
edge step resets. The Point sizes step also owns `tileSizeContrast` (shown in
its value, restored by the step, 0 below it), and "Template motion" keeps it
like `tileDisplay`. Step thumbnails (`src/lab/layerSketch.ts`) draw Point sizes
with `drawPointField` on the hero's clocks, draw the text clearance with
`drawClearance`, and lift the shape centre 24% on Split with the default edge,
as the hero's `shapeLift` does (`drawField` takes a `lift`). Leaving Recipe
still restores the Design Panel snapshot, composition and Size contrast
included.

2026-11-22, hero text colour rule (every palette and theme): the sub under the
title uses the title's colour (`sublineColor = headlineColor`), never an accent
tint. The response line and the CTA share one accent, `CTA_BG` from
`heroCtaColors`, so the line reads as the button's lead-in. Every palette's
`CTA_BG` is ≥ 4.29:1 on its background; the response is large text (≥ 28px, needs
3:1). Only `responseColorMode: 'white'` (no template uses it) opts out.

2026-11-22, warp band on gridded Paper: on the 'mask' hover path (Problem), the
warp answers only inside the tile band above the copy (`hoverBandRef`); below it
the warp shrinks as on leave, and the cover and reveal layers are clipped to the
band (`bandClip`). Grid-off templates (Fine Grain, 'cells' path) keep the reveal
over the copy on purpose; the GPU path draws its own warp.

2026-11-22, compositions (`docs/specs/2026-11-22-hero-layouts.md`): a **Layout**
group under "Start from" picks the composition: Split, Centered or Wild type, as
pick tiles with a `LivePreview` sketch (`drawComposition` in `DitherPanel.tsx`).
Centered adds a Halo `Segmented` (Tight / Wide). Wild type adds a Letter edge
`Segmented` (Crisp / Whole tiles) on the GPU tile field only, and a hint that
points to the heavy type pairs (Heavy, Poster). New templates: Center Stage and
Wild Type.

2026-11-22, Wild type removed, Centered reworked
(`docs/specs/2026-11-22-hero-layouts.md`, "2026-11-22 outcome"): Wild type was
a failed experiment and is gone, with its Letter edge control, the Heavy and
Poster type pairs, and the Center Stage and Wild Type templates; "Start from"
shows Full Bleed, Problem and Fine Grain. The Layout group is two pick tiles,
Split and Centered (`setComposition`), a layout option on top of any template.
Centered no longer clears a halo box: the field fills the hero and flows round
each text line, the 'full' edge on centred copy. With Centered picked the group
shows a `LivePreview` of the field round centred copy at a 2× crop (tiles,
clearance and rim to one scale; `drawPointField` with Size contrast on Point
sizes) and four `Segmented` preset rows from `ditherStore.ts`: Clearance
(`clearanceStops`: Hug 4 / Tight 8 / Snug 16 px), Rim (`rimStops`: Crisp /
Soft / Feathered = 1 / 2 / 4 rows), Rim motion (`rimMotionStops`, GPU tile
field only, because the Paper clearance mask is static) and Clear round (Each
line / Each block). They replace the Halo control. Picking Centered sets Full
Bleed's line-hugging values and, on Point sizes, Size contrast 0.7 when it is 0;
Split puts back the template's own values.


2026-11-22, warp mode (Roam): the "Hover · warp" group starts with a Warp mode
`Segmented`, Hover / Roam / Both (`hover.mode`, default Hover, so every template
keeps its look; `warpModeIds` / `warpModeLabel` in `ditherStore.ts`). Roam drives
one warp blob with no pointer: it drifts on a non-repeating path
(`roamPose` in `src/heroes/dither/roam.ts`, two incommensurate sines per axis),
its radius breathes round Size (about ±28%) and its shape morphs within the warp
feel (`morphShape`: rotate, round and scale; jitter stays). Both is Roam until the
pointer is over the hero; the blob eases onto the pointer and back onto the path,
with no jump. The blob stays in the visible field: under the header and above the
copy on Split, the whole hero on Centered and 'full'. One code path: the roam
clock writes the same `hoverAnim` state (px, py, radius) that the GPU tile field,
the Paper 'mask' path and the Paper 'cells' path already draw. The clock runs only
while playing (Pause and off-screen stop it), scales with Speed, and holds the
still pose (t = 0: right of and above the centre, full radius, no morph) under
reduced motion. The error-text tip names what the pointer touches, so the roaming
blob shows none (no per-frame commits). The 'mask' path keeps its encode cap
(`WARP_MASK_INTERVAL`); Roam on Problem measured ~46 encodes/s. The warp-feel
previews and the Recipe "Hover · warp" thumbnail draw the mode (`previewWarp` in
`panelSketch.ts`); the Recipe step's value names it. A renderer change now clears
the reveal layer's old clip and mask, because Roam keeps the reveal mounted
across a template switch.
