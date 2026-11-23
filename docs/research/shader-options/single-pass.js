// Single-pass dither field: every colour layer, the pixel-grid tile mask, the
// text clearance and the hover reveal in ONE fragment shader, ONE WebGL2
// context, ONE draw per frame. Throwaway research prototype.
//
// The dither-shape code inside paperDither() is adapted from Paper Shaders'
// dithering fragment shader, @paper-design/shaders 0.0.82, Apache-2.0,
// Copyright Lost Coast Labs, Inc. — https://github.com/paper-design/shaders
// (byte-identical to the 0.0.71 shader the lab ships). The point-field code is
// a GLSL port of drawPointSizeCanvas / tileSizeMapValue / tilePointAlpha /
// fbmNoise / tileThreshold from src/heroes/dither/DitherHero.tsx.

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 u_resolution;   // backing px
uniform float u_pixelRatio;  // backing px per CSS px (Paper's renderScale)
uniform float u_time;        // Paper time (seconds * speed)
uniform float u_tileT;       // point-field time (maskAnimT in the lab)
uniform int u_mode;          // 0 = Color/alpha (Paper dither), 1 = Point sizes
uniform bool u_grid;
uniform vec3 u_colorBack;
uniform vec3 u_problem[3];
uniform vec3 u_fix[3];
uniform float u_opacity[3];
uniform float u_shapeP[3];
uniform float u_shapeF[3];
uniform vec2 u_drift;
uniform float u_spread;
uniform float u_pxSize, u_type, u_scale, u_rotation, u_fit;
uniform float u_pitch, u_gap, u_radius;
uniform vec3 u_mouse;        // css x, css y, radius (css px)
uniform vec4 u_rects[16];    // text line boxes, css px, top-left origin
uniform int u_nRects;
uniform float u_pad, u_rim;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

// ---- Paper Shaders helpers (Apache-2.0) ----
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float hash11(float p) { p = fract(p * 0.3183099) + 0.1; p *= p + 19.19; return fract(p * p); }
float getSimplexNoise(vec2 uv, float t) { return .5 * snoise(uv - vec2(0., .3 * t)) + .5 * snoise(2. * uv + vec2(0., .32 * t)); }
const int bayer8x8[64] = int[64](0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21);
const int bayer4x4[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;
  if (size == 4) return float(bayer4x4[index]) / 16.0;
  return float(bayer8x8[index]) / 64.0;
}

// One Paper <Dithering> layer, colorBack black: returns the 0/1 dither bit.
float paperDither(float shapeId, vec2 origin, vec2 offset) {
  float t = .5 * u_time;
  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = (gl_FragCoord.xy - .5 * u_resolution) / pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 shapeUV = canvasPixelizedUV / u_resolution;

  vec2 boxOrigin = vec2(.5 - origin.x, origin.y - .5);
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 boxSize = u_resolution; // worldWidth = worldHeight = 0
  if (shapeId > 3.5) {
    float objX = min(boxSize.x, boxSize.y);
    if (u_fit == 1.) objX = min(u_resolution.x, u_resolution.y);
    else if (u_fit == 2.) objX = max(u_resolution.x, u_resolution.y);
    vec2 objectWorldScale = u_resolution.xy / vec2(objX);
    shapeUV *= objectWorldScale;
    shapeUV += boxOrigin * (objectWorldScale - 1.);
    shapeUV += vec2(-offset.x, offset.y);
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
  } else {
    // Paper: givenBoxSize = max(vec2(worldW, worldH), 1) * pixelRatio → ratio 1,
    // then boxSize = resolution because world sizes are 0.
    float ratio = 1.;
    vec2 pb;
    pb.x = ratio * min(boxSize.x / ratio, boxSize.y);
    float noFit = pb.x;
    if (u_fit == 1.) pb.x = ratio * min(u_resolution.x / ratio, u_resolution.y);
    else if (u_fit == 2.) pb.x = ratio * max(u_resolution.x / ratio, u_resolution.y);
    pb.y = pb.x / ratio;
    vec2 patternWorldScale = u_resolution.xy / pb;
    shapeUV += vec2(-offset.x, offset.y) / patternWorldScale;
    shapeUV += boxOrigin;
    shapeUV -= boxOrigin / patternWorldScale;
    shapeUV *= u_resolution.xy;
    shapeUV /= u_pixelRatio;
    if (u_fit > 0.) shapeUV *= (noFit / pb.x);
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
    shapeUV += boxOrigin / patternWorldScale;
    shapeUV -= boxOrigin;
    shapeUV += .5;
  }

  float shape = 0.;
  if (shapeId < 1.5) {
    shapeUV *= .001;
    shape = smoothstep(0.3, 0.9, 0.5 + 0.5 * getSimplexNoise(shapeUV, t));
  } else if (shapeId < 2.5) {
    shapeUV *= .003;
    for (float i = 1.0; i < 6.0; i++) {
      shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
      shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
    }
    shape = smoothstep(0.02, 1., .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x))));
  } else if (shapeId < 3.5) {
    shapeUV *= .05;
    float stripeIdx = floor(2. * shapeUV.x / TWO_PI);
    float rand = hash11(stripeIdx * 10.);
    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
    shape = pow(abs(sin(shapeUV.x) * cos(shapeUV.y - 5. * rand * t)), 6.);
  } else if (shapeId < 4.5) {
    shapeUV *= 4.;
    float wave = cos(.5 * shapeUV.x - 2. * t) * sin(1.5 * shapeUV.x + t) * (.75 + .25 * cos(3. * t));
    shape = 1. - smoothstep(-1., 1., shapeUV.y + wave);
  } else {
    float l = length(shapeUV);
    float angle = 6. * atan(shapeUV.y, shapeUV.x) + 4. * t;
    float offs = 1. / pow(max(l, 1e-6), 1.2) + angle / TWO_PI;
    shape = mix(0., fract(offs), smoothstep(0., 1., pow(l, 1.2)));
  }
  float dithering = getBayerValue(pxSizeUV, u_type > 3.5 ? 8 : 4) - .5;
  return step(.5, shape + dithering);
}

