# Cover art

`hero-lab-cover.svg` is the card artwork for this project on
[glebstroganov.com/lab](https://glebstroganov.com/lab). It is deployed from that
repo (`public/work/hero-lab.svg`); this copy is the source of truth for
regenerating it.

```bash
python3 generate-cover.py     # writes four variants; n1 is the shipped one
```

## What it is

1120×700, dark ground, skeleton geometry, one CSS keyframe loop, ~4KB. It
matches the idiom of the other cards on that page rather than being a
screenshot: header parts (mark, nav, sign-in, CTA) over a dithering field, hero
copy and CTA below. No title text — the whole thing is wireframe.

The copy area is punched out of a **mask**, not covered by a plate. That is what
the real hero does: the scene flows around the text.

## Two motion decisions

**The field morphs; it does not cross-fade.** Fading stacked pattern layers
double-exposes — you see a circle and a square at once, which reads muddy rather
than as a change of shape. One `<pattern>` cell animating its own `rx`/`width`/
`x`/`fill` is a single continuous shape, so there is nothing to double-expose.

**No holds.** Parking on each state and jumping to the next reads as steps, not
change. Even keyframes on a sine-like curve keep it moving — measured 95% of
sampled frames in motion, the remaining 5% being the curve's own turnarounds.

Bands are staggered so the change sweeps across the field instead of snapping in
unison. Note the stagger has to scale with the loop: the usual 30–80ms guidance
is calibrated for ~250ms UI entrances, where it is 20–30% of the duration.
Against a 12s ambient loop it is 0.8% — measurably applied and visually nothing.
This uses 1.2s across seven bands.

`prefers-reduced-motion` freezes the field.

## Geometry

Every shape lands whole — a cell sliced by an edge reads as a rendering bug, not
a design. Three things must agree with the 32px cell step, and the constants at
the top of the generator encode all three:

- field `1120 x 608` = **35 x 19 whole cells**
- **7 bands of 160px** = 5 cells each, so no band boundary lands mid-cell
- copy clearance `32,284 480x224` = **15 cells x 7 rows**, so its straight edges
  fall between rows

`patternUnits="userSpaceOnUse"` tiles from the SVG origin, so tile boundaries sit
at multiples of the step from 0. The field starts at `y=92`, which is not one —
hence `patternTransform="translate(0,28)"` phasing the grid onto it. That is what
lets the field sit flush to the bottom edge without a sliced row.

The clearance is centred in the field (192px of field above and below) and the
copy is centred inside it (24px top and bottom, 50px either side). All of these
invariants are asserted at the bottom of `generate-cover.py`, so an edit that
breaks the grid fails at generation time rather than shipping a sliced row.
