# Validation

Run `npm run check` before you push. It runs four steps in order and prints one summary line per step. It runs every step, even after a failure, so one run shows everything that broke. The exit code is 1 if any step fails.

| Step | Command | Time |
|---|---|---|
| Typecheck | `tsc -b` | about 1 s |
| Build | `vite build` | about 1 s |
| Design-system contracts | `node ~/.claude/skills/ai-design-system/scripts/check-contract.mjs --inventory design-system/COMPONENTS.md design-system/components/*.md` | under 1 s |
| Smoke | `node scripts/smoke.mjs` (also `npm run smoke`) | about 85 s |

A full run takes about 85 s on an M-series Mac.

The contract checker lives in the `ai-design-system` skill, outside this repo. If the script is missing, the step prints `WARN skipped` and does not fail the run.

## Smoke suite

`scripts/smoke.mjs` needs Google Chrome or Chromium and Node 22 or later. It adds no npm dependencies.

1. It starts a Vite dev server inside its own process, on a free port. It never takes 5174.
2. HMR and the file watcher are off. The suite tests one snapshot of `src/`, even while someone edits it.
3. It starts headless Chrome with a new profile in the OS temp folder. It talks to Chrome over the DevTools protocol with Node's built-in `WebSocket`.
4. It stops Chrome and Vite and deletes the profile at the end.

The viewport is 1440 × 900 at device scale 1. The Design Panel is open, as on a first visit.

Each check prints one `PASS` or `FAIL` line with its numbers. Every check also fails if the page logs a console error, an uncaught exception or an error-level log entry while the check runs.

| Check | What it proves |
|---|---|
| boot | The lab loads on the Canvas view, and the script can reach the app's store. |
| view: Breakpoints, Canvas, Live | Each view opens from the bottom bar and shows its toolbar (or, in Live, the site header and the hero). |
| view: Recipe | Recipe opens. For every template card, the script goes to the bare scene and clicks "Add next layer" until the last step. Then "Remove top layer" must be enabled. Then, with Centered applied, every template has exactly one more step, `Layout · Centered`, and "Not used by this template" does not list the Layout. |
| chrome | The Canvas, Breakpoints and Recipe toolbars, the Design Panel header and the Live site header all have the same bottom edge (`h-lab-bar`, 56 px). |
| panel: Ctrl+Shift+E | The shortcut closes the Design Panel and opens it again. |
| hero: `<id>` | For each id in `heroTemplates`: the hero has an `h1` and a canvas. The field covers more than 2 % of the hero, outside the copy. |
| motion: `<id>` | For each template: two paused frames are identical. Over the same 400 ms, Rapid (4×) changes more than 1.25 times as much as Slow (0.5×). |
| warp: `<id>` | For each template (GPU, Paper 'mask', Paper 'cells'): with no pointer, Hover mode shows no reveal hue; Roam shows it and its centroid moves; under Pause two frames are identical and the blob still shows; in Both the reveal sits on the pointer and roams away after leave. |
| layout: Split | On Problem: the headline, sub, response line and CTA render, and the CTA column is beside the headline. |
| layout: Centered on `<id>` | For each template with Centered applied (`setComposition('centered')`), paused, copy hidden by opacity: the measured text lines (one rect per rendered line of the `h1` and each `p`, the CTA box) have under 0.5 % field; a band from `fullPadding` + one tile to two tiles further out has at least a quarter of the far field's share; the headline has a readability shadow; on Point sizes, Size contrast is above 0. |
| layout: Split restore | Centered then Split gives back each template's `fullPadding`, `dissolveDepth`, `textBlendMotion`, `textRectMode` and Size contrast. |
| colour (Split) | In every palette in `palettes`, the response line colour equals the CTA background, the CTA background equals `heroCtaColors().bg`, and the sub colour equals the `h1` colour. The script waits 1.2 s for the CTA colour transition. |
| colour (Centered) | Centered on Problem: in every palette, the sub colour equals the `h1` colour. |
| hover | On Problem, paused: a pointer 140 px above the copy top shows the reveal. A pointer 40 px below the copy top changes nothing. |
| panel: palette and Speed | A click on a palette tile sets the store's `palette`. Pause and Normal in Speed set `animation.playing` and `speed`. |
| panel: Size contrast | The slider shows on the Point-size templates (`tileDisplay: 'points'`) and on no other template. |
| panel: Layout | The Layout group has 2 tiles (Split, Centered). Centered sets the store and shows Clearance, Rim, Rim motion and Clear round; Hug sets `fullPadding` 4; Split switches back. |

### How the pixel checks work

The script takes screenshots with `Page.captureScreenshot` and decodes the PNGs in Node. It does not read the WebGL canvas, because the canvas can be blank without `preserveDrawingBuffer`.

rAF in headless Chrome runs at an uneven rate. So the checks compare two shots from the same run, never a fixed value. "Field" means a pixel far from the hero background colour (a sum of channel differences over 150). Fixed chrome (header, bottom bar, perf strip, panel) and the copy are left out of the counts.

### Options

- `CHROME_PATH=/path/to/chrome npm run smoke` uses another browser binary.
- `SMOKE_HEADED=1 npm run smoke` shows the browser window.

### Rules the suite does not cover

- The suite tests one viewport (1440 × 900). It does not test phone or tablet widths.
