// Counts React commits/s and main-thread busy ms/s for one URL. Numbers in
// src/components/DitherBackground/README.md come from this script.
// Usage: node measure.mjs <url> [seconds]  (Chrome with --remote-debugging-port=9333)
const [,, url, secs = '5'] = process.argv
const list = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json()
const ws = new WebSocket(list.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0; const pending = new Map(); const events = []
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id) }
  else if (msg.method === 'Tracing.dataCollected') events.push(...msg.params.value)
  else if (msg.method === 'Tracing.tracingComplete') pending.get('done')?.()
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
// Count React commits through the DevTools hook (dev builds call it per commit).
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__commits = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), inject(){ return 1 },
    onCommitFiberRoot(){ window.__commits++ }, onCommitFiberUnmount(){}, onPostCommitFiberRoot(){}, checkDCE(){} };` })
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, 4000)) // settle
const c0 = (await send('Runtime.evaluate', { expression: 'window.__commits', returnByValue: true })).result.value
await send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' })
await new Promise((r) => setTimeout(r, Number(secs) * 1000))
const c1 = (await send('Runtime.evaluate', { expression: 'window.__commits', returnByValue: true })).result.value
const done = new Promise((r) => pending.set('done', r))
await send('Tracing.end'); await done
// Renderer main thread = thread named CrRendererMain in the page's process.
const main = events.filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
const busiest = main.map((t) => ({ t, ms: events.filter((e) => e.pid === t.pid && e.tid === t.tid && e.name === 'RunTask' && e.dur).reduce((s, e) => s + e.dur, 0) / 1000 }))
  .sort((a, b) => b.ms - a.ms)[0]
const on = (e) => e.pid === busiest.t.pid && e.tid === busiest.t.tid && e.dur
const sum = (names) => events.filter((e) => on(e) && names.includes(e.name)).reduce((s, e) => s + e.dur, 0) / 1000
const s = Number(secs)
console.log(JSON.stringify({
  url, seconds: s,
  reactCommitsPerSec: +((c1 - c0) / s).toFixed(1),
  mainThreadBusyMsPerSec: +(busiest.ms / s).toFixed(1),
  scriptMsPerSec: +(sum(['FunctionCall', 'EvaluateScript', 'TimerFire', 'FireAnimationFrame']) / s).toFixed(1),
  styleLayoutMsPerSec: +(sum(['UpdateLayoutTree', 'Layout']) / s).toFixed(1),
  paintMsPerSec: +(sum(['Paint', 'PrePaint', 'Layerize']) / s).toFixed(1),
}))
ws.close()
