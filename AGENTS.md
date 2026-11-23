# Agent instructions

- Design system: read [DESIGN.md](DESIGN.md) before changing lab UI (bottom bar,
  toolbars, Design Panel, Recipe, Templates, Breakpoints, perf strip). It is
  maintained with the `ai-design-system` skill; contracts live in `design-system/`.
- Hero: read [the hero copy block pattern](design-system/patterns/hero-copy-block.md)
  and the [Split](design-system/layouts/hero-split.md) /
  [Centered](design-system/layouts/hero-centered.md) layouts before changing the
  hero's copy, colours, alignment or clearance.
- Domain terms: [GLOSSARY.md](GLOSSARY.md). Decisions: [docs/adr/](docs/adr/).

## Before you change UI

1. Reuse a contracted part (`design-system/COMPONENTS.md`). Do not rebuild a
   Segmented, SliderRow, Toggle or SectionLabel from local class strings.
2. Use `lab-*` tokens in lab UI and `t-*` tokens in the hero. No raw hex,
   `rgba()`, `white/NN` or `text-[Npx]`. If you must, add a `ds-exception: <why>`
   comment on the same line or the line above.
3. Check the hero with the overlays: `?guides=1`, `?baselines=1`, `?boxes=1`.
   `window.__heroA11y()` returns the APCA contrast of every copy line.
4. Run `npm run check` (typecheck, build, token lint, contracts, smoke). It must
   pass before you report the work as done.
