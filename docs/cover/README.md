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
This uses 1.2s across six bands.

`prefers-reduced-motion` freezes the field.

## The variants

`generate-cover.py` emits four; **n1 is shipped**.

| | |
|---|---|
| **n1** even keyframes, no holds | simplest continuous loop |
| n2 micro-states | nine closely-spaced states; evolution rather than transitions |
| n3 deep wave | bands offset most of the cycle, so the field is never uniform |
| n4 decoupled rates | shape on 9s, colour on 14s — they never re-align |
