# Hero Lab

**A browser lab for hero sections.** Pick a hero, tune every shader parameter live, and
share the exact look as a URL.

### [→ Open the live lab](https://hero-lab.netlify.app)

![Hero Lab — the Templates view: every hero template as an artboard, at desktop, tablet and phone widths](docs/preview.jpg)

*The Templates gallery is where the lab opens: every template as an artboard, at all
three breakpoints. Click one to make it live and start editing.*

The background is a real WebGL dithering shader, not an image. Every dot, colour, and
motion value in it is exposed as a control, so you can push it around until the section
looks right and then copy the config straight back into code.

The shader is [**@paper-design/shaders**](https://github.com/paper-design/shaders) — free,
open source, MIT. Hero Lab is a control surface on top of it. See
[Credits](#credits).

---

## Try it

```bash
npm install
npm run dev      # → http://localhost:5173/hero-lab/
```

Open it, then press <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> — or
click **Design controls** — to bring up the panel and start moving sliders. Nothing is
saved; reload for a clean slate.

```bash
npm run build    # production build → dist/
npm run preview  # serve that build
```

## What you can do

**Hover the dot field and sweep the cursor.** Warped pixel tiles punch through to the
opposite state — the green "fixed" field under the pink "broken" one, or the reverse —
with short log fragments trailing the cursor.

**Switch views** with the pill at the bottom of the screen:

| View | What it's for |
|------|---------------|
| **Live** | The hero at your window size — the main working surface |
| **Breakpoints** | Desktop, tablet, and phone side by side, each a real iframe at native width, so media queries and the shader behave exactly as they would on the device |
| **Templates** | Every hero template as an artboard, at all three widths. Select one to make it live and edit it |
| **Layers** | The scene taken apart — each layer of the composite stacked up so you can see how it's built |

**Three hero templates** ship in the box — *Full Bleed* (shapes flow around every text
line), *Problem* (square error tiles on a wide 96px grid), and *Fine Grain* (no grid, pure
shader). Plus eleven **scene presets** — Orbit, Radar, Error Sweep, Breath, and so on —
that swap the motion without touching the layout.

![The Design Panel open beside the live hero](docs/panel.jpg)

## The control panel

The panel drives the live scene. Grouped roughly in the order you'd reach for them:

- **Scene** — initial state (Problem / Fix), hero templates, scene presets
- **Dithering shader** — back colour, alpha layers (swirl / wave / dots), colour cycle, dither type
- **Motion** — speed, frame
- **Sizing** — fit, scale, rotation, offset
- **Pixel grid** — cell size, divisions, gap, corner radius, snap
- **Warp reveal** — hover shape, error-text pools, recolour / overlay modes
- **Top start / section edge** — where the field begins and how it dissolves into the page
- **Baseline lock** — snap the right column to the left column's baselines

**Export** and **Copy Config** serialize the current tuning so a look can be pinned back
into code.

## Sharing a look

Params are applied to the hero's store *before* React mounts, so the first frame is
already correct — no flash of the default.

```
?hero=<id>&state=<problem|fix>&scene=<id>&template=<id>&preset=<id>&logo=<hex>
```

| Param | Does |
|-------|------|
| `hero` | Which registry entry to mount (default `dither`) |
| `state` | Which state rests on top — `problem` or `fix` |
| `scene` | Scene preset (`orbit`, `radar-scan`, `error-sweep`, …) |
| `template` | Hero template (`full-bleed`, `problem`, `fine-grain`) |
| `preset` | Header brand + nav content (default `neutral`) |
| `logo` | Pins the generative logo to a formation, e.g. `?logo=8f3a` |

## The logo rolls itself

The mark in the header is the same dithering shader as the hero, at 28px, with its shape,
dither type, palette, scale, and rotation drawn from a seed generated once per visit — so
it's a different formation every time you load the page. **Click it to roll another one.**
The tooltip shows the current formation's id; `?logo=<id>` pins it if you want a
reproducible screenshot, and the browser-tab favicon matches whatever the header is
showing.

It animates continuously — the shader runs faster here than in the hero, because at 28px
there are only a few dozen visible cells and slow motion reads as a still image.

Two details worth knowing if you touch it:

- The dither field oscillates through *empty* as it animates, so the mark composites the
  live shader over a **seeded static dot formation** using `screen` blending. That
  underlay is the floor — without it the logo blinks out of existence a few seconds per
  cycle. (A flat tint instead of the dot formation was tried, so the shader alone would be
  the mark; at this size the field is sparse often enough that it degraded to a muddy
  coloured box.)
- One `<Dithering>` is one WebGL context, and browsers cap a page at roughly 16. The
  gallery and breakpoint iframes therefore render the static formation only, and the live
  shader mark is spent on the main window.

Reduced-motion visitors still get a unique formation — frozen at a random frame instead of
animating.

## Stack

- **Vite 7** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/vite`) — the `t-*` palette tokens live in `src/index.css`
- **[@paper-design/shaders-react](https://github.com/paper-design/shaders)** — the `Dithering` shader (WebGL2)
- **web-haptics** — subtle haptic feedback on interaction

Four runtime dependencies, on purpose.

## Credits

The dithering shader — the thing that actually makes the background move — is
**[@paper-design/shaders](https://github.com/paper-design/shaders)** by
**[Paper Design](https://paper.design)** (Lost Coast Labs, Inc.). It is free, open source,
and MIT licensed.

Worth being precise about the split: Paper Design wrote the shader. Hero Lab wires its
parameters to controls, adds the pixel-grid masking, the Problem⇄Fix warp reveal, the
breakpoint and artboard views, and the URL serialization. If you want the shader on its
own, take it from them directly — it stands up fine without any of this:

```bash
npm install @paper-design/shaders-react
```

Their [shader playground](https://shaders.paper.design) is the better starting point for
exploring what else the library can do.

## Layout

```
src/
  main.tsx                  mounts <HeroLab/>
  index.css                 Tailwind + fonts + t-* palette tokens
  lab/
    HeroLab.tsx             shell: header, view switcher, docked panel, ?hero routing
    registry.ts             heroes = [{ id:'dither', component, applyUrlParams }]
    PreviewCanvas.tsx       Breakpoints view — real iframes at device widths
    TemplateGallery.tsx     Templates view — artboards per template × width
    LayerExplorer.tsx       Layers view — the scene taken apart
  heroes/
    dither/
      DitherHero.tsx        the scene (dot field, warp reveal, copy block)
      ditherStore.ts        state, hero + scene templates (useSyncExternalStore)
      DitherPanel.tsx       the control panel body
      urlParams.ts          reads URL params into the store pre-mount
  components/
    BrandMark.tsx           the generative logo
    SiteFooter.tsx          author / colophon footer (Live view only)
    playground/             TextInspectorPanel, PaletteColorPicker, selection hooks
  content/presets.ts        header brand + nav, swappable
  themes/                   fonts.ts, terminalThemes.ts
  utils/                    colorContrast.ts
```

## Adding a hero

1. Build the component under `src/heroes/<id>/`.
2. Add one entry to `src/lab/registry.ts` (`id`, `name`, `engine`, `component`, optional
   `applyUrlParams`).

The hero switcher and `?hero=<id>` routing pick it up automatically — the switcher UI
appears once there are two or more heroes.

## Deploying

The build assumes a sub-path (`/hero-lab/`), since that's where it sits on
glebstroganov.com. For any other location, set `BASE_PATH`:

```bash
BASE_PATH=/ npm run build            # domain root
BASE_PATH=/experiments/ npm run build
```

The showcase deploy at [hero-lab.netlify.app](https://hero-lab.netlify.app) serves from
the root, so `netlify.toml` sets `BASE_PATH=/` for its build.

Anything that loads a file from `public/` must go through `import.meta.env.BASE_URL` — a
bare `/posters/…` will 404 under a sub-path.

Note that `netlify.toml` deliberately has **no** SPA catch-all redirect. The lab has no
path-based routing — every view is a query param on the same document — and a blanket
`/* → /index.html 200` turns a missing asset into a 200 that returns HTML, which is
exactly what makes the page render blank instead of erroring.

## Notes

- State is in-memory only. A reload resets to the Dither defaults.
- Content is deliberately neutral (ACME placeholder) and swappable via
  `src/content/presets.ts` — Dither began as a hero in a devtools homepage exploration.

## License

[MIT](LICENSE) — © 2026 Gleb Stroganov.

`@paper-design/shaders` is separately MIT licensed, © 2024 Lost Coast Labs, Inc.
(Paper Design).

---

## Author

**Gleb Stroganov** — design engineer at [Evil Martians](https://evilmartians.com).
A decade making developer tools that get used; currently on AI agent tooling and
observability UIs. Lisbon.

[**glebstroganov.com**](https://glebstroganov.com) · [GitHub @strongeron](https://github.com/strongeron)

More in the same vein: [Sound Playground](https://glebstroganov.com/sound-playground/) —
a modular synth in the browser.
