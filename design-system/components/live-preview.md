---
sourcesHash: 6e5c390d442266fb289b9b0ebf709424f59e00580cc07afb3132b9536dd36d9d
id: live-preview
description: >-
  Show what a setting does with a small live canvas next to or inside its
  control, such as a template, palette, grain size, shape or warp feel in the
  Design Panel.
status: discoverable
sources:
  - src/lab/ui/LivePreview.tsx
---

# Live preview

## When to use

- Inside a pickable tile (a `card` button with `aria-pressed`) so the option
  shows its result, not only a name.
- As a strip above a `Segmented` or `SliderRow` to show the current value at
  real size.
- As a thumbnail at the end of a Recipe step row, showing the hero after that
  step (`src/lab/layerSketch.ts` `drawStep`, built on `drawField`).

## When not to use

- For the hero itself or anything that must match the shader exactly: previews
  are 2D sketches (`src/heroes/dither/panelSketch.ts`,
  `src/lab/layerSketch.ts`), not the renderer.
- As a control: the canvas is decorative (`aria-hidden`, `pointer-events-none`);
  the surrounding button carries the label and the state.

## Public API

| Prop | Meaning |
| --- | --- |
| `draw(ctx, t, w, h, dpr)` | Paints one frame; `w`/`h` are device pixels, `t` is this preview's clock in seconds |
| `rate` | Clock speed; `0` shows a still frame (default `1`) |
| `className` | Size and shape (width, height or aspect, radius, border) |

## Behaviour and states

All previews share one `requestAnimationFrame` loop. A preview advances only
while it is on screen (IntersectionObserver), so a closed or scrolled-away panel
costs nothing; the loop stops when no visible preview animates. Previews redraw
at 30 fps at most, so they leave the frame to the hero on 60 and 120 Hz screens.
Each preview is a
2D canvas; it never creates a WebGL context. It redraws on every render, so a
paused preview still follows the settings.

## Accessibility

Decorative: `aria-hidden`, no pointer events, no selection. With
`prefers-reduced-motion: reduce` every preview shows a still frame, and the loop follows a live change of that setting.
