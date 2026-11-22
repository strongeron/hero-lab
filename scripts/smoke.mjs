#!/usr/bin/env node
// Headless smoke suite for the Hero Lab. Starts its own Vite dev server on a
// free port (HMR off), drives system Chrome over the DevTools protocol (Node's
// built-in WebSocket, no new deps) and prints one PASS/FAIL line per check.
//
//   node scripts/smoke.mjs            # exit 1 if any check fails
//   CHROME_PATH=/path/to/chrome node scripts/smoke.mjs
//   SMOKE_HEADED=1 node scripts/smoke.mjs   # watch it run
//
// Pixel checks compare screenshots from the same run (never absolute values),
// because rAF in headless Chrome runs at an uneven rate.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { inflateSync } from 'node:zlib'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VIEW_W = 1440
const VIEW_H = 900
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ─── processes ─── */

const children = []
let profileDir = null
let viteServer = null
function cleanup() {
  for (const c of children) { try { c.kill('SIGKILL') } catch { /* gone */ } }
  if (profileDir) { try { rmSync(profileDir, { recursive: true, force: true }) } catch { /* ignore */ } }
}
process.on('exit', cleanup)
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130) })

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

/** Vite dev server in this process, on a free port, with HMR and the file
 *  watcher off: the suite tests one snapshot of the code even while someone
 *  edits src/ (an HMR update would swap in a new store copy mid-run). */
async function startVite() {
  let port = await freePort()
  // 5174 is the user's live dev server; never take it.
  while (port === 5174) port = await freePort()
  const { createServer: createVite } = await import('vite')
  const server = await createVite({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    logLevel: 'error',
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false, watch: null, open: false },
  })
  await server.listen()
  viteServer = server
  return `http://127.0.0.1:${port}${server.config.base}`
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean)
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error(`no Chrome found; set CHROME_PATH (tried: ${candidates.join(', ')})`)
  return found
}

async function startChrome() {
  profileDir = mkdtempSync(join(tmpdir(), 'hero-lab-smoke-'))
  const args = [
    process.env.SMOKE_HEADED ? null : '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    `--window-size=${VIEW_W},${VIEW_H}`,
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars',
    // Keep timers and rAF running at full rate in a window nobody looks at.
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--enable-unsafe-swiftshader',
    'about:blank',
  ].filter(Boolean)
  const chrome = spawn(chromePath(), args, { stdio: 'ignore' })
  children.push(chrome)
  const portFile = join(profileDir, 'DevToolsActivePort')
  const t0 = Date.now()
  while (!existsSync(portFile) || !readFileSync(portFile, 'utf8').includes('\n')) {
    if (chrome.exitCode != null) throw new Error('Chrome exited before opening the DevTools port')
    if (Date.now() - t0 > 20000) throw new Error('Chrome did not open a DevTools port within 20s')
    await sleep(100)
  }
  const port = readFileSync(portFile, 'utf8').split('\n')[0].trim()
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('Chrome has no page target')
  return page.webSocketDebuggerUrl
}

/* ─── DevTools protocol ─── */

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.handlers = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id != null) {
        const p = this.pending.get(msg.id)
        if (!p) return
        this.pending.delete(msg.id)
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`))
        else p.resolve(msg.result)
      } else {
        for (const h of this.handlers.get(msg.method) ?? []) h(msg.params)
      }
    })
  }
  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      ws.addEventListener('open', () => resolve(new Cdp(ws)))
      ws.addEventListener('error', () => reject(new Error(`cannot open DevTools socket ${url}`)))
    })
  }
  send(method, params = {}, timeout = 30000) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out after ${timeout}ms`)) }, timeout)
      this.pending.set(id, {
        method,
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
    })
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, [])
    this.handlers.get(method).push(fn)
  }
}

let cdp
/** Every console error, uncaught exception and error-level log entry. */
const errors = []

/** Evaluate an expression (or async IIFE body) in the page; returns its value. */
async function js(expression, timeout = 30000) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeout)
  if (r.exceptionDetails) {
    const d = r.exceptionDetails
    throw new Error(`page eval: ${d.exception?.description ?? d.text}`.split('\n')[0])
  }
  return r.result.value
}
const store = (body) => js(`(async () => { const S = window.__smokeStore; ${body} })()`)

async function frames(n = 2) {
  await js(`new Promise((r) => { let k = ${n}; const f = () => (--k <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); setTimeout(r, 2000) })`)
}

