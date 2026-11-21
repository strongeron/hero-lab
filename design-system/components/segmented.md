---
sourcesHash: 1c918d91d451df10ef722dcbc26ae7d58eb98755ad70efb218ce7774e4553364
id: segmented
description: >-
  Choose exactly one of a few mutually exclusive options that are all shown
  at once, such as the lab view, zoom level, template or dither type. The
  selection applies immediately; there is no confirm step.
status: discoverable
sources:
  - src/lab/ui/Segmented.tsx
  - src/index.css
---

# Segmented

## When to use

- Two to about six options, each short (one or two words), all worth seeing at once.
- The choice takes effect at once and is easy to change back.
- `shape="pill"` for floating chrome (the bottom view bar). `shape="box"` in
  toolbars and panels (zoom, template picker, Design Panel option groups).

## When not to use

- More than about six options, or long labels: use a native `<select>`.
- Independent on/off settings that can combine: use separate toggle buttons.
- An action (Reset, Copy): use a button. Segmented always reflects state.

## Public API

| Prop | Meaning |
| --- | --- |
| `options` | `{ value, label, title?, disabled? }[]` in display order |
| `value` | Selected value, or `null` when none applies |
| `onChange(value)` | Called with the clicked option's value |
| `label` | Accessible name of the group (required) |
| `shape` | `'box'` (default) or `'pill'` |
| `size` | `'sm'` (12px, default) or `'xs'` (11px, dense panels) |
| `stretch` | Options share the full width |

## Behaviour and states

Idle options use `lab-fg-muted`; hover raises to `lab-fg` on `lab-fill-hover`;
the selected option uses `lab-fill-selected` and `lab-fg`. Disabled options sit at
40 % opacity and keep their `title` as the reason.

## Accessibility

A `role="group"` with the `label` as its name; each option is a native button with
`aria-pressed`. Keyboard: Tab moves between options, Enter/Space selects. Focus shows
the `lab-focus` ring. `pill` options are 30 px tall (measured); `box` options must stay at or
above the 24 px target minimum.
