// injected before page scripts
(() => {
  const S = window.__m = { ctx: { webgl: 0, webgl2: 0, '2d': 0 }, draws: 0, clears: 0, uni: 0, fill: 0, fillRect: 0, toBlob: 0, toDataURL: 0, raf: 0, styleMut: 0, maskSets: 0, canvases: new Set() };
  const gc = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakMap();
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = gc.call(this, type, ...a);
    if (c && !seen.has(this)) { seen.set(this, type); S.ctx[type] = (S.ctx[type] || 0) + 1; S.canvases.add(this); }
    return c;
  };
  for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    const d = P.drawArrays; P.drawArrays = function (...a) { S.draws++; return d.apply(this, a); };
    for (const k of Object.getOwnPropertyNames(P)) if (/^uniform/.test(k)) { const f = P[k]; P[k] = function (...a) { S.uni++; return f.apply(this, a); }; }
  }
  const C2 = CanvasRenderingContext2D.prototype;
  const f = C2.fill; C2.fill = function (...a) { S.fill++; return f.apply(this, a); };
  const fr = C2.fillRect; C2.fillRect = function (...a) { S.fillRect++; return fr.apply(this, a); };
  const tb = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function (...a) { S.toBlob++; return tb.apply(this, a); };
  const td = HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL = function (...a) { S.toDataURL++; return td.apply(this, a); };
  const r = window.requestAnimationFrame; let last = -1;
  window.requestAnimationFrame = function (cb) { return r.call(window, (t) => { if (t !== last) { last = t; S.raf++; } cb(t); }); };
  const mo = new MutationObserver((l) => { for (const m of l) { S.styleMut++; } });
  document.addEventListener('DOMContentLoaded', () => mo.observe(document, { attributes: true, attributeFilter: ['style'], subtree: true }));
  S.snap = () => {
    const live = [...document.querySelectorAll('canvas')];
    const vis = live.filter(c => c.getBoundingClientRect().width > 0);
    const gl = live.filter(c => { try { return seen.get(c) && seen.get(c) !== '2d'; } catch { return false } });
    return { draws: S.draws, uni: S.uni, fill: S.fill + S.fillRect, toBlob: S.toBlob, toDataURL: S.toDataURL, raf: S.raf, styleMut: S.styleMut,
      ctxCreated: { ...S.ctx }, domCanvases: live.length, glCanvasesInDom: gl.length, visibleCanvases: vis.length,
      glBackingPx: gl.reduce((s, c) => s + c.width * c.height, 0),
      canvasList: live.map(c => `${seen.get(c) || 'none'}:${c.width}x${c.height}`),
      iframes: document.querySelectorAll('iframe').length };
  };
})();
