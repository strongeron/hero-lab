---
sourcesHash: e2701e0b9e97b5611fdcbe2188fc09efa70221688c5f334185819e4878757715
id: hero-centered
description: |-
  The Centered hero composition: the headline, sub and CTA sit in one centred
  column in the middle of the hero. The dither field fills the whole hero (the
  'full' edge) and keeps a clearance round the text, with a rim that can move.
  The clearance traces each text line as one stepped shape ('lines') or each
  element box ('box'). Centered is a layout option on top of any template,
  never a template of its own (`composition.mode: 'centered'`).
status: discoverable
sources:
  - src/heroes/dither/DitherHero.tsx
  - src/heroes/dither/ditherStore.ts
  - src/heroes/dither/panelSketch.ts
---

# Hero centered

## When to use

- The copy is a headline, an optional sub and the CTA, read as one centred unit.
- The field must surround the copy on every side, not end above it.

## When not to use

- The hero must show the response line: Centered does not render `copy.response`.
  Use [hero-split](hero-split.md).
- The response must align to the headline baseline: only Split runs the baseline lock.

## Public API

The layout has no component props. The store sets it:

```ts
setComposition('centered')
setEdgeConfig({ fullPadding: 16, dissolveDepth: 4, textBlendMotion: 0.5, textRectMode: 'box' })
```

`setComposition('centered')` applies `centeredEdge`:

| Input | Meaning | Centered start value |
| --- | --- | --- |
| `edge.fullPadding` | Clearance in CSS px between the shapes and the text. | 8 |
| `edge.dissolveDepth` | Rim depth in tile rows. | 2 |
| `edge.textBlendMotion` | Rim motion strength, 0 = still, 1 = lively. | 1 |
| `edge.textBlendSpeed` | Rim motion speed in Hz. | 0.33 |
| `edge.textRectMode` | What the clearance traces: `'lines'` or `'box'`. | `'lines'` |

On a point field (`pixelGrid.enabled` and `animation.tileDisplay === 'points'`) with
`tileSizeContrast` at 0, Centered also sets `tileSizeContrast` to `CENTERED_SIZE_CONTRAST` (0.7).
`setComposition('split')` restores the template's own values.

The Design Panel offers these stops (`ditherStore.ts`):

| Control | Stops |
| --- | --- |
| Clearance (`clearanceStops` → `fullPadding`) | Hug 4, Tight 8, Snug 16 |
| Rim (`rimStops` → `dissolveDepth`) | Crisp 1, Soft 2, Feathered 4 |
| Rim motion (`rimMotionStops` → `textBlendMotion`) | Still 0, Calm 0.5, Lively 1 |

## Composition

### Required

- **Position.** The copy wrapper has `my-auto`, so the copy sits in the vertical middle of
  the `min-h-svh` hero. The column is `mx-auto flex max-w-[62rem] flex-col items-center text-center`.
- **Order and spacing.** Headline, then the sub (`mt-4 md:mt-6`, `max-w-[52ch]`, `text-balance`),
  then the CTA (`mt-8 md:mt-10`).
- **Full-field edge.** `fullField` is true, so the field fills the hero and the renderer
  receives `mode: 'full'`. The dissolve band is off (`dissolveOn` is false when centered).
- **Text rects.** The hero measures every `h1`, `p` and `a` in the copy:
  - `'lines'`: plain text gives one rect per rendered line, so the clearance hugs the glyphs.
  - `'box'`: each element gives one rect for its whole box.
  - In both modes, the CTA (`a`) and any text with its own background always give their
    element box, because the pill is the visual.
- **One stepped shape.** `bridgeTextRects` (`panelSketch.ts`) joins the rects. For each rect it
  finds the nearest rect below that overlaps it by at least 8px horizontally. If the gap is
  more than 0 and at most `BRIDGE_MAX_GAP` (96px), it adds a bridge rect over the gap, as
  wide as the overlap. In `'lines'` mode the result is one stepped shape that follows each
  line. In `'box'` mode the result is the element boxes joined into one blocky shape.
- **Rim.** On the Paper path, `buildClearanceMask` uses a rim of
  `max(paperCell, dissolveDepth × paperCell)`. That clearance mask is static. Rim motion
  (`textBlendMotion`) works on the GPU tile field only.
- **Readability.** The text sits under the scene (`textUnderScene`), so every copy element
  gets a `textShadow` in `shader.colorBack`.
- **Hover and roam.** The hover reveal and the roam box cover the whole hero, text included.

### Recommendations

- Start from the `centeredEdge` values (Tight clearance, Soft rim, Lively motion).
- Choose `'box'` for calmer, blocky negative space. Choose `'lines'` when the field should come
  close to the words.

### Exceptions

- None.

## Accessibility

- The DOM order is headline, sub, CTA. It matches the visual order.
- The copy block owns contrast (see [hero-copy-block](../patterns/hero-copy-block.md)).
  The sub stays in the headline colour; the smoke check
  `colour: in every palette the sub = h1 (Centered ...)` covers this.
- The readability shadow is a required part of this layout, because the field runs close to
  the text. The smoke check `layout: Centered on <template> clears each text line ...` fails
  when the headline has no `textShadow`.
- The same check also fails when field pixels land on a text line (more than 0.5 %), or when the
  field does not come close to the text.
