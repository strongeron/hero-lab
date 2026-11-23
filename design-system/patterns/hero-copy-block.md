---
sourcesHash: 53559598c6dda93f6a9567853ff25b4be550f2752a216208aea56af00a5553b8
id: hero-copy-block
description: |-
  The hero's copy block: one headline, an optional sub, an optional response
  line and one primary CTA, set over the dither field. It carries the product
  promise, a short answer in the accent colour, and the one action the hero
  asks for. The block owns its type scale per copy variant and type pair, its
  APCA-lifted colours (headline = sub colour, response = CTA hue), and, in the
  Split layout, the baseline lock between its two columns. Place it with the
  hero-split or hero-centered layout.
status: discoverable
sources:
  - src/heroes/dither/DitherHero.tsx
  - src/heroes/dither/ditherStore.ts
  - src/heroes/dither/useHeadlineFit.ts
  - src/utils/colorContrast.ts
  - src/index.css
tests:
  - scripts/smoke.mjs
  - scripts/lint-tokens.mjs
---

# Hero copy block

## When to use

Use this pattern when all of these hold:

- The surface is the Dither hero (`DitherHero`), the product surface, not the lab chrome.
- The text is one headline, at most one sub, at most one response line and exactly one CTA.
  These four parts come from one `DitherCopy` record (`copyVariants` in `ditherStore.ts`).
- The copy sits over the hero background `shader.colorBack`, alone or with the field drawn under it.

## When not to use

- Lab UI text (toolbars, the Design Panel): use the lab components in `design-system/components/`.
  The lab uses `lab-*` tokens, not the hero type scale.
- More than one primary action: the block has one CTA (`copy.cta`). The header CTA is
  separate; it only shares the colours from `heroCtaColors`.
- Long body text, lists or forms: the sub is one short paragraph (`max-w-[65ch]` in Split,
  `max-w-[52ch]` in Centered). Write a different section for longer content.

## Structure

The regions, in DOM order:

| Region | Element | Required | Purpose |
| --- | --- | --- | --- |
| headline | `h1` | yes | The product promise. Text from `copy.headline`. |
| sub | `p` after the `h1` | no (`copy.sub` can be `null`) | One supporting sentence. |
| response | `p` in the response wrapper | no (`copy.response` can be `null`) | A short answer in the accent colour. Split only; Centered does not render it. |
| CTA | `a` | yes | The one primary action. Label from `copy.cta`. |

The layout decides where the regions go:

- [hero-split](../layouts/hero-split.md): headline and sub in the left column; response and CTA
  in the right column, bottom-anchored.
- [hero-centered](../layouts/hero-centered.md): headline, sub and CTA in one centred column.

There is no component API. The consumer picks the copy and the type through the store:

```ts
setCopyVariant('ship-it')   // a copyVariants id
setTypePair('editorial')    // a typePairs id, or null for the variant's own faces
setLayoutConfig({ ctaAlign: 'last' })
```

`resolveCopy(copyVariant, typePair)` returns the copy as rendered: the variant's words, with
the type pair's faces laid over them when one is picked.

### Type scale

Defaults in `DitherHero.tsx`, used when the copy record omits a field:

| Region | Face | Size | Weight / leading / tracking |
| --- | --- | --- | --- |
| headline | `copy.headlineFont`, else `var(--font-display, Satoshi, sans-serif)` | `min(copy.headlineSize ?? clamp(2.5rem, 3.5vw + 1rem, 4rem), 8.5vw)`, then the headline fit | `headlineWeight ?? 900`, `headlineLeading ?? 0.95`, `headlineTracking ?? -0.03em` |
| sub | `copy.subFont`, else the body sans | token `--text-hero-sub` (17px), `md:` token `--text-hero-sub-lg` (20px); `copy.subSize` overrides | leading `1.55` |
| response | the headline face when `responseFontMode: 'headline'`, else `copy.responseFont` | `min(copy.responseSize ?? 48px, var(--rsp-cap))` | `responseWeight ?? 400`, `responseLeading ?? 1.1` |
| CTA | `copy.ctaFont`, else `copy.headlineFont`, else the display face | token `--text-hero-cta` (16px), `xl:` token `--text-hero-cta-lg` (18px); `copy.ctaSize` overrides | `font-semibold`, `tracking-wide` |

The tokens live in the `@theme` block of `src/index.css`. The classes are
`text-hero-sub md:text-hero-sub-lg` and `text-hero-cta xl:text-hero-cta-lg`.

