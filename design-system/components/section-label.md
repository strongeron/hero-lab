---
sourcesHash: 41fb8d5b7191ca12d887559e4152fe3003ad497c4cd62de310d2b2d06677fb88
id: section-label
description: >-
  Open a group of related settings in a panel or toolbar column with a short
  uppercase heading, optionally with one small trailing action.
status: discoverable
sources:
  - src/lab/ui/SectionLabel.tsx
---

# Section label

## When to use

- At the top of each settings group in the Design Panel, and above step lists such
  as the Recipe stack.

## When not to use

- Inline field labels: [Slider row](slider-row.md) and form labels name their own input.
- Page or view titles: use [Lab toolbar title](lab-toolbar-title.md).

## Public API

| Prop | Meaning |
| --- | --- |
| `children` | Heading text, short (one to three words) |
| `level` | Heading level `2`, `3` (default) or `4`, by nesting in the outline |
| `action` | Optional trailing control, such as a small Reset button |

## Accessibility

Renders a real `h2`–`h4`, so screen-reader users can jump between settings groups.
Text is `text-lab-2xs`, uppercase, `lab-fg-subtle` (5.4:1).
