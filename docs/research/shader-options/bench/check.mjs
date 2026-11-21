// Visual + blink check: screenshots at rest and during a hover sweep, console errors.
// usage: node check.mjs <baseUrl> <outDir> '{"name":"path",...}'
import puppeteer from '/Users/strongeron/.npm/_npx/668c188756b835f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
const [,, base, outDir, ...scen] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const report = {};
for (const [name, path] of Object.entries(JSON.parse(scen.join(' ')))) {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 300)) });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(base + path, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: `${outDir}/${name}-rest.png` });
  // Hover: move in, then sample frames while sweeping; record the luminance
  // variance of the hover area per frame to spot blank (blink) frames.
  await page.mouse.move(500, 300);
  const samples = [];
  for (let i = 0; i < 24; i++) {
    const x = 500 + i * 18, y = 300 + Math.sin(i / 3) * 40;
    await page.mouse.move(x, y);
    await new Promise(r => setTimeout(r, 40));
    const buf = await page.screenshot({ clip: { x: x - 80, y: y - 80, width: 160, height: 160 }, encoding: 'base64' });
    samples.push(buf.length);
    if (i === 12) await page.screenshot({ path: `${outDir}/${name}-hover.png` });
  }
  report[name] = { logs, hoverShotBytes: samples };
  console.error(name, 'done', logs.length, 'logs');
  await page.close();
}
fs.writeFileSync(`${outDir}/check.json`, JSON.stringify(report, null, 2));
await browser.close(); setTimeout(() => process.exit(0), 500);
