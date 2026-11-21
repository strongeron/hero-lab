---
sourcesHash: d26ada8f876e323f62e33339cdb8f492ae3b0ad5d33fef077f3a8d5ffd6e033f
id: lab-toolbar-title
description: >-
  Identify the current lab view at the start of its toolbar: the Hero Lab mark,
  the view name and a one-line explanation, with the mark linking home.
status: discoverable
sources:
  - src/lab/LabToolbarTitle.tsx
  - src/components/BrandMark.tsx
---

# Lab toolbar title

## When to use

- First element of every lab view toolbar (Templates, Breakpoints, Layers).

## When not to use

- Inside the hero or the Design Panel; those are not lab views.

## Public API

| Prop | Meaning |
| --- | --- |
| `view` | View name, e.g. "Layers" |
| `strap` | One-line explanation; hidden below `lg` and truncated, never wrapped |
| `onHome` | Go to Templates; omit on Templates itself |

## Behaviour and states

The strap is context, not navigation, so it is the first thing to go when space is
short. The row never wraps.

## Accessibility

The mark is a button named "Hero Lab — go to Templates" when `onHome` is set,
otherwise decorative. View name text is `lab-fg-muted`, strap `lab-fg-subtle`.
