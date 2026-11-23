---
sourcesHash: b19c1fc2ac208ff4c438ff1bc06a1fdcd04c890f3d9a47a638d2a316006fb69a
id: hero-split
description: |-
  The Split hero composition: the copy block sits at the bottom of the hero on
  a 12-column grid, with the headline and sub in a left column and the
  response line and CTA in a right column. The right column locks to the left
  one by baseline. Below the two-column breakpoint both columns stack. Split is
  the default composition (`composition.mode: 'split'`) and works on top of
  any template.
status: discoverable
sources:
  - src/heroes/dither/DitherHero.tsx
  - src/heroes/dither/ditherStore.ts
---

# Hero split

## When to use

- The hero shows the full copy block: headline, sub, response line and CTA
  (see [hero-copy-block](../patterns/hero-copy-block.md)).
- The field must stay above the copy. With the default `edge.mode: 'dissolve'`, the field
  ends in a dissolve band at `edge.position` and the copy sits on the plain background.
- The response line must read as an answer beside the headline, on the same baseline.

## When not to use

- The copy must sit in the middle of the hero with the field all round it: use
  [hero-centered](hero-centered.md).
- The hero has no response line and no sub, only a headline and a CTA. Split still renders,
  but the right column then holds only the CTA. Centered may read better. This is a
  recommendation; the code does not block it.

## Public API

The layout has no component props. The store sets it:

```ts
setComposition('split')
setLayoutConfig({ headlineCols: 8, responseCols: 4, gutter: 55, ctaAlign: 'first' })
```

| Input | Meaning | Default |
| --- | --- | --- |
| `composition.mode` | `'split'` selects this layout. Any value other than `'centered'` reads as Split. | `'split'` |
| `layout.headlineCols` | Headline column span out of 12, from `xl` up. | 8 |
| `layout.responseCols` | Response column span out of 12, from `xl` up. | 4 |
| `layout.gutter` | Column gap in px (`columnGap`), at every width. | 55 |
| `layout.ctaAlign` | Which sub line the CTA lines up with: `'first'`, `'middle'` or `'last'`. | `'first'` |
| `copy.tabletLayout` | `'columns'` starts the two columns at `md` (768px). `'stack'` starts them at `lg` (1024px). | `'columns'` |

`stackTablet` in `DitherHero.tsx` is `copy.tabletLayout === 'stack'`. A type pair can set it:
`terminal` forces `'stack'`.

`setComposition('split')` puts back the active template's authored edge values
(`fullPadding`, `textRectMode`, `dissolveDepth`, `textBlendMotion`, `textBlendSpeed`) and its
`tileSizeContrast`, after Centered changed them.

## Composition

### Required

- **Frame.** The copy box is `max-w-[1440px] mx-auto`, with `px-5 sm:px-8 xl:px-16` side padding
  and `pt-10 md:pt-8 pb-10 md:pb-20`. The guide overlay (`?guides=1`) reuses the same frame.
- **Bottom anchor.** The hero `section` is a `min-h-svh` flex column. The copy wrapper has
  `mt-auto`, so the copy sits at the bottom. The grid uses `items-end`, so both columns end on
  one line.
- **Grid.** The grid has 4 columns below the breakpoint and 12 columns from it
  (`md:grid-cols-12`, or `lg:grid-cols-12` when `stackTablet`).
- **Column spans.** The spans are CSS variables: `--hl-cols` and `--rsp-cols`.
  - From the breakpoint to below `xl`: headline 7, response 5 (fixed values).
  - From `xl` (1280px): `layout.headlineCols` and `layout.responseCols`.
  - The spans apply only while the grid has 12 columns.
- **Stacking.** Below the breakpoint both columns span all 4 columns. The response column
  follows the headline column with `mt-4`. The baseline lock is off: all nudges are 0.
  The lock uses the same media query as the grid (`(min-width: 1024px)` when `stackTablet`,
  else `(min-width: 768px)`).
- **Right column.** A flex column, `items-start justify-end`. The gap is `gap-4` on mobile.
  From `md` it is `gap-6` with `responsePin: 'cta'`, `gap-14` for a response of 30 characters
  or less, and `gap-8` for a longer response.
- **Response size cap.** `--rsp-cap` is `6vw` below the breakpoint, `9.7cqw` (of the right
  column) from the breakpoint, and none from `xl`.
- **Baseline lock.** The copy block owns the lock rules. See the Split baseline lock in
  [hero-copy-block](../patterns/hero-copy-block.md#composition).

### Recommendations

- Keep `headlineCols + responseCols` at 12 or less. The code does not clamp the sum.
- Use `tabletLayout: 'stack'` for monospace headlines, because a 7/12 tablet column breaks
  them into ragged lines.

### Exceptions

- With `edge.mode: 'full'`, the field also fills the hero in Split and clears each text
  line. The two columns do not overlap horizontally, so their clearance stays apart
  (`bridgeTextRects` only joins rects stacked one above the other).

## Accessibility

- The DOM order is headline, sub, response, CTA. The visual order matches it on mobile and
  on desktop.
- The baseline lock moves the response and CTA with `transform: translateY`. The DOM order
  and focus order do not change.
- The layout owns no contrast. The copy block owns it.
