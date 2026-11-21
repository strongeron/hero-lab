# Own WebGL2 renderer for the tile field, Paper kept for its shader code

The Point sizes and snapped-colour tile displays, and the Warp hover on top of them, were drawn tile by tile on a 2D canvas and handed to CSS as PNG masks. A hover sweep took about 895 ms of main-thread time per second and dropped to about 30 fps (see `docs/research/2026-11-21-shader-background-review.md`). We render that field in a small hand-written WebGL2 renderer (`src/heroes/dither/tileField.ts`): one context, one full-screen draw per frame, every tile computed in the fragment shader, uniforms written from refs in one animation loop.

## Considered options

- **Paper `ShaderMount` with a custom fragment shader.** It gives a canvas, sizing and a rAF loop, but one mount is one context, its sizing caps the backing store at a fractional scale (the tile edges blur), and `setUniforms` takes a whole object per call. We keep Paper for the free Color/alpha display, where its dithering shader is the look.
- **OGL or twgl.** The same shader through OGL measured 1 context and 60 draws/s, like raw WebGL2, and adds about 34 kB gzip for resize and uniform plumbing that is about 80 lines here.
- **three.js / React Three Fiber.** Far larger, and the scene is one quad.

## Consequences

The point-field maths (size map, edge visibility, clearance) now exists once, in GLSL; the CPU versions were removed from `DitherHero.tsx`, so the shader is the reference. The Warp transform exists twice: in the shader for this field, and in `buildWarpMask` for the free Color/alpha display, which still masks Paper canvases with CSS. Merging that display into the same renderer would remove the second copy. A browser without WebGL2 shows the hero background colour with no tiles.
