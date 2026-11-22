# Hero Lab design

Hero Lab has two kinds of interface. The **hero** is the product being designed:
the dither background, headline and CTA that a visitor of the demo site sees. The
**lab UI** is the tool around it: the bottom view bar, view toolbars, the Design
Panel, Layers, Templates, Breakpoints and the perf strip. This file governs the lab
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
| `lab-canvas` | Page background of lab views (Templates, Breakpoints, Layers) |
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
| `text-lab-2xs` … `text-lab-md` | 10 / 11 / 12 / 13 px |
| `shadow-lab-float` | Floating chrome and chips: bottom view bar, toolbar pill, hover chip |
| `shadow-lab-raised` | Artboards on the canvas (Templates, Breakpoints, Layers) |

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

2026-11-21, panel cleanup: the Design Panel keeps only colour, size, speed, shape
and warp settings (the state map is in
`docs/architecture/2026-11-21-state-machines.md`). Added `Toggle` and
`lab-danger`. Scoped exceptions kept: the Layers verdict badges and the perf strip
ratings use Tailwind palette colours because each colour carries one fixed meaning.

2026-11-22, opinionated panel: the Design Panel offers curated presets instead of
free values. Palette pairs (`palettes`), whole-pixel grain and gap stops
(`grainPitch`, `gapFor`), warp feels (`warpFeels`) and tested type pairs
(`typePairs`, laid over the copy by `resolveCopy`) live in `ditherStore.ts`. Picks
are tiles built from lab tokens (`aria-pressed` for the selected state); a "Why"
switch shows one reason per section. Shape thumbnails are canvas sketches, not
the shader.

2026-11-22, panel previews: every Design Panel pick shows its result in a
`LivePreview` (new part, contract in `design-system/components/live-preview.md`)
drawn by `panelSketch.ts`: template mini-heroes, palette strips with a moving
reveal, a 1:1 grain strip, per-layer shape previews that run at the hero's speed,
and warp feels under a looping pointer. Shape is hidden on the GPU tile field
(points or snapped colour) because that renderer ignores layer shapes; the panel
says so. Prism and Aurora give each layer its own hue (the old multi-colour mode
stays removed).

2026-11-22, Layers previews (`docs/specs/2026-11-22-layers-previews.md`): every
Layers step row ends in a `LivePreview` thumbnail of the hero after that step,
drawn by `src/lab/layerSketch.ts` (`stepLook`, `drawStep`) on top of
`panelSketch.drawField`. Thumbnails zoom in (up to 3×) so one tile is at least
4 CSS px; all steps of a template share the zoom. The template picker uses the
Design Panel's "Start from" pick tiles. Layers speaks the Panel's words: Speed is
the same `Segmented` (Still / Calm / Live / Wild on `animation.speed`), and steps
are named Tile grid, Snapped colour, Point sizes, Full edge and Hover · warp, with
the Panel's grain, gap and warp-feel names in their values. Open: the pick-tile
class string exists in both views; the Panel still says "pieces" for tiles.

