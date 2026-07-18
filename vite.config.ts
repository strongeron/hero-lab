import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** The lab is published under a sub-path (glebstroganov.com/hero-lab/), so it
 *  needs a matching `base` or every asset resolves against the domain root and
 *  404s. Set unconditionally rather than only for `build`: Vite reports
 *  `command === 'serve'` for BOTH dev and preview, so a build-only base makes
 *  `npm run preview` serve at `/` while the built HTML asks for `/hero-lab/` —
 *  the asset request then falls through to the SPA fallback, comes back as
 *  HTML, and the page renders blank. Dev running under the same base is a
 *  bonus: base bugs show up locally instead of on deploy.
 *
 *  Override for other hosts:
 *
 *    BASE_PATH=/ npm run build          # domain root
 *    BASE_PATH=/whatever/ npm run build # some other sub-path
 *
 *  Anything reading a public asset must go through `import.meta.env.BASE_URL`
 *  (see the poster URLs in TemplateGallery) — a bare `/posters/...` breaks here. */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/hero-lab/',
  plugins: [react(), tailwindcss()],
})
