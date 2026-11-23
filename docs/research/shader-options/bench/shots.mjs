import puppeteer from '/Users/strongeron/.npm/_npx/668c188756b835f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const [,, base, ...pages] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const spec of pages) {
  const i = spec.indexOf('='); const name = spec.slice(0, i), path = spec.slice(i + 1);
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()) });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto(base + path, { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: name + '.png' });
  console.log(name, errs.length ? errs.slice(0, 5).join(' | ') : 'no console errors');
  await page.close();
}
browser.close(); setTimeout(() => process.exit(0), 1500);