async function load(url) {
  const done = new Promise((r) => cdp.on('Page.loadEventFired', r))
  await cdp.send('Page.navigate', { url })
  await done
  // The app is up once React has painted a lab view and the store is reachable.
  const t0 = Date.now()
  while (Date.now() - t0 < 20000) {
    const ok = await js(`!!document.querySelector('[role=group][aria-label=View]') && performance.getEntriesByType('resource').some((e) => e.name.includes('ditherStore.ts'))`)
    if (ok) break
    await sleep(200)
  }
  // Import the app's OWN copy of the store: the exact URL Vite served (with
  // its ?t=/?v= query). The bare path would load a second, unconnected copy.
  await js(`(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('ditherStore.ts')).pop()
    window.__smokeStore = await import(url)
  })()`)
}

async function clickButton(text, scope = 'document') {
  const ok = await js(`(() => {
    const b = [...${scope}.querySelectorAll('button')].find((e) => e.textContent.trim() === ${JSON.stringify(text)})
    if (!b) return false
    b.click()
    return true
  })()`)
  if (!ok) throw new Error(`no button "${text}"`)
}
const openView = (label) => clickButton(label, `document.querySelector('[role=group][aria-label=View]')`)

async function mouse(x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
}
async function shortcutDesignPanel() {
  const base = { key: 'E', code: 'KeyE', windowsVirtualKeyCode: 69, modifiers: 2 | 8 } // Ctrl+Shift
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
}

/* ─── pixels ─── */

/** Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced: what Chrome emits). */
function decodePng(buf) {
  let off = 8
  let w = 0, h = 0, ct = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4)
      if (data[8] !== 8 || data[12] !== 0) throw new Error('unsupported PNG (bit depth / interlace)')
      ct = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    off += 12 + len
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0
  if (!bpp) throw new Error(`unsupported PNG colour type ${ct}`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = new Uint8Array(w * h * 4)
  const prev = new Uint8Array(stride)
  const cur = new Uint8Array(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = src[i]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      cur[i] = v & 255
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      out[o] = cur[x * bpp]; out[o + 1] = cur[x * bpp + 1]; out[o + 2] = cur[x * bpp + 2]; out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255
    }
    prev.set(cur)
  }
  return { w, h, data: out }
}

/** Screenshot of a CSS-pixel rect (device scale is pinned to 1). */
async function shot(rect) {
  const clip = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.max(1, Math.round(rect.w)), height: Math.max(1, Math.round(rect.h)), scale: 1 }
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: false })
  const img = decodePng(Buffer.from(r.data, 'base64'))
  img.x = clip.x; img.y = clip.y
  return img
}

/** Share of pixels that changed between two shots, and the mean channel change. */
function diff(a, b) {
  let changed = 0, sum = 0
  const n = a.w * a.h
  for (let i = 0; i < n * 4; i += 4) {
    const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
    sum += d
    if (d > 24) changed++
  }
  return { changed: changed / n, mean: sum / (n * 3) }
}

const hexRgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) }
const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

/** Share of pixels (page coords inside `only`, outside every `skip` rect) that
 *  are far from the hero background: the field (or anything bright) drawn
 *  there. */
function fieldShare(img, back, { only = null, skip = [], thr = 150 } = {}) {
  const [br, bg, bb] = hexRgb(back)
  let hit = 0, total = 0
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const px = img.x + x, py = img.y + y
      if (only && !only.some((r) => inRect(px, py, r))) continue
      if (skip.some((r) => inRect(px, py, r))) continue
      total++
      const o = (y * img.w + x) * 4
      if (Math.abs(img.data[o] - br) + Math.abs(img.data[o + 1] - bg) + Math.abs(img.data[o + 2] - bb) > thr) hit++
    }
  }
  return total ? hit / total : 0
}

/* ─── page geometry ─── */

/** Hero section, its copy rects and every fixed overlay (header, bottom bar,
 *  perf strip, panel), all in viewport CSS px. */
function heroGeometry() {
  return js(`(() => {
    const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }
    const sec = document.querySelector('section.min-h-svh')
    if (!sec) return null
    const vis = R(sec)
    const right = Math.min(vis.x + vis.w, innerWidth), bottom = Math.min(vis.y + vis.h, innerHeight)
    vis.x = Math.max(0, vis.x); vis.y = Math.max(0, vis.y); vis.w = right - vis.x; vis.h = bottom - vis.y
    const h1 = sec.querySelector('h1')
    const cta = [...sec.querySelectorAll('a')].find((a) => a.textContent.trim())
    const paras = [...sec.querySelectorAll('p')]
    const overlays = [...document.body.querySelectorAll('*')]
      .filter((e) => !sec.contains(e) && getComputedStyle(e).position === 'fixed')
      .map(R).filter((r) => r.w > 0 && r.h > 0)
    const content = [...sec.children].find((c) => c.classList.contains('z-10'))
    return {
      hero: vis, h1: R(h1), cta: R(cta), paras: paras.map(R), overlays, content: R(content),
      canvases: sec.querySelectorAll('canvas').length,
      // Text lines as the hero measures them: one rect per rendered line of
      // the h1 and each p, the CTA's box.
      lines: [h1, ...paras].filter(Boolean).flatMap((e) => { const g = document.createRange(); g.selectNodeContents(e); return [...g.getClientRects()].filter((q) => q.width >= 4 && q.height >= 6).map((q) => ({ x: q.left, y: q.top, w: q.width, h: q.height })) }).concat(cta ? [R(cta)] : []),
    }
  })()`)
}