The headline fit (`useHeadlineFit`) treats the authored size as a ceiling. It steps the
headline down in whole px until it sets in 3 lines. Below 1024px it accepts 4 lines when 3
lines need more than a 20 % cut. It never goes below 1.6 × the sub's font size.

Per copy variant (`copyVariants`). Every variant sets `responseFontMode: 'headline'`,
response weight 400 and style normal.

| Variant id | Headline face, weight | Headline size | Other choices |
| --- | --- | --- | --- |
| `fine-grain` | Instrument Serif, 400 | `clamp(3rem, 5vw + 1rem, 5.25rem)` | leading 1.02, tracking -0.01em; sub and CTA in Instrument Sans; response 36px |
| `full-bleed` | Outfit, 500 | `clamp(2.8rem, 4vw + 1rem, 4.5rem)` | leading 1.0; sub in Outfit; response 36px |
| `provocateur` | display face (no override), 500 | `clamp(3rem, 5vw + 1rem, 5.5rem)` | leading 1.1; response 36px |
| `value` | Bricolage Grotesque, 500 | `clamp(3.5rem, 5.5vw + 1rem, 6rem)` | response 36px |
| `ship-it` | Space Grotesk, 500 | `clamp(4rem, 6vw + 1rem, 7rem)` | response 36px |
| `ai` | JetBrains Mono, 500 | `clamp(2.5rem, 4vw + 1rem, 4.5rem)` | leading 1.08, tracking -0.05em; sub in JetBrains Mono at `clamp(15px, 0.4vw + 13px, 17px)`; CTA `clamp(14px, 0.3vw + 12.5px, 16px)`; response 28px; `responsePin: 'cta'`; `tabletLayout: 'stack'` |
| `speed` | Cabinet Grotesk, 500 | `clamp(3rem, 5vw + 1rem, 5.5rem)` | response 36px |
| `broke-fixed` | Geist Mono, 500 | `clamp(2.375rem, 3.4vw + 1rem, 3.875rem)` | leading 1.08, tracking -0.04em; response 30px |

A type pair (`typePairs`) replaces the headline face, weight, leading and tracking. It sets
the sub and CTA face to the pair's `bodyFont`. It clears `subSize` and `ctaSize`, because a
pair's body face is proportional. Only `terminal` sets its own `headlineSize`
(`clamp(2.25rem, 3.4vw + 1rem, 3.875rem)`) and forces `tabletLayout: 'stack'`.

| Pair id | Headline face | Body face | Weight / leading / tracking |
| --- | --- | --- | --- |
| `editorial` | Instrument Serif | Instrument Sans | 400 / 1.02 / -0.01em |
| `geometric` | Outfit | Outfit | 500 / 1.0 / -0.02em |
| `grotesk` | Space Grotesk | Inter | 500 / 1.0 / -0.03em |
| `quirky` | Bricolage Grotesque | Inter | 500 / 1.0 / -0.03em |
| `soft` | Fraunces | DM Sans | 500 / 1.04 / -0.02em |
| `terminal` | Geist Mono | Inter | 500 / 1.08 / -0.04em |

### Colours

- **Headline:** `#FFFFFF` when `headlineColorMode: 'white'`, else the palette's `problem[0]`.
  A terminal theme uses its `fg`. `ensureTextLc(colour, shader.colorBack, 75)` lifts the
  result to APCA Lc 75 on the background.
- **Sub:** the same colour as the headline (`sublineColor = headlineColor`). The sub is never
  a tint of the accent.
- **CTA:** `heroCtaColors(palette, terminalTheme)` gives `bg`, `text` and `hover`. The base fill
  is the terminal theme's `accent2`, else the palette's `cta`, else `fix[0]`.
  `getAccessibleCtaPair(base, 60)` picks white (`#FFFFFF`) or dark (`#14141E`) label text and
  nudges the fill until the label reaches Lc 60. Hover is the fill at `l + 0.08` in OKLCH.
- **Response:** the CTA fill lifted to Lc 75: `ensureTextLc(CTA_BG, shader.colorBack, 75)`.
  It keeps the CTA hue. Exception: `responseColorMode: 'white'` without a terminal theme
  gives `#FFFFFF`.

`ensureTextLc` mixes toward white on a dark background (luminance < 0.18) and toward black
on a light one. It takes the smallest of 20 mix steps that reaches the target, so a colour
that already passes is unchanged.

## Composition

### Required

- Keep one CTA. Its colours come only from `heroCtaColors`. Do not set a fixed CTA colour.
- Keep the sub in the headline colour. Keep the response in the CTA hue.
- Use the hero type tokens for the sub and CTA sizes. A raw `text-[Npx]` class fails
  `scripts/lint-tokens.mjs`. A deliberate raw value needs a `ds-exception: <why>` comment on
  the same line or the line above.
