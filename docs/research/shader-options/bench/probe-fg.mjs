import puppeteer from '/Users/strongeron/.npm/_npx/668c188756b835f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const [,, url] = process.argv;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal','--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto(url, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 2000));
for (let i = 0; i < 20; i++) { await p.mouse.move(600 + i * 5, 300); await new Promise(r => setTimeout(r, 30)); }
const info = await p.evaluate(() => {
  const host = document.querySelector('section > div.absolute.inset-0');
  const fix = [...document.querySelectorAll('section div')].filter(d => d.style.visibility);
  return { hostMask: host?.style.maskImage?.slice(0, 40), canvases: document.querySelectorAll('canvas').length, fixVis: fix.map(d => d.style.visibility + ' clip=' + (d.style.clipPath || '').slice(0, 30) + ' mask=' + (d.style.maskImage || '').slice(0, 30)) };
});
console.log(JSON.stringify(info, null, 1));
await b.close(); process.exit(0);
