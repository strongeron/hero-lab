---
sourcesHash: caa9fe63f4009431d032388c30e913caef1a47919b929bff4f5b67120768d470
id: lab-toolbar-title
description: >-
  Identify the current lab view at the start of its toolbar: the Hero Lab mark
  (24px), the product name and the view name, with the mark linking home.
status: discoverable
sources:
  - src/lab/LabToolbarTitle.tsx
  - src/components/BrandMark.tsx
---

# Lab toolbar title

## When to use

- First element of every lab view toolbar (Canvas, Breakpoints, Recipe).

## When not to use

- Inside the hero or the Design Panel; those are not lab views.

## Public API

| Prop | Meaning |
| --- | --- |
| `view` | View name, e.g. "Recipe" |
| `onHome` | Go to Canvas; omit on Canvas itself |

## Behaviour and states

Mark, "Hero Lab", a subtle slash, then the view name. No explanatory strap: the
bottom bar already names the view (removed 2026-11-22). The row never wraps.

## Accessibility

The mark is a button named "Hero Lab — go to Canvas" when `onHome` is set,
otherwise decorative. View name text is `lab-fg-muted`; the slash is
`aria-hidden`.
