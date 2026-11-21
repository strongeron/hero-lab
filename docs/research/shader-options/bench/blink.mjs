// Blink test: screencast frames during a slow hover sweep; for each frame,
// measure the share of "reveal colour" pixels in a box around the cursor.
// A blink = a frame mid-sweep where that share collapses vs its neighbours.
// usage: node blink.mjs <url> <r,g,b reveal colour> [tolerance]
import puppeteer from '/Users/strongeron/.npm/_npx/668c188756b835f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const [,, url, rgb, tol = '60'] = process.argv;
const target = rgb.split(',').map(Number);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 2500));
const cdp = await p.createCDPSession();
const frames = [];
let cursor = { x: 400, y: 300 };
cdp.on('Page.screencastFrame', async (f) => { frames.push({ data: f.data, cursor: { ...cursor } }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) });
await p.mouse.move(cursor.x, cursor.y);
await new Promise(r => setTimeout(r, 400));
await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
const t0 = Date.now();
while (Date.now() - t0 < 3000) {
  const k = (Date.now() - t0) / 3000;
  cursor = { x: 400 + k * 600, y: 300 + Math.sin(k * 6) * 60 };
  await p.mouse.move(cursor.x, cursor.y);
  await new Promise(r => setTimeout(r, 16));
}
await cdp.send('Page.stopScreencast');
import fs from 'node:fs';
const dir = process.env.BLINK_DIR || 'blink-frames';
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
frames.forEach((f, i) => fs.writeFileSync(`${dir}/${String(i).padStart(3, '0')}_${Math.round(f.cursor.x)}_${Math.round(f.cursor.y)}.png`, Buffer.from(f.data, 'base64')));
console.log(JSON.stringify({ frames: frames.length, dir }));
await b.close(); process.exit(0);
