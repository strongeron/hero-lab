# Layers previews and Design Panel alignment

**Date:** 2026-11-22
**Scope:** `src/lab/LayerExplorer.tsx`, a new `src/lab/layerSketch.ts`, DESIGN.md.
`src/heroes/dither/` and `src/lab/ui/LivePreview.tsx` stay unchanged.

## Problem

The Design Panel shows a small live picture for every pick (`LivePreview` +
`panelSketch.drawField`). The Layers view shows only text for each step, so a
person must click a step and watch the big hero to learn what the step adds. The
two views also use different words and controls for the same settings.

## Does layer state affect the Design Panel?

The two views share one store (`useDitherStore`), but they never run at the same
time, and Layers rewrites the store on entry and on exit.

- `src/lab/HeroLab.tsx:259`: `showPanel = panelOpen && viewMode !== 'layers'`.
  The Design Panel is not mounted in Layers. The Design button is disabled there
  (`HeroLab.tsx:406`).
- Entering Layers: `LayerExplorer.tsx:186` calls `applyHeroTemplate(activeTemplate)`.
  That rebuilds the state from the template (`ditherStore.ts:1555-1593`), with
  `palette: "signal"` and `typePair: null` (`ditherStore.ts:1585-1586`). Panel
  picks (palette, grain, gap, shapes, speed, warp feel, copy, type pair, button)
  are dropped. Only `activeTemplate`, the guide toggles and `edge.topInset` carry
  over.
- Leaving Layers: `LayerExplorer.tsx:210-211` clears `stableColorField` and calls
  `applyHeroTemplate(restoreId)` again. The Design Panel then shows the template
  as authored, not the Layers steps and not the Panel picks from before.
- The one Layers choice that reaches the Panel is the template: picking another
  template in Layers sets `restoreId` (`LayerExplorer.tsx:188`), so the Panel
  opens on that template.

So: coupled through the store, isolated in time, and Layers is lossy for Panel
edits. Keeping Panel edits across a visit to Layers is a product decision (see
Open questions); this change does not alter it.

## Plan: one preview per step

Each step row gets a `LivePreview` that shows the hero **after** that step: the
stack from step 0 to this step, with the template's own values. The rows read
top to bottom as a filmstrip of the final image. A preview is a 2D sketch of a
1440 × 900 hero, scaled to the thumbnail, with the copy drawn as two white bars
(the same mark the Panel's template tiles use). At true scale a 24px tile is
1.5 CSS px wide, so the thumbnail zooms in (up to 3×) until one tile is 4 CSS px;
every step of a template uses the same zoom, so frames stay comparable.

| Step | Preview shows |
| --- | --- |
| 0 Scene motion | Bare field: free dots at the bare size, default edge (field ends at 62 % with a dissolve band), copy bars. Runs at the hero's speed. |
| Tile grid | The free dither under the tile mask: gaps and corner radius cut in. |
| Snapped colour | One flat colour per tile. |
| Point sizes | Round dots that grow and shrink with the dither (spread from the template). |
| Full edge | Field fills the hero; clearance boxes around each copy line (or the block). |
| Hover · warp | The template's warp feel under a looping pointer, revealing the other state's layers. |

The template picker becomes preview tiles (like the Panel's "Start from"), each
drawing its template's full stack from real values.

Cost: 2D canvases only, all on `LivePreview`'s shared loop (paused off screen,
still under reduced motion). No WebGL. New sketch code (`drawStep`,
`drawPoints`, `stepLook`) lives in `src/lab/layerSketch.ts`; it calls
`drawField` and `SHAPE_FN` as they are.

## Mismatches to fix (in Layers)

| Setting | Design Panel | Layers before | Layers after |
| --- | --- | --- | --- |
| Speed | `Segmented` Still / Calm / Live / Wild, writes `animation.speed` | `Segmented` 0.5× / 1× / 2×, rewrites every scene rate (`setSceneMotion`) | Panel's stops, labels and field; the rate rewrite is removed |
| Template | "Start from" preview tiles | text `Segmented` | "Start from" preview tiles |
| Grid size | "Grain" Fine / Medium / Coarse / Chunky, gap No gap / Tight / Open | "96px tile ÷ 4 · gap 6 · radius 40" | "Coarse grain · Tight gap — 24px tiles, 6px gap, 40px radius" |
| Grid name | (Grain) | "Pixel grid" (GLOSSARY: avoid) | "Tile grid" |
| Snap | (hidden) | "Snap to grid" | "Snapped colour" (GLOSSARY: Tile display) |
| Edge | (template-owned) | "Scene behind text" | "Full edge" with "clearance" (GLOSSARY) |
| Hover | "Hover · warp", feels Crisp / Soft / Twist / Bubble, "hover reveals fix" | "Hover reveal", "reveals the fix (green)" | "Hover · warp", "Bubble warp · 100px · hover reveals fix" |

## Non-goals

- No change to the store, `DitherPanel.tsx`, `panelSketch.ts` or `LivePreview.tsx`.
- No change to what a step writes to the store, except the speed control.
- Previews do not show scene pan or spin; the big live hero does.

## Open questions

1. Should Layers take apart the Panel's current look (palette, grain, shapes)
   instead of the template as authored, and give it back on exit? This needs a
   store action that restores a whole snapshot.
2. The Panel says "pieces" (Grain value) where GLOSSARY and Layers say "tiles".
3. The pick-tile class string (`card`) now exists in DitherPanel and Layers; a
   shared part would remove the copy.