// ---- Lab point-field helpers (port of DitherHero.tsx) ----
float tileHash(ivec2 c, int seed) {
  uint h = uint(c.x) * 374761393u + uint(c.y) * 668265263u + uint(seed) * 2246822519u;
  h = (h ^ (h >> 13)) * 1274126177u;
  return float(h ^ (h >> 16)) / 4294967296.0;
}
// Ported as the lab has it (DitherHero.tsx:133 uses '+ 1'; Perlin's quintic
// fade is '+ 10'). Kept for look parity — see the review doc.
uniform bool u_fadeFix;
float noiseFade(float t) { return t * t * t * (t * (t * 6. - 15.) + (u_fadeFix ? 10. : 1.)); }
float valueNoise2(vec2 p, int seed) {
  ivec2 i = ivec2(floor(p));
  vec2 f = vec2(noiseFade(fract(p.x)), noiseFade(fract(p.y)));
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

float roundedBox(vec2 p, float halfSize, float r) {
  vec2 q = abs(p) - vec2(halfSize - r);
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}

// Whole-tile text clearance + dissolve rim ('full' edge mode).
float textVisibility(vec2 cell, ivec2 ci) {
  float minD = 1e9;
  vec2 c = cell + .5 * u_pitch;
  for (int i = 0; i < 16; i++) {
    if (i >= u_nRects) break;
    vec4 r = u_rects[i];
    vec2 a = r.xy - u_pad, b = r.xy + r.zw + u_pad;
    if (cell.x + u_pitch > a.x && cell.x < b.x && cell.y + u_pitch > a.y && cell.y < b.y) return 0.;
    vec2 d = max(max(a - c, vec2(0.)), c - b);
    minD = min(minD, length(d));
  }
  if (minD >= u_rim) return 1.;
  float g = minD / u_rim;
  float th = clamp(tileHash(ci, 7) + (fbm(vec2(ci) * .33, u_tileT * .8, 96) - .5) * .55, 0., 1.);
  return g > th ? max(.45, g) : 0.;
}

void main() {
  vec2 css = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_pixelRatio;
  ivec2 ci = ivec2(floor(css / u_pitch));
  vec2 cell = vec2(ci) * u_pitch;
  vec2 local = css - cell - .5 * u_pitch;
  float aa = 1. / u_pixelRatio;

  // Hover: whole tiles whose centre sits inside the radius flip to the fix state.
  bool inHover = distance(cell + .5 * u_pitch, u_mouse.xy) <= u_mouse.z;

  vec3 col = u_colorBack;
  if (u_mode == 0) {
    // Color/alpha: three Paper layers, screen-blended at their opacities
    // exactly as CSS opacity + mix-blend-mode: screen composites them.
    for (int i = 0; i < 3; i++) {
      float s = u_spread * float(i);
      vec2 origin = vec2(.5 + s * .8, .5 + s * .6);
      vec2 offset = u_drift + vec2(s * 2., s * 1.5);
      float bit = paperDither(inHover ? u_shapeF[i] : u_shapeP[i], origin, offset);
      vec3 front = (inHover ? u_fix[i] : u_problem[i]) * bit;
      col += u_opacity[i] * front * (1. - col);
    }
    if (u_grid) {
      float piece = u_pitch - u_gap;
      float cover = clamp(.5 - roundedBox(local, piece * .5, min(u_radius, piece * .5)) / aa, 0., 1.);
      col = mix(u_colorBack, col, cover);
    }
  } else {
    // Point sizes: one rounded dot per tile, size/alpha from the lab's fbm map.
    float vis = textVisibility(cell, ci);
    if (vis > 0.) {
      vec2 fc = vec2(ci);
      float t = u_tileT;
      float organic = fbm(fc * .095, t * .8, 2401);
      float wave = .5 + .5 * sin(fc.x * .33 + fc.y * .21 + t * PI * 2. * .55);
      float sizeV = .18 + .82 * easeIO(clamp(organic * .72 + wave * .28, 0., 1.));
      float n = fbm(fc * .08 + vec2(19., -7.), t * .55, 3119);
      float alphaV = clamp(n * .65 + (.5 + .5 * sin(fc.x * .16 - fc.y * .27 + t * PI * 1.2)) * .35, 0., 1.);
      float maxPiece = u_pitch - u_gap;
      float spread = .55 * .65;
      float minScale = max(u_gap / maxPiece, 1. - spread);
      float piece = maxPiece * (minScale + (1. - minScale) * sizeV);
      float layerPos = mod(tileHash(ci, 701) * 3. + u_time * .4, 3.);
      int li = int(floor(layerPos)) % 3, ni = (li + 1) % 3;
      float m = easeIO(fract(layerPos));
      vec3 ca = inHover ? u_fix[li] : u_problem[li];
      vec3 cb = inHover ? u_fix[ni] : u_problem[ni];
      float op = mix(u_opacity[li], u_opacity[ni], m);
      float a = clamp((.28 + alphaV * .72) * op * vis, 0., .95);
      float cover = clamp(.5 - roundedBox(local, piece * .5, min(u_radius, piece * .5)) / aa, 0., 1.);
      col = mix(u_colorBack, mix(ca, cb, m), a * cover);
    }
  }
  fragColor = vec4(col, 1.);
}`

export const VERT = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`
