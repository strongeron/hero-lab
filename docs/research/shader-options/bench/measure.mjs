import puppeteer from '/Users/strongeron/.npm/_npx/668c188756b835f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
const inst = fs.readFileSync(new URL('./instrument.js', import.meta.url), 'utf8');
const [,, base, outFile, ...scen] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const results = {};
const scenarios = JSON.parse(scen.join(' '));
for (const [name, path] of Object.entries(scenarios)) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(inst);
  // also instrument iframes: evaluateOnNewDocument applies to all frames
  const cdp = await page.createCDPSession(); await cdp.send('Performance.enable');
  await page.goto(base + path, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  const renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
  const frameSnap = async () => { const out = []; for (const f of page.frames()) { try { out.push(await f.evaluate(() => window.__m && window.__m.snap())); } catch { out.push(null); } } return out.filter(Boolean); };
  const metr = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const window_ = async (label, fn) => {
    const a = await frameSnap(); const ma = await metr(); const t0 = Date.now();
    await fn(); const dt = (Date.now() - t0) / 1000;
    const b = await frameSnap(); const mb = await metr();
    const sum = (arr, k) => arr.reduce((s, x) => s + (x[k] || 0), 0);
    const rate = k => +((sum(b, k) - sum(a, k)) / dt).toFixed(1);
    return { label, seconds: +dt.toFixed(2), frames: b.length,
      fps_raf: +((b[0].raf - a[0].raf) / dt).toFixed(1),
      glDrawsPerSec: rate('draws'), uniformCallsPerSec: rate('uni'), canvas2dFillsPerSec: rate('fill'), toBlobPerSec: rate('toBlob'), toDataURLPerSec: rate('toDataURL'), styleMutationsPerSec: rate('styleMut'),
      glContextsCreatedTotal: b.reduce((s, x) => s + (x.ctxCreated.webgl || 0) + (x.ctxCreated.webgl2 || 0), 0) - 0,
      ctx2dCreatedTotal: sum(b.map(x => ({ v: x.ctxCreated['2d'] || 0 })), 'v'),
      glCanvasesInDom: sum(b, 'glCanvasesInDom'), domCanvases: sum(b, 'domCanvases'), glBackingMPx: +(sum(b, 'glBackingPx') / 1e6).toFixed(2),
      canvasList: b.map(x => x.canvasList),
      mainThread_ms_per_s: { script: +(((mb.ScriptDuration - ma.ScriptDuration) * 1000) / dt).toFixed(0), task: +(((mb.TaskDuration - ma.TaskDuration) * 1000) / dt).toFixed(0), style: +(((mb.RecalcStyleDuration - ma.RecalcStyleDuration) * 1000) / dt).toFixed(0), layout: +(((mb.LayoutDuration - ma.LayoutDuration) * 1000) / dt).toFixed(0) } };
  };
  const idle = await window_('idle', () => new Promise(r => setTimeout(r, 3000)));
  const hover = await window_('hover-sweep', async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 3000) { const k = (Date.now() - t0) / 3000 * Math.PI * 4; await page.mouse.move(720 + Math.cos(k) * 450, 380 + Math.sin(k) * 220); await new Promise(r => setTimeout(r, 16)); }
  });
  results[name] = { path, renderer, idle, hover };
  console.error(name, 'done');
  await page.close();
}
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
browser.close(); setTimeout(() => process.exit(0), 1500);