/* ─── test runner ─── */

const results = []
async function check(name, fn) {
  const before = errors.length
  const t0 = Date.now()
  let ok = false, detail = ''
  try {
    detail = (await fn()) ?? ''
    const fresh = errors.slice(before)
    if (fresh.length) throw new Error(`${fresh.length} console error(s): ${fresh[0]}`)
    ok = true
  } catch (e) {
    detail = String(e.message ?? e).split('\n')[0]
  }
  const ms = Date.now() - t0
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}  (${(ms / 1000).toFixed(1)}s)`)
}
function assert(cond, msg) { if (!cond) throw new Error(msg) }

const pct = (v) => `${(v * 100).toFixed(2)}%`

/* ─── suite ─── */

async function main() {
  const t0 = Date.now()
  const url = await startVite()
  const ws = await startChrome()
  cdp = await Cdp.connect(ws)
  cdp.on('Runtime.exceptionThrown', (p) => errors.push(`exception: ${(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).split('\n')[0]}`))
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'assert') errors.push(`console.${p.type}: ${p.args.map((a) => a.value ?? a.description ?? '').join(' ').split('\n')[0].slice(0, 200)}`)
  })
  cdp.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') errors.push(`log: ${p.entry.text.slice(0, 200)} ${p.entry.url ?? ''}`) })
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1, mobile: false })
  console.log(`smoke: ${url} in headless Chrome, ${VIEW_W}x${VIEW_H}`)

  await check('boot: lab loads (Canvas view) without console errors', async () => {
    await load(url)
    await sleep(1500)
    assert(await js(`!!window.__smokeStore?.getDitherState`), 'store import failed')
    const h = await js(`document.querySelector('.h-lab-bar h1')?.textContent ?? ''`)
    assert(h.includes('Canvas'), `first view is not Canvas (toolbar: "${h}")`)
  })

  const t = await store(`return { templates: S.heroTemplates.map((t) => ({ id: t.id, points: t.animation?.tileDisplay === 'points' })), palettes: S.paletteIds }`)
  const bars = {}
  const barBottoms = () => js(`(() => {
    const b = (e) => e ? Math.round(e.getBoundingClientRect().bottom * 100) / 100 : null
    return {
      panel: b(document.querySelector('aside[data-design-panel] .h-lab-bar')),
      toolbar: b([...document.querySelectorAll('.h-lab-bar')].find((e) => !e.closest('aside') && e.tagName !== 'HEADER')),
      header: b(document.querySelector('header.h-lab-bar')),
    }
  })()`)
  const waitPanel = async () => {
    for (let i = 0; i < 50; i++) { if (await js(`!!document.querySelector('aside[data-design-panel]')`)) return; await sleep(100) }
    throw new Error('Design Panel did not mount')
  }

  for (const view of ['Breakpoints', 'Canvas', 'Live']) {
    await check(`view: ${view} opens without errors`, async () => {
      await openView(view)
      await sleep(2000)
      await waitPanel()
      const b = await barBottoms()
      if (view === 'Live') {
        assert(b.header != null, 'no site header (header.h-lab-bar)')
        assert(await js(`!!document.querySelector('section.min-h-svh')`), 'no hero section')
        bars['Live header'] = b.header
      } else {
        const title = await js(`document.querySelector('.h-lab-bar h1')?.textContent ?? ''`)
        assert(title.includes(view), `toolbar title "${title}" does not name ${view}`)
        assert(b.toolbar != null, 'no lab toolbar')
        bars[`${view} toolbar`] = b.toolbar
        if (view === 'Breakpoints') assert(await js(`document.querySelectorAll('iframe').length > 0`), 'no breakpoint iframes')
      }
      bars[`Design Panel header (${view})`] = b.panel
    })
  }

  await check('view: Recipe opens and every template steps through without errors', async () => {
    await openView('Recipe')
    await sleep(2000)
    const title = await js(`document.querySelector('.h-lab-bar h1')?.textContent ?? ''`)
    assert(title.includes('Recipe'), `toolbar title "${title}" does not name Recipe`)
    bars['Recipe toolbar'] = (await barBottoms()).toolbar
    const cards = await js(`document.querySelectorAll('[role=group][aria-label="Template to take apart"] button').length`)
    assert(cards === t.templates.length, `${cards} template cards, expected ${t.templates.length}`)
    const steps = []
    for (let i = 0; i < cards; i++) {
      await js(`document.querySelectorAll('[role=group][aria-label="Template to take apart"] button')[${i}].click()`)
      await sleep(400)
      await clickButton('Bare scene').catch(() => { /* already bare: button disabled is fine */ })
      await sleep(250)
      let n = 0
      while (n < 30 && await js(`(() => { const b = document.querySelector('button[aria-label="Add next layer"]'); if (!b || b.disabled) return false; b.click(); return true })()`)) {
        n++
        await sleep(250)
      }
      assert(n > 0, `template ${i + 1}: no steps to add`)
      assert(await js(`document.querySelector('button[aria-label="Remove top layer"]')?.disabled === false`), `template ${i + 1}: cannot step back after ${n} steps`)
      steps.push(n)
    }
    // Centered applied in the Design Panel: Recipe adds one Layout step to
    // every template (it is a Layout option, not a template part).
    await openView('Canvas')
    await sleep(800)
    await store(`S.setComposition('centered')`)
    await openView('Recipe')
    await sleep(2000)
    const withLayout = []
    for (let i = 0; i < cards; i++) {
      await js(`document.querySelectorAll('[role=group][aria-label="Template to take apart"] button')[${i}].click()`)
      await sleep(400)
      const names = await js(`[...document.querySelectorAll('button[aria-pressed] .font-mono.text-lab-md')].map((e) => e.textContent.trim())`)
      const n = names.length
      assert(names.includes('Layout · Centered'), `template ${i + 1}: no "Layout · Centered" step (${names.join(', ')})`)
      assert(n === steps[i] + 1, `template ${i + 1}: ${n} steps with Centered, expected ${steps[i] + 1}`)
      withLayout.push(n)
    }
    const unused = await js(`[...document.querySelectorAll('p')].find((p) => p.textContent.startsWith('Not used by this template'))?.textContent ?? ''`)
    assert(!/layout/i.test(unused), `"${unused}" lists the Layout`)
    await openView('Canvas')
    await sleep(600)
    await store(`S.setComposition('split')`)
    return `steps per template: ${steps.join(', ')}; with Centered: ${withLayout.join(', ')}`
  })

  await check('chrome: lab toolbars, Design Panel header and site header share one bottom (h-lab-bar)', async () => {
    const vals = Object.entries(bars)
    const missing = vals.filter(([, v]) => v == null).map(([k]) => k)
    assert(!missing.length, `not measured: ${missing.join(', ')}`)
    const ref = vals[0][1]
    const off = vals.filter(([, v]) => Math.abs(v - ref) > 0.5)
    assert(!off.length, vals.map(([k, v]) => `${k} ${v}`).join(', '))
    return `all at ${ref}px (${vals.length} bars)`
  })

  // Everything below runs in Live with the panel open.
  await openView('Live')
  await sleep(1500)
  await waitPanel()
  await mouse(VIEW_W - 40, VIEW_H / 2) // park the pointer on the panel, off the hero

  await check('panel: Ctrl+Shift+E closes and reopens the Design Panel', async () => {
    await shortcutDesignPanel()
    await sleep(400)
    assert(!(await js(`!!document.querySelector('aside[data-design-panel]')`)), 'panel still open after shortcut')
    await shortcutDesignPanel()
    await waitPanel()
  })

  const geo = {}
  for (const tp of t.templates) {
    await check(`hero: ${tp.id} renders a non-blank field without console errors`, async () => {
      await store(`S.applyHeroTemplate(${JSON.stringify(tp.id)})`)
      await sleep(1800)
      await frames(3)
      const g = await heroGeometry()
      assert(g, 'no hero section')
      assert(g.h1, 'no h1 in the hero')
      assert(g.canvases > 0, 'no canvas in the hero')
      geo[tp.id] = g
      const back = await store(`return S.getDitherState().shader.colorBack`)
      const img = await shot(g.hero)
      const skip = [...g.overlays, g.cta, ...g.paras].filter(Boolean)
      const share = fieldShare(img, back, { skip: [...skip, g.h1] })
      assert(share > 0.02, `field covers ${pct(share)} of the hero (blank?)`)
      return `field ${pct(share)}, ${g.canvases} canvas`
    })
  }

  for (const tp of t.templates) {
    await check(`motion: ${tp.id} Pause holds still, Rapid moves more than Slow`, async () => {
      await store(`S.applyHeroTemplate(${JSON.stringify(tp.id)})`)
      await sleep(1200)
      const g = await heroGeometry()
      // The hero minus the fixed chrome on top of it: a band under the header.
      const header = g.overlays.find((r) => r.y <= 1 && r.h < 120)
      const top = header ? header.y + header.h : g.hero.y
      const area = { x: g.hero.x, y: top, w: g.hero.w, h: Math.min(g.hero.h - top, VIEW_H - 140 - top) }
      const pair = async (gap) => { await frames(2); const a = await shot(area); await sleep(gap); await frames(2); const b = await shot(area); return diff(a, b) }

      await store(`S.setAnimationConfig({ playing: true, speed: 0.5 })`)
      await sleep(600)
      const slow = await pair(400)
      await store(`S.setAnimationConfig({ playing: true, speed: 4 })`)
      await sleep(600)
      const rapid = await pair(400)
      await store(`S.setAnimationConfig({ playing: false })`)
      await sleep(800)
      const paused = await pair(800)
      const summary = `paused ${pct(paused.changed)}, slow ${slow.mean.toFixed(2)}, rapid ${rapid.mean.toFixed(2)} mean Δ`
      assert(paused.changed === 0, `paused frames differ (${pct(paused.changed)} px changed) — ${summary}`)
      assert(rapid.changed > 0.002, `Rapid shows no motion — ${summary}`)
      assert(rapid.mean > slow.mean * 1.25, `Rapid does not move clearly more than Slow — ${summary}`)
      await store(`S.setAnimationConfig({ playing: true, speed: 1 })`)
      return summary
    })
  }

  // ── Warp mode: Roam ──
  // Reveal pixels: the other state's hue (green over a pink rest, pink over a
  // green one). The field drifts too, so the checks read the reveal hue and
  // where it sits, not the raw pixel change.
  const revealStats = (img, rest, skip) => {
    let n = 0, total = 0, sx = 0, sy = 0
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        const px = img.x + x, py = img.y + y
        if (skip.some((r) => inRect(px, py, r))) continue
        total++
        const o = (y * img.w + x) * 4
        const r = img.data[o], gg = img.data[o + 1]
        const hit = rest === 'problem' ? gg > r + 40 && gg > 90 : r > gg + 40 && r > 80
        if (hit) { n++; sx += px; sy += py }
      }
    }
    return { share: total ? n / total : 0, cx: n ? sx / n : 0, cy: n ? sy / n : 0 }
  }
  for (const tp of t.templates) {
    await check(`warp: ${tp.id} Roam moves the reveal with no pointer and holds under Pause; Hover shows none; Both follows the pointer`, async () => {
      await store(`S.applyHeroTemplate(${JSON.stringify(tp.id)}); S.setAnimationConfig({ playing: true, speed: 4 })`)
      await mouse(VIEW_W - 40, VIEW_H / 2)
      await sleep(1500)
      const rest = await store(`return S.getDitherState().initialState`)
      const g = await heroGeometry()
      const header = g.overlays.find((r) => r.y <= 1 && r.h < 120)
      const top = header ? header.y + header.h : g.hero.y
      const area = { x: g.hero.x, y: top, w: g.hero.w, h: Math.min(g.hero.h - top, VIEW_H - 140 - top) }
      // The copy can carry the accent hue (response line, CTA): skip it.
      const skip = [...g.overlays, ...g.lines.map((r) => ({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }))]
      const hoverOnly = revealStats(await shot(area), rest, skip)
      await store(`S.setHoverConfig({ mode: 'roam' })`)
      await sleep(1500)
      // A few samples: the blob can pass under the lab's bottom bar or a
      // text line, so judge the samples that show it.
      const samples = []
      for (let i = 0; i < 4; i++) {
        await frames(2)
        samples.push(revealStats(await shot(area), rest, skip))
        await sleep(900)
      }
      const seen = samples.filter((x) => x.share > 0.0005)
      let moved = 0
      for (const x of seen) for (const y of seen) moved = Math.max(moved, Math.hypot(x.cx - y.cx, x.cy - y.cy))
      await store(`S.setAnimationConfig({ playing: false })`)
      await sleep(1500)
      await frames(2)
      const p1 = await shot(area)
      await sleep(800)
      await frames(2)
      const p2 = await shot(area)
      const paused = diff(p1, p2)
      const held = revealStats(p2, rest, skip)
      // Both: the pointer takes the blob; on leave it roams away again.
      await store(`S.setHoverConfig({ mode: 'both' }); S.setAnimationConfig({ playing: true, speed: 1 })`)
      const ptr = { x: Math.round(area.x + area.w * 0.3), y: Math.round(top + 110) }
      await mouse(ptr.x, ptr.y); await sleep(200); await mouse(ptr.x + 3, ptr.y + 2)
      await sleep(1500)
      await frames(2)
      const on = revealStats(await shot(area), rest, skip)
      await mouse(VIEW_W - 40, VIEW_H / 2)
      await store(`S.setAnimationConfig({ playing: true, speed: 4 })`)
      // The blob can roam under the lab's bottom bar: sample until it shows.
      let off = { share: 0, cx: 0, cy: 0 }
      for (let i = 0; i < 4 && off.share <= 0.0005; i++) {
        await sleep(i ? 900 : 2500)
        await frames(2)
        off = revealStats(await shot(area), rest, skip)
      }
      const near = Math.hypot(on.cx - ptr.x, on.cy - ptr.y), away = Math.hypot(off.cx - ptr.x, off.cy - ptr.y)
      await store(`S.setHoverConfig({ mode: 'hover' }); S.setAnimationConfig({ playing: true, speed: 1 })`)
      const summary = `Both: ${near.toFixed(0)}px from the pointer, ${away.toFixed(0)}px after leave; Hover ${pct(hoverOnly.share)}; Roam ${samples.map((x) => pct(x.share)).join(' → ')}, moved ${moved.toFixed(0)}px; paused ${pct(paused.changed)} changed, ${pct(held.share)} held`
      assert(hoverOnly.share < 0.0002, `Hover mode reveals with no pointer — ${summary}`)
      assert(seen.length >= 2, `Roam shows no reveal — ${summary}`)
      assert(moved > 12, `Roam reveal does not move — ${summary}`)
      assert(paused.changed === 0, `Roam moves under Pause — ${summary}`)
      assert(held.share > 0.0005, `Roam blob gone under Pause — ${summary}`)
      assert(on.share > 0.0005 && near < 90, `Both: the blob does not follow the pointer — ${summary}`)
      assert(off.share > 0.0005 && away > 60, `Both: the blob does not roam on after leave — ${summary}`)
      return summary
    })
  }

  // ── layouts ──
  const split = t.templates.find((x) => x.id === 'problem') ?? t.templates[0]

  await check(`layout: Split (${split.id}) lays out headline, sub, response line and CTA`, async () => {
    await store(`S.applyHeroTemplate(${JSON.stringify(split.id)})`)
    await sleep(1200)
    const s = await js(`(() => {
      const sec = document.querySelector('section.min-h-svh'); const h1 = sec.querySelector('h1')
      const cta = [...sec.querySelectorAll('a')].find((a) => a.textContent.trim())
      const resp = cta?.parentElement.querySelector('p')
      return { h1: !!h1, sub: h1?.nextElementSibling?.tagName === 'P', resp: !!resp?.textContent.trim(), cta: !!cta,
        sideBySide: !!(h1 && cta && cta.getBoundingClientRect().left > h1.getBoundingClientRect().left + 100) }
    })()`)
    assert(s.h1 && s.sub && s.resp && s.cta, `missing parts: ${JSON.stringify(s)}`)
    assert(s.sideBySide, 'CTA column is not beside the headline at 1440px')
  })

  const grow = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d })
  for (const tp of t.templates) {
    await check(`layout: Centered on ${tp.id} clears each text line and the field reaches close to it`, async () => {
      await store(`S.applyHeroTemplate(${JSON.stringify(tp.id)}); S.setComposition('centered'); S.setAnimationConfig({ playing: false })`)
      await mouse(VIEW_W - 40, VIEW_H / 2)
      await sleep(1800)
      await frames(3)
      const g = await heroGeometry()
      assert(g.lines.length >= 3, `only ${g.lines.length} text rects`)
      const st = await store(`const s = S.getDitherState(); const g = s.pixelGrid; return { back: s.shader.colorBack, pad: s.edge.fullPadding, depth: s.edge.dissolveDepth, pitch: g.enabled ? S.gridPitch(g) : s.shader.size, contrast: s.animation.tileSizeContrast }`)
      const shadow = await js(`getComputedStyle(document.querySelector('section.min-h-svh h1')).textShadow`)
      assert(shadow && shadow !== 'none', 'no readability shadow on the Centered headline')
      // Hide the copy (opacity keeps the layout and the measured rects), shoot
      // the field alone, then show it again.
      await js(`document.querySelector('section.min-h-svh > .z-10').style.opacity = '0'`)
      await frames(2)
      const img = await shot(g.hero)
      await js(`document.querySelector('section.min-h-svh > .z-10').style.opacity = ''`)
      const lines = g.lines
      // Clear: the text rects themselves. Near: a band just past the
      // clearance (pad + one tile of snapping) and two tiles deep, outside
      // every line's clear zone. Far: the field well away from the copy.
      const inner = st.pad + st.pitch
      const outer = inner + 2 * st.pitch + 8
      const clear = fieldShare(img, st.back, { only: lines, skip: g.overlays })
      const near = fieldShare(img, st.back, { only: lines.map((r) => grow(r, outer)), skip: [...lines.map((r) => grow(r, inner)), ...g.overlays] })
      const far = fieldShare(img, st.back, { skip: [...lines.map((r) => grow(r, 160)), ...g.overlays] })
      const summary = `clear ${pct(clear)}, near (${inner}–${outer}px) ${pct(near)}, far ${pct(far)}; pad ${st.pad}px, ${st.pitch}px tiles${tp.points ? `, size contrast ${st.contrast}` : ''}`
      assert(far > 0.02, `no field away from the copy — ${summary}`)
      assert(clear < 0.005, `field on the text lines — ${summary}`)
      assert(near > far * 0.25, `field does not reach close to the text — ${summary}`)
      if (tp.points) assert(st.contrast > 0, `Centered left Size contrast at 0 — ${summary}`)
      await store(`S.setAnimationConfig({ playing: true, speed: 1 })`)
      return summary
    })
  }

  await check('layout: Split puts back the template edge and Size contrast after Centered', async () => {
    const bad = []
    for (const tp of t.templates) {
      const r = await store(`S.applyHeroTemplate(${JSON.stringify(tp.id)}); const pick = (s) => JSON.stringify([s.edge.fullPadding, s.edge.dissolveDepth, s.edge.textBlendMotion, s.edge.textRectMode, s.animation.tileSizeContrast]); const a = pick(S.getDitherState()); S.setComposition('centered'); S.setComposition('split'); return { a, b: pick(S.getDitherState()) }`)
      if (r.a !== r.b) bad.push(`${tp.id}: ${r.a} → ${r.b}`)
    }
    assert(!bad.length, bad.join('; '))
  })

  // ── colour rule ──
  const readColours = () => js(`(() => {
    const sec = document.querySelector('section.min-h-svh'); const h1 = sec.querySelector('h1')
    const cta = [...sec.querySelectorAll('a')].find((a) => a.textContent.trim())
    const resp = cta && cta.parentElement.querySelector('p')
    const sub = h1 && (h1.nextElementSibling?.tagName === 'P' ? h1.nextElementSibling : sec.querySelector('p'))
    const c = (e, p) => e ? getComputedStyle(e)[p] : null
    return { h1: c(h1, 'color'), sub: c(sub, 'color'), resp: c(resp, 'color'), ctaBg: c(cta, 'backgroundColor') }
  })()`)
  const rgbOf = (hex) => `rgb(${hexRgb(hex).join(', ')})`

  await check(`colour: in every palette the response line = CTA fill and sub = h1 (${split?.id})`, async () => {
    await store(`S.applyHeroTemplate(${JSON.stringify(split.id)})`)
    await sleep(800)
    const bad = []
    for (const id of t.palettes) {
      await store(`S.setPalette(${JSON.stringify(id)})`)
      await sleep(1200) // the CTA's colour transition
      const c = await readColours()
      const want = rgbOf(await store(`return S.heroCtaColors(${JSON.stringify(id)}).bg`))
      if (c.resp !== c.ctaBg) bad.push(`${id}: response ${c.resp} ≠ CTA ${c.ctaBg}`)
      if (c.ctaBg !== want) bad.push(`${id}: CTA ${c.ctaBg} ≠ heroCtaColors ${want}`)
      if (c.sub !== c.h1) bad.push(`${id}: sub ${c.sub} ≠ h1 ${c.h1}`)
    }
    assert(!bad.length, bad.join('; '))
    return `${t.palettes.length} palettes`
  })

  await check(`colour: in every palette the sub = h1 (Centered on ${split.id})`, async () => {
    await store(`S.applyHeroTemplate(${JSON.stringify(split.id)}); S.setComposition('centered')`)
    await sleep(800)
    const bad = []
    for (const id of t.palettes) {
      await store(`S.setPalette(${JSON.stringify(id)})`)
      await sleep(300)
      const c = await readColours()
      if (c.sub !== c.h1) bad.push(`${id}: sub ${c.sub} ≠ h1 ${c.h1}`)
    }
    assert(!bad.length, bad.join('; '))
    return `${t.palettes.length} palettes`
  })

  // ── Problem hover band ──
  await check('hover: Problem reveals above the copy top, not below it', async () => {
    const id = t.templates.find((x) => x.id === 'problem')?.id
    assert(id, 'no problem template')
    await store(`S.applyHeroTemplate('problem'); S.setAnimationConfig({ playing: false })`)
    await mouse(VIEW_W - 40, VIEW_H / 2)
    await sleep(1500)
    const g = await heroGeometry()
    assert(g.content, 'no copy block')
    const cx = Math.round(g.hero.x + g.hero.w * 0.55)
    const probe = async (y, area) => {
      await mouse(VIEW_W - 40, VIEW_H / 2)
      await sleep(900)
      const a = await shot(area)
      await mouse(cx, y)
      await sleep(300)
      await mouse(cx + 4, y + 2)
      await sleep(900)
      const b = await shot(area)
      return diff(a, b).changed
    }
    const topY = g.content.y
    const above = await probe(topY - 140, { x: cx - 90, y: topY - 230, w: 180, h: 180 })
    const below = await probe(topY + 40, { x: cx - 90, y: topY + 4, w: 180, h: 110 })
    await mouse(VIEW_W - 40, VIEW_H / 2)
    await store(`S.setAnimationConfig({ playing: true, speed: 1 })`)
    const summary = `copy top ${Math.round(topY)}px; above ${pct(above)} changed, below ${pct(below)}`
    assert(above > 0.03, `no reveal above the copy top — ${summary}`)
    assert(below < 0.002, `reveal shows below the copy top — ${summary}`)
    return summary
  })

  // ── Design Panel controls ──
  await check('panel: a palette tile sets the store palette; a Speed stop sets playing', async () => {
    const pick = await js(`(() => {
      const sec = [...document.querySelectorAll('aside[data-design-panel] section')].find((s) => s.querySelector('h4')?.textContent.trim() === 'Palette')
      if (!sec) return { err: 'no Palette group' }
      const btns = [...sec.querySelectorAll('button[aria-pressed]')]
      const i = btns.findIndex((b) => b.getAttribute('aria-pressed') === 'false')
      if (i < 0) return { err: 'no unpicked palette tile' }
      btns[i].click()
      return { i, n: btns.length }
    })()`)
    assert(!pick.err, pick.err)
    assert(pick.n === t.palettes.length, `${pick.n} palette tiles, expected ${t.palettes.length}`)
    await sleep(300)
    const got = await store(`return S.getDitherState().palette`)
    assert(got === t.palettes[pick.i], `clicked ${t.palettes[pick.i]}, store says ${got}`)
    await clickButton('Pause', `document.querySelector('aside[data-design-panel] [role=group][aria-label=Speed]')`)
    await sleep(200)
    assert((await store(`return S.getDitherState().animation.playing`)) === false, 'Pause did not stop playing')
    await clickButton('Normal', `document.querySelector('aside[data-design-panel] [role=group][aria-label=Speed]')`)
    await sleep(200)
    const a = await store(`const a = S.getDitherState().animation; return { playing: a.playing, speed: a.speed }`)
    assert(a.playing && a.speed === 1, `Normal gave ${JSON.stringify(a)}`)
    return `palette → ${got}`
  })

  await check('panel: Size contrast slider shows on Point-size templates only', async () => {
    const bad = []
    for (const tp of t.templates) {
      await store(`S.applyHeroTemplate(${JSON.stringify(tp.id)})`)
      await sleep(400)
      const has = await js(`[...document.querySelectorAll('aside[data-design-panel] label')].some((l) => l.textContent.trim() === 'Size contrast')`)
      if (has !== tp.points) bad.push(`${tp.id}: ${has ? 'shown' : 'missing'}`)
    }
    assert(!bad.length, bad.join(', '))
    return `shown on ${t.templates.filter((x) => x.points).map((x) => x.id).join(', ')}`
  })

  await check('panel: the Centered Layout tile applies Centered and shows its edge controls', async () => {
    await store(`S.applyHeroTemplate('full-bleed')`)
    await sleep(400)
    const scope = `[...document.querySelectorAll('aside[data-design-panel] section')].find((s) => s.querySelector('h4')?.textContent.trim() === 'Layout')`
    const tiles = await js(`${scope}?.querySelectorAll('[role=group][aria-label=Layout] button').length ?? 0`)
    assert(tiles === 2, `${tiles} Layout tiles, expected 2 (Split, Centered)`)
    await clickButton('Centered', scope)
    await sleep(400)
    assert((await store(`return S.getDitherState().composition.mode`)) === 'centered', 'store is not Centered')
    const groups = await js(`[...(${scope}).querySelectorAll('[role=group]')].map((g) => g.getAttribute('aria-label'))`)
    for (const want of ['Clearance', 'Rim', 'Rim motion', 'Clear round']) assert(groups.includes(want), `no ${want} control (${groups.join(', ')})`)
    await clickButton('Hug 4px', `document.querySelector('aside[data-design-panel] [role=group][aria-label=Clearance]')`)
    await sleep(200)
    assert((await store(`return S.getDitherState().edge.fullPadding`)) === 4, 'Hug did not set fullPadding 4')
    await clickButton('Split', scope)
    await sleep(300)
    assert((await store(`return S.getDitherState().composition.mode`)) === 'split', 'Split tile did not switch back')
    return groups.join(', ')
  })

  const failed = results.filter((r) => !r.ok)
  console.log(`\nsmoke: ${results.length - failed.length}/${results.length} passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  if (errors.length) console.log(`console errors seen: ${errors.length}\n  ${[...new Set(errors)].slice(0, 10).join('\n  ')}`)
  return failed.length ? 1 : 0
}

main().then(async (code) => { await viteServer?.close(); cleanup(); process.exit(code) }, (e) => {
  console.log(`FAIL  smoke harness — ${String(e.message ?? e).split('\n')[0]}`)
  cleanup()
  process.exit(1)
})
