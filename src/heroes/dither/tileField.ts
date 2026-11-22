/**
 * GPU tile field — the Point sizes / snapped Color/alpha tile display and the
 * Warp hover on top of it, in one WebGL2 context. See docs/adr/0001.
 *
 * Two passes per frame:
 *  1. TILE pass: a render target with ONE TEXEL PER TILE. Each texel holds the
 *     tile's dot colour + alpha (edge + clearance folded in) and dot size, for
 *     the resting field and the hover field, plus its warp shape. All the noise,
 *     hashing and text-rect distance work runs here, ~1–5k tiles, not millions
 *     of pixels.
 *  2. PIXEL pass: full canvas at native DPR. Reads its tile (and, under the
 *     warp, the 3×3 neighbours whose rotated shapes can reach it) and only
 *     evaluates rounded-rect coverage.
 *
 * The output is premultiplied and transparent outside the dots, so it composes
 * over the hero background exactly as the 2D canvas it replaces did. The maths
 * is a port of drawPointSizeCanvas / pointEdgeVisibility / fullEdgeVisibility /
 * buildWarpMask that used to live in DitherHero.tsx; this file is now their
 * reference.
 */

export const MAX_LAYERS = 8
export const MAX_RECTS = 48

export type TileEdgeMode = 'dissolve' | 'full'

export interface TileFieldLayer { color: string; opacity: number }
export interface TileRect { x: number; y: number; w: number; h: number }

export interface TileFieldSet {
  layers: TileFieldLayer[]
  /** Map scale (size/alpha noise width). */
  mapScale: number
  /** Pan of the sampled pattern, in tile units. */
  flowX: number
  flowY: number
  rotationDeg: number
}

export interface TileFieldFrame {
  /** CSS px of the canvas box. */
  w: number
  h: number
  grid: { pitch: number; gap: number; radius: number; alignX: number; alignY: number }
  /** Shared field time (maskAnimT in the hero) and colour phase. */
  t: number
  colorPhase: number
  /** Dot-size spread in [0,1] (0 = every dot is a full piece: snapped colour). */
  spread: number
  base: TileFieldSet
  fix: TileFieldSet
  edge: {
    mode: TileEdgeMode
    /** Position line in CSS px, already clamped to the solid copy top. */
    posPx: number
    dissolveDepth: number
    dissolveSeed: number
    textBlendMotion: number
    topInset: number
    fullPadding: number
  }
  rects: TileRect[]
  /** Warp hover (pixel circle of whole tiles, revealing the hover field), or
   *  null when nothing is under the cursor. */
  warp: null | {
    px: number; py: number; r: number
    rotateDeg: number; round: number; scale: number; spread: number
    basePiece: number; baseRadius: number
  }
}

const EDGE_MODE: Record<TileEdgeMode, number> = { dissolve: 4, full: 5 }

const VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0., 1.); }`

const COMMON = /* glsl */ `
float tileHash(ivec2 c, int seed) {
  uint h = uint(c.x) * 374761393u + uint(c.y) * 668265263u + uint(seed) * 2246822519u;
  h = (h ^ (h >> 13)) * 1274126177u;
  return float(h ^ (h >> 16)) / 4294967296.0;
}
float roundedBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - (halfSize - r);
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}
`

// ── Pass 1: one fragment per tile ──
const TILE_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
#define PI 3.14159265358979323846
#define MAX_LAYERS ${MAX_LAYERS}
#define MAX_RECTS ${MAX_RECTS}

uniform ivec2 u_cell0;          // (colLo, rowLo)
uniform vec2 u_size;            // css w, h
uniform float u_pitch, u_gap, u_radius;
uniform vec2 u_align;           // alignX, alignY (Top start already applied)
uniform float u_t, u_colorPhase, u_spread;

// [0] = resting field, [1] = hover field
uniform vec3 u_lc[MAX_LAYERS * 2];
uniform float u_lo[MAX_LAYERS * 2];
uniform int u_ln[2];
uniform float u_mapScale[2];
uniform vec2 u_flow[2];
uniform vec2 u_rot[2];          // cos, sin

uniform int u_edgeMode;
uniform float u_posPx, u_depthPx, u_motion, u_topInset, u_fullPad, u_rimPx;
uniform int u_seed;
uniform vec4 u_rects[MAX_RECTS];
uniform int u_nRects;

uniform bool u_warp;
uniform vec2 u_hp;
uniform float u_hr;
uniform float u_wScale, u_wRound, u_wSpread, u_basePiece, u_baseRadius;

layout(location = 0) out vec4 o_base;   // rgb + alpha
layout(location = 1) out vec4 o_fix;    // rgb + alpha
layout(location = 2) out vec4 o_piece;  // base piece / pitch, fix piece / pitch, dot radius / pitch
layout(location = 3) out vec4 o_warp;   // size / pitch, radius / pitch, inside
${COMMON}
float noiseFade(float t) { return t * t * t * (t * (t * 6. - 15.) + 10.); }
float valueNoise2(vec2 p, int seed) {
  vec2 fl = floor(p);
  ivec2 i = ivec2(fl);
  vec2 f = vec2(noiseFade(p.x - fl.x), noiseFade(p.y - fl.y));
  float a = tileHash(i, seed), b = tileHash(i + ivec2(1, 0), seed);
  float c = tileHash(i + ivec2(0, 1), seed), d = tileHash(i + ivec2(1, 1), seed);
  return a + (b - a) * f.x + (c - a + (a - b - c + d) * f.x) * f.y;
}
float fbm(vec2 p, float t, int seed) {
  return valueNoise2(p + vec2(t * .4, t * .25), seed) * .55
       + valueNoise2(p * 2.1 + vec2(t * .7, 0.), seed + 1) * .3
       + valueNoise2(p * 4.3 + vec2(0., t * .35), seed + 2) * .15;
}
float easeIO(float t) { return t * t * (3. - 2. * t); }
float clampR(float r, float piece) { return max(0., min(floor(r + .5), piece * .5)); }

float edgeMotion(ivec2 ci) {
  return u_motion > 0.
    ? (fbm(vec2(ci) * .33, u_t * .8, u_seed + 89) - .5) * u_motion * .55
    : 0.;
}

// pointEdgeVisibility
float bandVisibility(ivec2 ci, float cy) {
  float th = clamp(tileHash(ci, u_seed) + edgeMotion(ci), 0., 1.);
  float cellBottom = cy + u_pitch * .5;
  if (cellBottom <= u_posPx - u_depthPx) return 1.;
  if (cellBottom <= u_posPx) {
    float density = clamp((u_posPx - cellBottom) / u_depthPx, 0., 1.);
    return density > th ? 1. : 0.;
  }
  return 0.;
}

// fullEdgeVisibility — whole-tile text clearance with a dissolving rim.
float clearance(vec2 cell, ivec2 ci, float pad) {
  float minD = 1e9;
  vec2 c = cell + .5 * u_pitch;
  for (int i = 0; i < MAX_RECTS; i++) {
    if (i >= u_nRects) break;
    vec4 r = u_rects[i];
    vec2 a = r.xy - pad, b = r.xy + r.zw + pad;
    if (cell.x + u_pitch > a.x && cell.x < b.x && cell.y + u_pitch > a.y && cell.y < b.y) return 0.;
    vec2 d = max(max(a - c, vec2(0.)), c - b);
    minD = min(minD, length(d));
  }
  if (minD >= u_rimPx) return 1.;
  float g = minD / u_rimPx;
  float th = clamp(tileHash(ci, u_seed) + edgeMotion(ci), 0., 1.);
  return g > th ? max(.45, g) : 0.;
}

// One field's dot for this tile: rgb, alpha, piece (css px).
vec4 fieldDot(int f, ivec2 ci, float edgeAlpha, out float piece) {
  piece = 0.;
  int n = u_ln[f];
  if (n == 0 || edgeAlpha <= 0.) return vec4(0.);
  vec2 cr = vec2(ci);
  vec2 s = vec2(cr.x * u_rot[f].x - cr.y * u_rot[f].y, cr.x * u_rot[f].y + cr.y * u_rot[f].x);
  vec2 fc = s + u_flow[f];
  float width = clamp(u_mapScale[f], .4, 3.);
  float t = u_t;
  // tileSizeMapValue
  float organic = fbm(fc * (.095 / width), t * .8, 2401);
  float wave = .5 + .5 * sin(fc.x * .33 + fc.y * .21 + t * PI * 2. * .55);
  float sizeV = .18 + .82 * easeIO(clamp(organic * .72 + wave * .28, 0., 1.));
  // tilePointAlpha
  float an = fbm(fc * (.08 / width) + vec2(19., -7.), t * .55, 3119);
  float aw = .5 + .5 * sin(fc.x * .16 - fc.y * .27 + t * PI * 1.2);
  float alphaV = clamp(an * .65 + aw * .35, 0., 1.);
  // scaledGridPiece
  float maxPiece = u_pitch - u_gap;
  float minScale = u_spread <= 0. ? 1. : max(u_gap / max(1., maxPiece), 1. - min(1., u_spread));
  piece = maxPiece * (minScale + (1. - minScale) * sizeV);
  if (piece < .5) { piece = 0.; return vec4(0.); }
  // Colour: interpolate neighbouring layers as the phase advances.
  float fn = float(n);
  float pos = mod(tileHash(ci, 701) * fn + u_colorPhase * fn, fn);
  int li = int(floor(pos));
  int ni = li + 1 == n ? 0 : li + 1;
  float m = easeIO(pos - float(li));
  int base = f * MAX_LAYERS;
  vec3 col = mix(u_lc[base + li], u_lc[base + ni], m);
  float op = mix(u_lo[base + li], u_lo[base + ni], m);
  return vec4(col, clamp((.28 + alphaV * .72) * op * edgeAlpha, 0., .95));
}

// Pixel circle: a tile is in when its centre is inside the radius, snapped to
// whole tile rings (pixelCircleRadius in DitherHero).
bool inHover(vec2 tc) {
  return distance(tc, u_hp) <= floor(u_hr / u_pitch + .5) * u_pitch;
}

void main() {
  ivec2 ci = ivec2(gl_FragCoord.xy) + u_cell0;
  vec2 cell = u_align + vec2(ci) * u_pitch;
  o_base = vec4(0.); o_fix = vec4(0.); o_piece = vec4(0.); o_warp = vec4(0.);

  // Warp shape — every tile, rows are not culled (buildWarpMask).
  vec2 tc = cell + .5 * u_pitch;
  float baseRound = clampR(u_baseRadius, u_basePiece);
  if (u_warp && inHover(tc)) {
    float maxSz = u_basePiece * clamp(u_wScale, 0., 1.);
    float sz = maxSz;
    float sp = min(1.5, u_wSpread);
    if (sp > 0.) {
      float minSz = maxSz * max(0., 1. - min(1.5, sp));
      float u = pow(tileHash(ci, 1337), 1. / (1. + sp * 1.25));
      sz = minSz + (maxSz - minSz) * u;
    }
    float targetRound = baseRound + clamp(u_wRound, 0., 1.) * (u_basePiece * .5 - baseRound);
    float desired = maxSz > 0. ? baseRound + (targetRound - baseRound) * (sz / maxSz) : baseRound;
    o_warp = vec4(sz / u_pitch, clampR(desired, sz) / u_pitch, 1., 0.);
  } else {
    o_warp = vec4(u_basePiece / u_pitch, clampR(baseRound, u_basePiece) / u_pitch, 0., 0.);
  }

  // Whole shapes only: drop rows above Top start and rows cut by the bottom.
  if (u_topInset > 0. && cell.y < u_topInset - .5) return;
  if (cell.y + u_pitch > u_size.y + .5) return;

  float edgeAlpha;
  if (u_edgeMode == 5) {
    edgeAlpha = u_nRects > 0 ? clearance(cell, ci, u_fullPad) : 1.;
  } else {
    edgeAlpha = bandVisibility(ci, cell.y + .5 * u_pitch);
  }
  float pb, pf;
  o_base = fieldDot(0, ci, edgeAlpha, pb);
  o_fix = fieldDot(1, ci, edgeAlpha, pf);
  float rb = clampR(u_radius, pb);
  o_piece = vec4(pb / u_pitch, pf / u_pitch, rb / u_pitch, clampR(u_radius, pf) / u_pitch);
}`

