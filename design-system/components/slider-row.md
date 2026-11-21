---
sourcesHash: a7dfc81ff07d142d705306fcf0cb44f1fc56f2cf5ca6c0582a79b1f35aef917f
id: slider-row
description: >-
  Set one continuous numeric setting within a fixed range and see its current
  value, such as speed, scale or gap in the Design Panel.
status: discoverable
sources:
  - src/lab/ui/SliderRow.tsx
  - src/index.css
---

# Slider row

## When to use

- A number where dragging and watching the hero change is the point.
- The range is bounded and known (`min`, `max`, `step`).

## When not to use

- A few named values: use [Segmented](segmented.md).
- An exact value the user types (pixel offsets read from a design): use a number input.

## Public API

| Prop | Meaning |
| --- | --- |
| `label` | Visible name, also the input's accessible name |
| `value`, `min`, `max`, `step` | Native range values |
| `suffix` | Unit shown after the value (`px`, `°`, `%`) |
| `onChange(value)` | Called with the parsed number on every input event |
| `className` | Spacing from the surrounding layout only |

## Behaviour and states

The label is `text-lab-xs` `lab-fg-muted`; the value is `lab-fg-subtle`, monospace,
tabular figures, so it does not jitter while dragging. The track and thumb come from
the `input.lab-range` styles in `src/index.css`.

## Accessibility

A `<label for>` names the range input and an `<output for>` shows its value, so a
screen reader announces "Speed, slider, 0.12". Arrow keys change the value by `step`.
Focus shows the `lab-focus` ring.
