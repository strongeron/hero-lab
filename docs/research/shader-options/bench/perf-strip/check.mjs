// Checks the Design toggle and the perf strip in every view, and saves screenshots here.
// Usage: node check.mjs http://localhost:5181/hero-lab/
import puppeteer from '/Users/strongeron/.npm/_npx/668c188756b835f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'node:url';
const base = process.argv[2] ?? 'http://localhost:5181/hero-lab/';
const out = fileURLToPath(new URL('./', import.meta.url));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'load', timeout: 60000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (label) => page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === l).click(), label);
const state = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Design');
  return { panel: !!document.querySelector('[data-inspector-panel]'), pressed: d.getAttribute('aria-pressed'), disabled: d.disabled };
});
const stripText = () => page.evaluate(() => document.querySelector('section[aria-label^="Performance"]')?.innerText.replace(/\s+/g, ' ') ?? null);
const log = [];
let ok = true;
const expect = (cond, msg) => { log.push(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) ok = false; };
const VIEWS = [['live', 'Live'], ['breakpoints', 'Breakpoints'], ['templates', 'Templates'], ['layers', 'Layers']];

await wait(1500);
expect((await stripText()) === null, 'perf strip is off by default');
for (const [mode, label] of VIEWS) {
  await click(label); await wait(1200);
  const s0 = await state();
  if (mode === 'layers') { expect(s0.disabled && !s0.panel, `${mode}: Design disabled, panel hidden ${JSON.stringify(s0)}`); continue; }
  if (!s0.panel) { await click('Design'); await wait(200); }
  // Close with the panel's own X, reopen with the pill button.
  await page.click('[aria-label="Close design panel"]'); await wait(300);
  const s1 = await state();
  expect(!s1.panel && s1.pressed === 'false', `${mode}: panel closed via X ${JSON.stringify(s1)}`);
  await page.screenshot({ path: `${out}${mode}-panel-closed.png` });
  await click('Design'); await wait(300);
  const s2 = await state();
  expect(s2.panel && s2.pressed === 'true', `${mode}: panel reopened via Design ${JSON.stringify(s2)}`);
  // Shortcut closes; Design reopens.
  await page.keyboard.down('Meta'); await page.keyboard.down('Shift'); await page.keyboard.press('KeyE');
  await page.keyboard.up('Shift'); await page.keyboard.up('Meta'); await wait(300);
  const s3 = await state();
  await click('Design'); await wait(300);
  const s4 = await state();
  expect(!s3.panel && s4.panel, `${mode}: shortcut closes ${JSON.stringify(s3)}, Design reopens ${JSON.stringify(s4)}`);
}
await click('Live'); await wait(800);
await click('Perf'); await wait(2600);
// A steady 60fps page reads the same twice, so block the main thread for
// 300ms and check that the strip picks it up within a second. The block runs
// in a page task (setTimeout): Chrome does not report a CDP-evaluated script
// as a long task.
const a = await stripText();
await page.evaluate(() => { setTimeout(() => { const t = performance.now(); while (performance.now() - t < 300); }, 0); });
await wait(700); const b = await stripText();
await page.screenshot({ path: `${out}live-perf-strip-after-300ms-block.png` });
expect(!!a && a !== b && !/blocked 0ms\/s/.test(b), `perf strip shows and updates after a 300ms block\n     before: ${a}\n     after:  ${b}`);
for (const [mode, label] of VIEWS) {
  await click(label); await wait(2500);
  log.push(`     ${mode}: ${await stripText()}`);
  await page.screenshot({ path: `${out}${mode}-perf-strip.png` });
}
await page.reload({ waitUntil: 'load' }); await wait(1500);
expect(!!(await stripText()), 'perf strip state persists across reload');
await click('Perf'); await wait(300);
expect((await stripText()) === null, 'Perf button hides the strip');
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await click('Perf'); await click('Live'); await wait(2000);
await page.screenshot({ path: `${out}live-390-perf-strip.png` });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
expect(overflow <= 0, `390px: no horizontal page scroll (overflow ${overflow}px)`);
console.log(log.join('\n'));
console.log(ok ? 'ALL PASS' : 'SOME FAILED');
await browser.close(); setTimeout(() => process.exit(ok ? 0 : 1), 500);
