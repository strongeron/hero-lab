# DitherBackground

The Hero Lab dither field as one React component you can copy into your own project.

Demo: `npm run dev`, then open `/hero-lab/dither-background.html`.

## Install

1. Copy `DitherBackground.tsx` into your project.
2. Install the one runtime dependency:

```bash
npm install @paper-design/shaders-react
```

The component needs React 19 (it takes `ref` as a normal prop). It loads no fonts and no CSS.

## Use

Put it inside a positioned parent. It fills that parent. Your copy is a sibling, so it keeps your page's own font.

```tsx
import { DitherBackground } from './DitherBackground'

export function Hero() {
  return (
    <section style={{ position: 'relative', minHeight: '100svh', isolation: 'isolate' }}>
      <DitherBackground style={{ zIndex: -1 }} reveal />
      <h1>Your headline</h1>
    </section>
  )
}
```

## Props

| Prop | Default | What it does |
|---|---|---|
| `layers` | `problemLayers` (pink) | Colour layers `{ color, opacity, shape }`, screen-blended. `fixLayers` (green) is also exported. |
| `background` | `#0A1714` | Colour behind the dots. |
| `scene` | `'gentle-drift'` | `'gentle-drift'`, `'orbit'`, `'living-texture'`, `'radar-scan'`, `'still'`, or your own `Partial<DitherScene>`. |
| `grid` | `true` | `true`, `false`, or `{ size, gap, radius }` in px. Off shows the free WebGL dither. |
| `renderer` | `'color'` | Grid only. `'color'` draws tiles with flat colour, `'points'` sizes each dot by the field. |
| `reveal` | `false` | `true` or `{ layers, radius }`. Shows other layers in a circle under the cursor. |
| `paused` | `false` | Freezes motion. |

Other `div` props (`className`, `style`, `ref`, `data-*`) pass through to the root.

## Behaviour

- **Reduced motion.** If the user sets `prefers-reduced-motion: reduce`, the field shows one still frame. The hover reveal still works.
- **Off screen.** An `IntersectionObserver` stops all motion while the background is out of view.
- **No React renders per frame.** One `requestAnimationFrame` loop writes the moving values straight into Paper's uniforms (grid off) or redraws a 2D canvas (grid on), 24 times a second. Your page does not re-render while the field moves.
- **Reveal listens on the parent.** The pointer handlers sit on the parent element, so text laid over the background does not block the reveal. The root has `pointer-events: none`.
- **WebGL budget.** With the grid off, each layer is one WebGL context. The reveal's contexts mount on the first hover and unmount 2 s after the pointer leaves.

## Change the look

The shader texture (`type`, dot `size`, `scale`, `rotation`) is a `SHADER` constant near the top of the file. Edit it in your copy.

## Measured against the lab hero

Headless Chrome, 1440×900 at 2×, `gentle-drift`, 5 s trace after a 4 s settle, Vite dev build. The lab hero is `/?preview=1&scene=gentle-drift&grid=…&tile=…`. Script: [`docs/perf/measure-renders.mjs`](../../../docs/perf/measure-renders.mjs) (start Chrome with `--remote-debugging-port=9333`, then `node docs/perf/measure-renders.mjs <url> 5`).

| Setup | React commits/s, lab → component | Main-thread busy ms/s, lab → component |
|---|---|---|
| Grid, colour | 24.6 → 0 | 47.2 → 18.0 |
| Grid, points | 37.0 → 0 | 53.8 → 18.8 |
| No grid (WebGL) | 34.8 → 0 | 49.5 → 10.8 |

The lab hero re-renders its copy with every drift frame. The demo page's copy commits 0 times per second while the field moves.