- **Split baseline lock** (two-column grid only, see [hero-split](../layouts/hero-split.md)):
  - The response's last line sits on the headline's last baseline (`baselineNudge.response`).
  - The CTA lines up with the sub per `layout.ctaAlign`. `'first'` (default) and `'last'` put the
    CTA label baseline on the sub's first or last line baseline. `'middle'` centres the CTA
    box on the sub box.
  - The gap from the response bottom to the CTA top is at least `MIN_RESPONSE_CTA_GAP` (24px).
    When the two locks would collide, the lock opens the headline→sub gap
    (`baselineNudge.subGap`, 0–200px). Both baselines then still hold.
  - Each nudge is clamped to ±200px in 0.5px steps. The lock runs again on resize, font load
    and copy change, for 3 frames each time.
  - `copy.responsePin: 'cta'` turns the response lock off. The response then sits tight above
    the CTA (`gap-4 md:gap-6`). The `ai` variant uses this.
  - While the grid is stacked, all nudges are 0.
- **Readability under the field:** when the field draws under the copy (Centered, or
  `edge.mode: 'full'`), every copy element gets a `textShadow` in `shader.colorBack`
  (`textReadabilityStyle`).

### Recommendations

- Pick a monospace headline only with `tabletLayout: 'stack'`. A mono headline in a 7/12
  tablet column breaks into ragged lines.
- Keep the response short. At 30 characters or less (whitespace collapsed) the right column
  uses `md:gap-14`; a longer response uses `md:gap-8`.
- Leave `ctaAlign` at `'first'` unless the sub has several lines and the CTA reads better
  beside its last line (`'last'`) or its centre (`'middle'`).

### Exceptions

- Centered does not render the response line or run the baseline lock.
- `copy.ctaFont` exists for display faces with a weak button weight, for example a 400-only
  serif (`fine-grain` uses Instrument Sans for the CTA).

## Accessibility

- The headline is the page `h1`. The sub and response are `p` elements. The CTA is an `a`.
- Contrast is a promise. The headline and sub reach Lc 75; the response reaches Lc 75;
  the CTA label reaches Lc 60 on its own fill.
- `checkContrast` measures each element's computed colour on what sits behind it: its own
  background (the CTA fill), else `shader.colorBack`. The floor is `requiredLc(size, weight)`:
  75 for body, 60 for large or bold, 45 for display, one step stricter below weight 400.
  The CTA floor is `min(60, requiredLc(...))`.
- The guide overlays are `aria-hidden="true"` and `pointer-events-none`.
- Hover colour changes on the CTA react to `pointerType === 'mouse'` only.

## Verification

Static checks:

- `node scripts/lint-tokens.mjs` flags raw font sizes and raw colours in `.tsx` classes.
  A deliberate exception needs `ds-exception: <why>`.

Browser checks (`npm run smoke`, `scripts/smoke.mjs`):

- `colour: in every palette the response line shares the CTA hue and sub = h1` (Split):
  the response hue is within 6° of the CTA fill, the CTA fill equals `heroCtaColors(id).bg`,
  and the sub colour equals the headline colour.
- `colour: in every palette the sub = h1 (Centered ...)`.
- `a11y: every template × palette passes APCA contrast` and
  `a11y: every copy variant passes APCA contrast (Problem)`: they call `window.__heroA11y()`.
- `layout: Split (...) lays out headline, sub, response line and CTA`.

Agent and manual checks in the browser:

- `window.__heroA11y()` returns one row per copy element: `{ name, color, bg, size, weight, lc, need, pass }`.
  `name` is `headline`, `sub`, `response` or `cta`. Every row must have `pass: true`.
- `?boxes=1` outlines each copy box. Each box is `[data-guide="box"]` with `data-name`,
  `data-rect="x,y,w,h"`, `data-lc`, `data-need` and `data-pass`. A failing box is red.
- `?baselines=1` draws one `[data-guide="baseline"][data-y]` line per text baseline. In Split,
  the response's last baseline and the headline's last baseline share one `data-y`.
- `?guides=1` draws the column grid and `[data-guide="edge"]` lines labelled `nav top`,
  `nav bottom`, `copy top` and `copy bottom`.

A deliberate violation that must be rejected: set a fixed CTA colour or a sub colour that
differs from the headline. The `colour:` smoke check fails. A copy colour below its Lc floor
gives `pass: false` in `__heroA11y()` and fails the `a11y:` checks.