// ── Pass 2: per pixel ──
const PIXEL_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_base, u_fix, u_piece, u_warpTex;
uniform ivec2 u_cell0, u_cells;
uniform vec2 u_res;
uniform float u_dpr, u_pitch;
uniform vec2 u_align;
uniform bool u_warp;
uniform vec2 u_wRot;            // cos, sin of the warp rotation
uniform vec2 u_hp;              // warp centre, css px (same as pass 1)
uniform float u_hr;             // warp radius, css px
out vec4 o;
${COMMON}
// Pixel alignment: a piece is a whole number of device pixels with the same
// parity as the pitch, so a piece centred in its cell has every edge on a
// pixel boundary (no half-pixel blur). Sizes arrive 8-bit quantised from
// pass 1, so they are snapped here, after decoding.
float snapPiece(float piece) {
  float p = floor(u_pitch * u_dpr + .5);
  float s = floor(piece * u_dpr + .5);
  s -= mod(p - s, 2.);
  return max(0., s) / u_dpr;
}
float cover(vec2 p, float piece, float r) {
  piece = snapPiece(piece);
  if (piece <= 0.) return 0.;
  return clamp(.5 - roundedBox(p, vec2(piece * .5), floor(r + .5)) * u_dpr, 0., 1.);
}
void main() {
  vec2 css = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;
  vec2 g = (css - u_align) / u_pitch;
  ivec2 ci = ivec2(floor(g));
  ivec2 tx = ci - u_cell0;
  if (tx.x < 0 || tx.y < 0 || tx.x >= u_cells.x || tx.y >= u_cells.y) { o = vec4(0.); return; }
  vec2 local = (fract(g) - .5) * u_pitch;

  vec4 pc = texelFetch(u_piece, tx, 0) * u_pitch;
  vec4 b = texelFetch(u_base, tx, 0);
  float cb = cover(local, pc.x, pc.z);
  vec4 base = vec4(b.rgb, 1.) * b.a * cb;

  if (!u_warp) { o = base; return; }
  vec4 f = texelFetch(u_fix, tx, 0);
  vec4 fixv = vec4(f.rgb, 1.) * f.a * cover(local, pc.y, pc.w);

  // Far from the cursor no tile in the 3×3 block is a warp tile (pass 1 marks
  // a tile when its centre is within the snapped radius R). A neighbour's
  // centre is at most pitch·√2 from this tile's centre, so beyond R + 1.5
  // pitch every neighbour keeps its resting shape, which never reaches past
  // its own cell. The 3×3 union then equals this tile's own shape: one fetch
  // instead of nine, with the same pixels.
  vec2 tc = u_align + (vec2(ci) + .5) * u_pitch;
  if (distance(tc, u_hp) > floor(u_hr / u_pitch + .5) * u_pitch + 1.5 * u_pitch) {
    vec4 w = texelFetch(u_warpTex, tx, 0);
    float sz = w.x * u_pitch;
    o = sz < .5 ? vec4(0.) : base * cover(local, sz, w.y * u_pitch);
    return;
  }

  // Warp masks: union of the 3×3 neighbourhood's (rotated) tile shapes.
  float mb = 0., ms = 0.;
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    ivec2 n = tx + ivec2(dx, dy);
    if (n.x < 0 || n.y < 0 || n.x >= u_cells.x || n.y >= u_cells.y) continue;
    vec4 w = texelFetch(u_warpTex, n, 0);
    vec2 p = local - vec2(dx, dy) * u_pitch;
    if (w.z > .5) p = vec2(p.x * u_wRot.x + p.y * u_wRot.y, -p.x * u_wRot.y + p.y * u_wRot.x);
    float sz = w.x * u_pitch;
    if (sz < .5) continue;
    float c = cover(p, sz, w.y * u_pitch);
    mb = max(mb, c);
    if (w.z > .5) ms = max(ms, c);
  }
  o = mix(base, fixv, ms) * mb;
}`

function hexToRgb(color: string): [number, number, number] {
  const raw = color.startsWith('#') ? color.slice(1) : color
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (!/^[0-9a-f]{6}$/i.test(full)) return [0, 0, 0]
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || (gl.isContextLost() ? 'context lost' : 'shader compile failed'))
  return s
}

function link(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag))
  gl.bindAttribLocation(p, 0, 'a_pos')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'program link failed')
  return p
}

type Uniforms = Record<string, WebGLUniformLocation | null>
function locations(gl: WebGL2RenderingContext, p: WebGLProgram): Uniforms {
  const out: Uniforms = {}
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)
    if (!info) continue
    const name = info.name.replace(/\[0\]$/, '')
    out[name] = gl.getUniformLocation(p, info.name)
  }
  return out
}

/** One canvas, one WebGL2 context, two draws per frame. Throws if WebGL2 is
 *  unavailable; the caller shows the plain hero background instead. */
export class TileFieldRenderer {
  readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private tileProg: WebGLProgram
  private pixelProg: WebGLProgram
  private tu: Uniforms
  private pu: Uniforms
  private fbo: WebGLFramebuffer
  private vbo: WebGLBuffer | null = null
  private tex: WebGLTexture[]
  private texSize = [0, 0]
  private vao: WebGLVertexArrayObject
  private lc = new Float32Array(MAX_LAYERS * 2 * 3)
  private lo = new Float32Array(MAX_LAYERS * 2)
  private rects = new Float32Array(MAX_RECTS * 4)
  private colorCache = new Map<string, [number, number, number]>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true })
    if (!gl) throw new Error('WebGL2 unavailable')
    this.gl = gl
    this.tileProg = link(gl, TILE_FRAG)
    this.pixelProg = link(gl, PIXEL_FRAG)
    this.tu = locations(gl, this.tileProg)
    this.pu = locations(gl, this.pixelProg)

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    this.vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    this.fbo = gl.createFramebuffer()!
    this.tex = [0, 1, 2, 3].map(() => {
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return t
    })
  }

  get contextLost(): boolean { return this.gl.isContextLost() }

  private rgb(color: string): [number, number, number] {
    let v = this.colorCache.get(color)
    if (!v) { v = hexToRgb(color); this.colorCache.set(color, v) }
    return v
  }

  private ensureTiles(cols: number, rows: number) {
    const gl = this.gl
    if (this.texSize[0] === cols && this.texSize[1] === rows) return
    this.texSize = [cols, rows]
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    this.tex.forEach((t, i) => {
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0)
    })
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3])
  }

  render(f: TileFieldFrame, dpr: number): void {
    const gl = this.gl
    if (gl.isContextLost() || f.w <= 0 || f.h <= 0) return
    const cw = Math.max(1, Math.round(f.w * dpr))
    const ch = Math.max(1, Math.round(f.h * dpr))
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw
      this.canvas.height = ch
    }
    const { pitch, gap, radius, alignX, alignY } = f.grid
    const colLo = Math.floor(-alignX / pitch) - 1
    const colHi = Math.ceil((f.w - alignX) / pitch) + 1
    const rowLo = Math.floor(-alignY / pitch) - 1
    const rowHi = Math.ceil((f.h - alignY) / pitch) + 1
    const cols = colHi - colLo + 1
    const rows = rowHi - rowLo + 1
    this.ensureTiles(cols, rows)
    gl.bindVertexArray(this.vao)

    // ── Pass 1: tiles ──
    const u = this.tu
    gl.useProgram(this.tileProg)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.viewport(0, 0, cols, rows)
    gl.uniform2i(u.u_cell0, colLo, rowLo)
    gl.uniform2f(u.u_size, f.w, f.h)
    gl.uniform1f(u.u_pitch, pitch)
    gl.uniform1f(u.u_gap, Math.max(0, Math.min(gap, pitch - 1)))
    gl.uniform1f(u.u_radius, radius)
    gl.uniform2f(u.u_align, alignX, alignY)
    gl.uniform1f(u.u_t, f.t)
    gl.uniform1f(u.u_colorPhase, f.colorPhase)
    gl.uniform1f(u.u_spread, Math.max(0, Math.min(1, f.spread)) * 0.65)

    const sets = [f.base, f.fix]
    const ln = [0, 0]
    const ms = [0, 0]
    const flow = [0, 0, 0, 0]
    const rot = [1, 0, 1, 0]
    this.lc.fill(0)
    this.lo.fill(0)
    sets.forEach((s, k) => {
      const live = s.layers.filter((l) => l.opacity > 0).slice(0, MAX_LAYERS)
      ln[k] = live.length
      live.forEach((l, i) => {
        this.lc.set(this.rgb(l.color), (k * MAX_LAYERS + i) * 3)
        this.lo[k * MAX_LAYERS + i] = l.opacity
      })
      ms[k] = s.mapScale
      flow[k * 2] = s.flowX
      flow[k * 2 + 1] = s.flowY
      const r = s.rotationDeg * Math.PI / 180
      rot[k * 2] = Math.cos(r)
      rot[k * 2 + 1] = Math.sin(r)
    })
    gl.uniform3fv(u.u_lc, this.lc)
    gl.uniform1fv(u.u_lo, this.lo)
    gl.uniform1iv(u.u_ln, ln)
    gl.uniform1fv(u.u_mapScale, ms)
    gl.uniform2fv(u.u_flow, flow)
    gl.uniform2fv(u.u_rot, rot)

    const e = f.edge
    const rim = Math.max(pitch, Math.round(e.dissolveDepth) * pitch)
    gl.uniform1i(u.u_edgeMode, EDGE_MODE[e.mode])
    gl.uniform1f(u.u_posPx, e.posPx)
    gl.uniform1f(u.u_depthPx, rim)
    gl.uniform1f(u.u_motion, e.textBlendMotion)
    gl.uniform1f(u.u_topInset, e.topInset)
    gl.uniform1f(u.u_fullPad, e.fullPadding)
    gl.uniform1f(u.u_rimPx, rim)
    gl.uniform1i(u.u_seed, e.dissolveSeed | 0)
    const n = Math.min(MAX_RECTS, f.rects.length)
    for (let i = 0; i < n; i++) {
      const r = f.rects[i]
      this.rects.set([r.x, r.y, r.w, r.h], i * 4)
    }
    gl.uniform4fv(u.u_rects, this.rects)
    gl.uniform1i(u.u_nRects, n)

    const w = f.warp
    gl.uniform1i(u.u_warp, w ? 1 : 0)
    if (w) {
      gl.uniform2f(u.u_hp, w.px, w.py)
      gl.uniform1f(u.u_hr, w.r)
      gl.uniform1f(u.u_wScale, w.scale)
      gl.uniform1f(u.u_wRound, w.round)
      gl.uniform1f(u.u_wSpread, w.spread)
      gl.uniform1f(u.u_basePiece, w.basePiece)
      gl.uniform1f(u.u_baseRadius, w.baseRadius)
    } else {
      gl.uniform1f(u.u_basePiece, pitch - Math.max(0, Math.min(gap, pitch - 1)))
      gl.uniform1f(u.u_baseRadius, radius)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // ── Pass 2: pixels ──
    const p = this.pu
    gl.useProgram(this.pixelProg)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, cw, ch)
    this.tex.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, t)
    })
    gl.uniform1i(p.u_base, 0)
    gl.uniform1i(p.u_fix, 1)
    gl.uniform1i(p.u_piece, 2)
    gl.uniform1i(p.u_warpTex, 3)
    gl.uniform2i(p.u_cell0, colLo, rowLo)
    gl.uniform2i(p.u_cells, cols, rows)
    gl.uniform2f(p.u_res, cw, ch)
    gl.uniform1f(p.u_dpr, cw / f.w)
    gl.uniform1f(p.u_pitch, pitch)
    gl.uniform2f(p.u_align, alignX, alignY)
    gl.uniform1i(p.u_warp, w ? 1 : 0)
    if (w) {
      const r = w.rotateDeg * Math.PI / 180
      gl.uniform2f(p.u_wRot, Math.cos(r), Math.sin(r))
      gl.uniform2f(p.u_hp, w.px, w.py)
      gl.uniform1f(p.u_hr, w.r)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteBuffer(this.vbo)
    this.tex.forEach((t) => gl.deleteTexture(t))
    gl.deleteFramebuffer(this.fbo)
    gl.deleteProgram(this.tileProg)
    gl.deleteProgram(this.pixelProg)
    gl.deleteVertexArray(this.vao)
    // No loseContext(): React (StrictMode, remounts) can hand the same canvas
    // to a new renderer, and a lost context cannot compile. The context is
    // freed with the canvas element; glEpoch remounts give a fresh element.
  }
}
