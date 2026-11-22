---
sourcesHash: e4391f806327d8bb2be1036a9b1c7ecf6b3af3d0eef49083866a9024b801fff2
id: toggle
description: >-
  Turn one independent setting on or off, such as play/pause, uppercase
  buttons or a debug overlay. The change applies immediately.
status: discoverable
sources:
  - src/lab/ui/Toggle.tsx
  - src/index.css
---

# Toggle

## When to use

- One on/off setting that combines freely with the others.
- With its visible label row (default) in a settings group; `inline` as the
  single trailing action of a `SectionLabel` (for example Play / Paused).

## When not to use

- A choice between named options: use `Segmented`, even for two options.
- An action (Reset, Copy config): use a button. A toggle always reflects state.
- A large selectable card (the Layers stack steps): that is its own control.

## Public API

| Prop | Meaning |
| --- | --- |
| `label` | Visible label, and the button's accessible name when the text is only state |
| `on` | Current state |
| `onChange(on)` | Called with the next state |
| `inline` | Drop the label row; the label names the button |
| `children` | Replaces the On/Off text (for example Playing / Paused) |

## Behaviour and states

Off: `lab-fill`, `lab-border`, `lab-fg-subtle` text; hover raises to
`lab-fill-hover` and `lab-fg-muted`. On: the `lab-accent` tint (border 40 %, fill
15 %, accent text) — "on" is the one meaning the accent carries.

## Accessibility

A native button with `aria-pressed`. Enter/Space toggles; focus shows the
`lab-focus` ring. At least 24 × 36 px (`min-h-6 min-w-9`).
