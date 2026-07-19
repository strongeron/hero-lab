# Architecture

How Hero Lab is put together, for anyone extending it. The [README](../README.md) covers
what it does; this is the engineering detail behind it.

## Layout

```
src/
  main.tsx                  mounts <HeroLab/>
  index.css                 Tailwind + fonts + t-* palette tokens
  lab/
    HeroLab.tsx             shell: header, view switcher, docked panel, ?hero routing
    registry.ts             heroes = [{ id:'dither', component, applyUrlParams }]
    LabToolbarTitle.tsx     the title block every view's toolbar shares
    TemplateGallery.tsx     Templates view — artboards per template × width
    PreviewCanvas.tsx       Breakpoints view — real iframes at device widths
    LayerExplorer.tsx       Layers view — the scene taken apart
  heroes/
    dither/
      DitherHero.tsx        the scene (dot field, warp reveal, copy block)
      ditherStore.ts        state, hero + scene templates (useSyncExternalStore)
      DitherPanel.tsx       the control panel body
      urlParams.ts          reads URL params into the store pre-mount
  components/
    BrandMark.tsx           the generative Hero Lab logo (lab toolbars only)
    SiteFooter.tsx          author / colophon footer (Live view only)
    playground/             TextInspectorPanel, PaletteColorPicker, selection hooks
  content/presets.ts        header brand + nav, swappable
```

State lives in one external store per hero (`useSyncExternalStore`), so the panel, the
canvas and the preview iframes all read the same source. Preview frames sync over a
`BroadcastChannel` scoped to the originating tab.

## Adding a hero

1. Build the component under `src/heroes/<id>/`.
2. Add one entry to `src/lab/registry.ts` (`id`, `name`, `engine`, `component`, optional
   `applyUrlParams`).

The hero switcher and `?hero=<id>` routing pick it up automatically — the switcher UI
appears once there are two or more heroes.

## The generative logo

`BrandMark.tsx` draws a 28px `<Dithering>` instance whose shape, dither type, palette,
scale and rotation come from a seed generated once per page load. Two constraints shape the
implementation, both found by rolling seeds into a contact sheet and looking at them:

**The dither field oscillates through empty.** On its own the mark blinks out of existence
for a few seconds each cycle. It therefore composites the live shader over a *seeded static
dot formation* using `screen` blending — that underlay is the floor. A flat tint was tried
instead, so the shader alone would be the mark; at 28px the field is sparse often enough
that it degraded to a muddy coloured box.

**One `<Dithering>` is one WebGL context, and browsers cap a page at roughly 16.** Past
that, canvases silently fail to acquire one. The mark is therefore spent in exactly one
place: the lab toolbar shared by Templates, Breakpoints and Layers, of which one view is
mounted at a time.

It is deliberately *not* the demo brand's mark. ACME's logo (`LabHeader` in `HeroLab.tsx`)
is a fixed shape — a mark that redraws itself per visit isn't a brand, and the baked
posters can't follow one, so the live view and the gallery would disagree.

Also worth knowing: `mixBlendMode: screen` escapes to the page without `isolation: isolate`
on the container, which washes the mark out entirely on a light header. And only shapes
that keep visible grain at 28px are in the pool — `dots`, `wave`, `sphere` and `ripple` all
collapse to a flat wash at that size.

The favicon is a fixed file, deliberately. A favicon is an identity anchor — people find a
tab among twenty by its icon, and browsers cache it into history and bookmarks. Re-rolling
it per visit trades that recognition for a detail nobody can resolve at 16px.

## Deploying

The build assumes a sub-path (`/hero-lab/`), since that's where it sits on
glebstroganov.com. For any other location, set `BASE_PATH`:

```bash
BASE_PATH=/ npm run build            # domain root
BASE_PATH=/experiments/ npm run build
```

`base` is set unconditionally in `vite.config.ts`, not just for `build`. Vite reports
`command === 'serve'` for **dev and preview alike**, so a build-only base makes
`npm run preview` serve at `/` while the built HTML asks for `/hero-lab/` — the asset
request then falls through to the SPA fallback, returns HTML, and the page renders blank.

Anything loading a file from `public/` must go through `import.meta.env.BASE_URL`. A bare
`/posters/…` will 404 under a sub-path.

`netlify.toml` deliberately has **no** SPA catch-all redirect. Every view here is a query
param on the same document, and a blanket `/* → /index.html 200` turns a missing asset into
a 200 that returns HTML — which is exactly what makes a page render blank instead of
erroring.

The showcase deploy at [hero-lab.netlify.app](https://hero-lab.netlify.app) serves from the
root, so `netlify.toml` sets `BASE_PATH=/` for its build. CI runs typecheck and build on
pushes to main and on every PR.

## Notes

- State is in-memory only. A reload resets to the Dither defaults.
- Content is deliberately neutral (ACME placeholder) and swappable via
  `src/content/presets.ts` — Dither began as a hero in a devtools homepage exploration.
- The Layers view always builds on the Fine Grain template, whatever is selected elsewhere.
  Full Bleed and Problem already ship a pixel grid and a tile renderer, so starting there
  means the first few steps toggle settings that are visually already on.
