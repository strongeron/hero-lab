import { useSyncExternalStore } from "react";
import { getThemeById } from "../../themes/terminalThemes";

/* ─── Types ─── */

export type DitheringShape =
  | "simplex"
  | "warp"
  | "dots"
  | "wave"
  | "ripple"
  | "swirl"
  | "sphere";
export type DitheringType = "random" | "2x2" | "4x4" | "8x8";
export type ShaderFit = "none" | "contain" | "cover";

export interface DitherAlphaLayer {
  color: string;
  opacity: number;
  shape: DitheringShape;
}

export type HeaderBgMode = "transparent" | "solid";
/** How the shader meets the text section */
/** 'full' fills the whole hero with scene shapes and carves whole-tile
 *  exclusion zones around the text/CTA blocks with a dissolve rim. */
export type EdgeMode = "fade" | "sharp" | "overlap" | "ripple" | "dissolve" | "full";

/* ─── Copy Variations ─── */

/**
 * 'problem' — Pink headline declares the problem (left), italic response + sub + CTA (right)
 * 'solution' — Teal headline IS the solution (left), sub + CTA (right), no italic response
 */
export type CopyLayout = "problem" | "solution";
export type DitherCopyColorMode = "current" | "white";

export interface DitherCopy {
  layout: CopyLayout;
  headline: string;
  sub: string | null;
  response: string | null;
  cta: string;
  /** CSS font-family override for headline (omit = use DesignPanel font pair) */
  headlineFont?: string;
  /** CSS font-weight override */
  headlineWeight?: number;
  /** Responsive font-size via clamp() — overrides default Tailwind sizes */
  headlineSize?: string;
  /** CSS letter-spacing override */
  headlineTracking?: string;
  /** CSS line-height override for headline */
  headlineLeading?: string;
  /** Headline text color mode */
  headlineColorMode?: DitherCopyColorMode;
  /** CSS font-family override for response text (omit = use DesignPanel font pair) */
  responseFont?: string;
  /** Response text size override */
  responseSize?: string;
  /** CSS line-height override for response */
  responseLeading?: string;
  /** Response text color mode */
  responseColorMode?: DitherCopyColorMode;
  /** CSS font-style override for response (e.g. 'italic') */
  responseFontStyle?: string;
  /** CSS font-weight override for response */
  responseWeight?: number;
  /** CSS letter-spacing override for response */
  responseTracking?: string;
  /** Show a bubble/pill background behind response text */
  responseBubble?: boolean;
  /** Corner radius for response bubble (e.g. '12px', '24px', '999px') */
  responseBubbleRadius?: string;
  /** Background color/opacity for response bubble */
  responseBubbleColor?: string;
  /** Show a separator between headline and response */
  responseSeparator?: 'none' | 'line' | 'dots' | 'fade';
  /** Use 'headline' as a special font mode: same font family as headline */
  responseFontMode?: 'custom' | 'headline';
}

export type CopyVariantId =
  | "provocateur"
  | "value"
  | "ship-it"
  | "ai"
  | "speed"
  | "broke-fixed"
  | "duck"
  | "wtf";

export const copyVariants: Record<CopyVariantId, DitherCopy & { label: string }> =
  {
    provocateur: {
      label: "Provocateur",
      layout: "problem",
      headline: "Every error tells a\u00A0story. Most tools miss the\u00A0plot.",
      sub: "Errors, performance, and logs in one place. Five-minute install. No credit card.",
      response: "We read every line.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      headlineWeight: 500,
      headlineSize: "clamp(3rem, 5vw + 1rem, 5.5rem)",
      headlineLeading: "1.1",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
    value: {
      label: "Value",
      layout: "problem",
      headline: "One tool. Every\u00A0signal.",
      sub: "Errors, performance, and logs — one place, one bill. Set up in five minutes.",
      response: "Your CFO will thank\u00A0you.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      headlineFont: "'Bricolage Grotesque', sans-serif",
      headlineWeight: 500,
      headlineSize: "clamp(3.5rem, 5.5vw + 1rem, 6rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
    "ship-it": {
      label: "Ship It",
      layout: "problem",
      headline: "Ship it. We're watching.",
      sub: "Every deploy tracked. Every error caught. Every slowdown flagged — before your users notice. Five minutes to\u00A0install.",
      response: "Know what broke before anyone else\u00A0does.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      headlineFont: "'Space Grotesk', sans-serif",
      headlineWeight: 500,
      headlineSize: "clamp(4rem, 6vw + 1rem, 7rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
    ai: {
      label: "AI",
      layout: "problem",
      headline: "Your AI built the app. Who's watching it\u00A0run?",
      sub: "Errors, performance, and logs in one place. Query it in plain language. No dashboard required.",
      response: "We speak AI\u00A0too.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      headlineWeight: 500,
      headlineSize: "clamp(3rem, 5vw + 1rem, 5.5rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
    speed: {
      label: "Speed",
      layout: "problem",
      headline: "Errors fall. We catch.",
      sub: "Every exception, every slowdown, every log line — one place. Five-minute install. No credit card.",
      response: "See everything. Fix it\u00A0fast.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      headlineFont: "'Cabinet Grotesk', sans-serif",
      headlineWeight: 500,
      headlineSize: "clamp(3rem, 5vw + 1rem, 5.5rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
    "broke-fixed": {
      label: "Broke / Fixed",
      layout: "problem",
      headline: "Something broke. You should already know what.",
      sub: "Errors, performance, and logs — one place. Five-minute install.",
      response: "Caught everything. Start at line\u00A042.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      // Geist Mono over JetBrains: same terminal voice, but circular bowls and
      // round dots that echo the point-field geometry instead of fighting it.
      headlineFont: "'Geist Mono', monospace",
      headlineWeight: 500,
      headlineSize: "clamp(2.8rem, 4vw + 1rem, 4.5rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
    duck: {
      label: "What the Duck",
      layout: "problem",
      headline: "What the duck just happened?",
      sub: "Errors, performance, and logs — one place. Five minutes to install.",
      response: "We saw everything.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      headlineWeight: 500,
      headlineSize: "clamp(3rem, 5vw + 1rem, 5.5rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
    wtf: {
      label: "WTF",
      layout: "problem",
      headline: "WTF",
      sub: null,
      response: "We know why.",
      cta: "Link your app",
      headlineColorMode: "white",
      headlineFont: "'Roboto Slab', serif",
      headlineWeight: 800,
      headlineSize: "clamp(80px, 12vw, 160px)",
      headlineLeading: "1",
      headlineTracking: "-0.02em",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
  };

export const copyVariantIds: CopyVariantId[] = [
  "provocateur",
  "value",
  "ship-it",
  "ai",
  "speed",
  "broke-fixed",
  "duck",
  "wtf",
];

export interface DitherShaderConfig {
  /* Dithering-specific */
  colorBack: string;
  colorFront: string;
  shape: DitheringShape;
  type: DitheringType;
  size: number;
  /** When true, shader bg becomes transparent — dots float over section bg */
  transparentBg: boolean;
  /** Alpha mode: stacked color layers with per-layer opacity and shape */
  alphaLayers: DitherAlphaLayer[];
  /** Speed of color cycling across alpha layers (0 = static) */
  colorCycleSpeed: number;
  /** Offset between alpha layers — higher = more separation between color blobs */
  alphaSpread: number;
  /* Motion */
  speed: number;
  frame: number;
  /* Sizing */
  fit: ShaderFit;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  originX: number;
  originY: number;
  worldWidth: number;
  worldHeight: number;
}

export interface DitherEdgeConfig {
  mode: EdgeMode;
  /** Where shader coverage ends (% of viewport height, 30–90) */
  position: number;
  /** Ripple amplitude in vh — how tall the waves are */
  rippleAmplitude: number;
  /** Number of ripple waves across the width */
  rippleFrequency: number;
  /** Animation speed for ripple edge (0 = static) */
  rippleSpeed: number;
  /** Build the ripple edge from the pixel-grid tiles (a blocky tile-wave) so the
   *  edge is made of dots like the rest of the scene, instead of a smooth wave.
   *  Only takes effect when the pixel grid is on. */
  ripplePixelate: boolean;
  /** 'dissolve' mode: how many tile rows the random drop-out band spans. */
  dissolveDepth: number;
  /** 'dissolve' mode: PRNG seed — change it to reshuffle which tiles drop out. */
  dissolveSeed: number;
  /** 'ripple' mode: dissolve the wave edge with the dither (Photoshop-style)
   *  instead of a hard clip — the wave fades out as scattered tiles. */
  rippleDither: boolean;
  /** Let the scene show through the text block (transparent text bg). Works with
   *  Dissolve or Overlap — Position sets where tiles meet the copy. */
  textBlend: boolean;
  /** Extend shader tiles below Position into the copy area (px). Text stays put. */
  shaderExtend: number;
  /** Perlin noise strength in the dissolve band (0 = static, 1 = lively). */
  textBlendMotion: number;
  /** Perlin noise animation speed (Hz). */
  textBlendSpeed: number;
  /** 'full' mode: clear distance (px) kept between shapes and text blocks. */
  fullPadding: number;
  /** Top start (px) — first row of shapes begins at the first whole tile at or
   *  below this line, so nothing is cut by the fixed header. */
  topInset: number;
}

/** How the pixel grid animates — shader color/alpha vs proportional point sizes. */
export type TileDisplayMode = "color" | "size" | "points";

export type HoverMode = "reveal" | "recolor" | "warp" | "overlay";
/** 'circle' = smooth radial fade; 'square' = whole-tile rect clip; 'pixel-circle'
 *  = hard-edged circle whose radius snaps to the tile grid, so the strict
 *  rectangular cells stay crisp right up to the circular boundary (no soft fade). */
export type HoverShape = "circle" | "square" | "pixel-circle";
/** 'instant' = fixed radius follows cursor; 'dwell' = grows over time, full takeover */
export type HoverTrigger = "instant" | "dwell";

export interface DitherHoverConfig {
  enabled: boolean;
  /** 'reveal' = separate shape+color layer under mask; 'recolor' = the SAME base
   *  pattern recolored under the cursor (the existing tiles change color) */
  mode: HoverMode;
  /** Recolor only WHOLE pixel-grid tiles the cursor overlaps (snap the recolor
   *  region to the tile grid) instead of cutting partial tiles at the edge.
   *  Only applies in recolor mode when the pixel grid is on. */
  wholeTiles: boolean;
  /** How the hover activates */
  trigger: HoverTrigger;
  /** Mask shape for the hover effect */
  hoverShape: HoverShape;
  /** Color revealed on hover — the "fix" state (reveal mode) or recolor tint */
  fixColor: string;
  /** Overlay mode: flat color opacity over the hover region (0–1). */
  overlayOpacity: number;
  /** Overlay mode: blend mode for the color wash. */
  overlayBlend: "normal" | "screen" | "multiply" | "overlay" | "soft-light";
  /** Shape for the hover reveal layer (reveal mode only) */
  fixShape: DitheringShape;
  /** Per-layer config for the hover reveal (reveal + alpha mode). Mirrors base
   *  alphaLayers so the hover state is as art-directable as the initial state. */
  hoverLayers: DitherAlphaLayer[];
  /** Base radius (half-width) of the hover effect in px */
  radius: number;
  /** Vertical radius (half-height) — when set, square shape becomes rectangular. Undefined = same as radius */
  radiusY?: number;
  /** How much the base layer origin follows the mouse (0–1) */
  mouseInfluence: number;
  /** When true, radius scales with mouse velocity */
  dynamicSize: boolean;
  /** Show full hover layer without mask — for previewing and tuning */
  preview: boolean;
  /** Dwell mode: radius growth speed in px/sec (higher = faster takeover) */
  dwellSpeed: number;
  /** Dwell mode: fade-back speed multiplier when mouse leaves (1 = same as grow, 2 = 2x faster) */
  dwellFadeBack: number;
  /* ── Warp mode: cursor-directional transform of the REAL base tiles ── */
  /** Max extra rotation (deg) applied to tiles at the cursor, easing to 0 at reach. */
  warpRotate: number;
  /** Corner-rounding (0–1) of tiles at the cursor, easing to square at reach. */
  warpRound: number;
  /** How much far tiles shrink below their resting size (0 = stay base, 1 = vanish). */
  warpShrink: number;
  /** Warped tile size toward full cell (0 = resting piece, 1 = full pitch). */
  warpScale: number;
  /** Recolor reach as a fraction of the warp radius (0 = no recolor, 1 = full).
   *  The recolored core follows whole warped tiles — no smooth circle. */
  warpRecolor: number;
  /** When true, tints warped tiles with fixColor (same pattern as base scene). */
  warpRecolorEnabled: boolean;
  /** Solid color overlay on warped tiles (when scene reveal is off). */
  warpOverlayEnabled: boolean;
  /** Warped tiles reveal the alternate state's scene (hover layers) instead of
   *  a tint — the problem peeks through the fix (or vice versa). */
  warpRevealEnabled: boolean;
  /** Short error strings surface below the cursor while warp-revealing. */
  warpErrorText: boolean;
  /** Random big→small range for warped tiles (0 = uniform max, 1 = down to tiny). */
  warpJitter: number;
  /* ── Per-layer overrides (undefined = inherit from base shader) ── */
  fixType?: DitheringType;
  fixSize?: number;
  fixSpeed?: number;
  fixScale?: number;
  fixRotation?: number;
  fixOffsetX?: number;
  fixOffsetY?: number;
}

export interface DitherMultiColorConfig {
  enabled: boolean;
  /** Additional error colors (stacked layers with organic masks) */
  colors: string[];
  /** Offset between layers — how much each layer shifts */
  layerSpread: number;
  /** Blend mode for color layers */
  blend: "normal" | "screen" | "multiply" | "overlay";
}

/** Pixel-grid mask — overlays the whole shader stack with a repeating grid of
 *  rounded tiles so the dither shows only through the tiles, with empty gaps
 *  between them (the "LED panel" / mosaic look). Independent of shader pixel size. */
export interface DitherPixelGridConfig {
  enabled: boolean;
  /** Master tile size in px. The tile is divided into `divisions` equal pieces;
   *  every piece, gap and dot derives from this so the grid stays aligned. */
  cell: number;
  /** How many equal pieces each tile is divided into, per axis (1 = whole tile).
   *  piece pitch = cell / divisions, so pieces always tile the master exactly. */
  divisions: number;
  /** Gap in px between pieces (the empty grout that reveals the background) */
  gap: number;
  /** Corner radius of each piece in px (0 = sharp squares) */
  radius: number;
  /** Lock the dither grid to the tiles — zeroes rotation/spread and sizes the
   *  dither dots to one-per-tile so cuts land cleanly between shapes (no noise). */
  snap: boolean;
  /** Phase nudge X in px (0..pitch) — slide the tile grid onto the dither dots */
  alignX: number;
  /** Phase nudge Y in px (0..pitch) */
  alignY: number;
}

export type SceneTemplateId =
  | "orbit"
  | "breathe-tiles"
  | "color-flow"
  | "gentle-drift"
  | "living-texture"
  | "falling-errors"
  | "signal-sweep"
  | "radar-scan"
  | "error-sweep"
  | "deep-breath"
  | "solid-classic";

export interface SceneTemplate {
  label: string;
  desc: string;
  shader: Partial<DitherShaderConfig>;
  animation: Partial<DitherAnimationConfig>;
}

export type ScanMode = "continuous" | "oscillate";

/** How a scene avoids visibly looping — layered on top of the scene's own
 *  motion. 'rotate' spins the color source (unbounded → never repeats), 'drift'
 *  pans continuously, 'orbit' does both, 'wander' pans in a slowly-turning
 *  direction (organic, no obvious cycle). */
export type LoopBreakMode = "none" | "rotate" | "drift" | "orbit" | "wander";

export interface DitherAnimationConfig {
  playing: boolean;
  /** Custom FPS (0 = use shader's built-in speed) */
  fps: number;
  /** Frame advance per tick when using custom FPS */
  frameStep: number;
  /** Vertical drift — positive = falling (units/sec) */
  driftY: number;
  /** Horizontal drift (units/sec) */
  driftX: number;
  /** Rotation drift (deg/sec) */
  rotationDrift: number;
  /** Scale oscillation amplitude */
  pulseAmount: number;
  /** Pulse speed (cycles/sec) */
  pulseSpeed: number;
  /* ── Scan oscillation (replaces drift when mode = 'oscillate') ── */
  /** 'continuous' = linear drift, 'oscillate' = back-and-forth scan */
  scanMode: ScanMode;
  /** Scan amplitude — how far the pattern sweeps (offset units) */
  scanAmplitude: number;
  /** Scan speed (Hz) — one full back-and-forth cycle per this many seconds */
  scanSpeed: number;
  /** Scan direction in degrees — 0 = horizontal, 90 = vertical, 45 = diagonal */
  scanAngle: number;
  /* ── Wave sweep (origin oscillation) ── */
  /** Wave amplitude — how far the origin sweeps (0 = off) */
  waveAmplitude: number;
  /** Wave speed (Hz) */
  waveSpeed: number;
  /** Wave direction in degrees — 0 = horizontal, 90 = vertical */
  waveAngle: number;
  /* ── Tile breathing (animates the pixel-grid gap) ── */
  /** Gap pulse amplitude in px — the gap opens/closes so tiles breathe (0 = off) */
  gapPulse: number;
  /** Gap pulse speed (Hz) */
  gapPulseSpeed: number;
  /* ── Loop break — non-looping motion layered on top of the scene ── */
  /** How to break the repeating feel (rotate / drift / orbit / wander / none) */
  loopBreak: LoopBreakMode;
  /** Loop-break intensity (0 = off, 1 = strong) */
  loopBreakAmount: number;
  /* ── Tile size animation (pixel grid) ── */
  /** 'color' = animate dither color/alpha; 'size' = mask shader pieces; 'points' = draw proportional points directly. */
  tileDisplay: TileDisplayMode;
  /** Size spread — 0 = uniform max piece, 1 = down to tiny (gaps preserved). */
  tileSizeSpread: number;
  /** Tile size animation speed (Hz). */
  tileSizeSpeed: number;
  /** Perlin noise spatial scale for tile sizes. */
  tileSizeNoise: number;
}

export interface DitherLayoutConfig {
  /** Headline column span (out of 12) */
  headlineCols: number;
  /** Response column span (out of 12) */
  responseCols: number;
  /** Gutter between headline and response columns (px) */
  gutter: number;
  /** Debug overlay: draw baselines of every text/button line to check alignment. */
  showBaselines: boolean;
}

/** Position of a single title element (percentage of viewport) */
export interface TitlePos {
  left: number;
  top: number;
}

/** Absolute positions for WTF hero title elements */
export interface WtfTitlePositions {
  wtf: TitlePos;
  did: TitlePos;
  myApp: TitlePos;
  rotating: TitlePos;
}

export const defaultWtfTitlePositions: WtfTitlePositions = {
  wtf: { left: 48, top: 12 },
  did: { left: 49, top: 31 },
  myApp: { left: 52, top: 44 },
  rotating: { left: 50, top: 60 },
};

export type HapticPresetId = "selection" | "light" | "medium" | "heavy" | "soft" | "rigid" | "nudge";

export interface DitherHapticConfig {
  enabled: boolean;
  /** Haptic pattern triggered on hover enter */
  hoverEnter: HapticPresetId;
  /** Haptic pattern triggered on hover leave */
  hoverLeave: HapticPresetId;
  /** Pixels of mouse travel between haptic ticks — like dragging across a texture (0 = off) */
  tickDistance: number;
  /** Pattern for movement ticks */
  tickPattern: HapticPresetId;
  /** Scale tick intensity by mouse velocity — faster = lighter touch, slower = heavier */
  velocityIntensity: boolean;
  /** Haptic on dwell completion */
  dwellComplete: HapticPresetId;
  /** Dwell progress ticks — fire haptic every N% of dwell coverage (0 = off) */
  dwellTickPercent: number;
  /** Show debug audio (audible simulation of haptics on desktop) */
  debug: boolean;
}

interface DitherState {
  headerBg: HeaderBgMode;
  shader: DitherShaderConfig;
  edge: DitherEdgeConfig;
  hover: DitherHoverConfig;
  multiColor: DitherMultiColorConfig;
  pixelGrid: DitherPixelGridConfig;
  animation: DitherAnimationConfig;
  layout: DitherLayoutConfig;
  haptic: DitherHapticConfig;
  copyVariant: CopyVariantId;
  /** Which named state is shown at rest. The other becomes the hover reveal. */
  initialState: InitialStateId;
  activeScene: SceneTemplateId | null;
  /** Active terminal theme ID (null = default colors) */
  terminalTheme: string | null;
  /** Absolute positions for WTF hero title elements */
  wtfTitlePositions: WtfTitlePositions;
}

/* ─── Defaults ─── */

/** The two named hero states. 'problem' = pink error dither, 'fix' = green
 *  "waves of green". Whichever is chosen as the base is visible at rest; the
 *  other becomes the hover reveal. */
export type InitialStateId = "problem" | "fix";

/** Pink/error layers — "something broke". Distinct shapes per layer. */
export const problemLayers: DitherAlphaLayer[] = [
  { color: "#E6307A", opacity: 0.9, shape: "simplex" },
  { color: "#FF6B2B", opacity: 0.7, shape: "warp" },
  { color: "#FF3366", opacity: 0.55, shape: "dots" },
];

/** Green layers — "ACME caught it". Swirl + wave read as flowing waves. */
export const fixLayers: DitherAlphaLayer[] = [
  { color: "#2DD4A8", opacity: 0.9, shape: "swirl" },
  { color: "#3ECF8E", opacity: 0.7, shape: "wave" },
  { color: "#1A8A70", opacity: 0.55, shape: "dots" },
];

export const defaultAlphaLayers: DitherAlphaLayer[] = problemLayers.map((l) => ({ ...l }));

export const defaultShaderConfig: DitherShaderConfig = {
  colorBack: "#0A1714",
  colorFront: "#E6307A",
  shape: "simplex",
  type: "8x8",
  size: 16,
  transparentBg: true,
  alphaLayers: defaultAlphaLayers.map((l) => ({ ...l })),
  colorCycleSpeed: 0.15,
  alphaSpread: 0.04,
  speed: 0.12,
  frame: 0,
  fit: "cover",
  scale: 0.21,
  rotation: 8,
  offsetX: 0,
  offsetY: 0,
  originX: 0.5,
  originY: 0.5,
  worldWidth: 1,
  worldHeight: 1,
};

export const defaultEdgeConfig: DitherEdgeConfig = {
  mode: "dissolve",
  position: 62,
  rippleAmplitude: 4,
  rippleFrequency: 6,
  rippleSpeed: 0.5,
  ripplePixelate: true,
  dissolveDepth: 7,
  dissolveSeed: 1,
  rippleDither: true,
  textBlend: false,
  shaderExtend: 160,
  textBlendMotion: 0.35,
  textBlendSpeed: 0.08,
  fullPadding: 28,
  topInset: 0,
};

/** Short error strings surfaced below the cursor in warp-reveal — the problem
 *  state peeking through. Kept terse so they read as log fragments, not copy. */
export const warpErrorSnippets: string[] = [
  "TypeError: cart is undefined",
  "500 POST /checkout",
  "p99 4.2s · GET /api/search",
  "ECONNREFUSED redis:6379",
  "N+1 · 342 queries · /orders",
  "OOM worker-3 · 2.1 GB",
  "queue backlog: 12,408 jobs",
  "uncaught: nil.email · user#show",
];

/** Mirror pool for the reversed orientation — problem (red) at rest, hover
 *  reveals the fix (green): errors switch to recovery lines. */
export const warpFixSnippets: string[] = [
  "✓ checkout recovered",
  "200 POST /checkout · 84ms",
  "p99 180ms · GET /api/search",
  "redis reconnected · 12ms",
  "0 N+1 · 3 queries · /orders",
  "worker-3 steady · 512 MB",
  "queue drained · 0 jobs",
  "0 errors · last hour",
];

export const defaultHoverConfig: DitherHoverConfig = {
  enabled: true,
  mode: "warp",
  wholeTiles: true,
  trigger: "instant",
  hoverShape: "pixel-circle",
  fixColor: "#E6307A",
  overlayOpacity: 1,
  overlayBlend: "normal",
  fixShape: "swirl",
  hoverLayers: fixLayers.map((l) => ({ ...l })),
  radius: 100,
  mouseInfluence: 1,
  dynamicSize: false,
  preview: false,
  dwellSpeed: 175,
  dwellFadeBack: 1.25,
  warpRotate: 35,
  warpRound: 1,
  warpShrink: 0,
  warpScale: 1,
  warpRecolor: 0.6,
  // Reveal warp + error text is the default hover story: the resting problem
  // scene peels back to the fix (or vice versa) with log fragments below.
  warpRecolorEnabled: false,
  warpOverlayEnabled: false,
  warpRevealEnabled: true,
  warpErrorText: true,
  warpJitter: 1.5,
  fixType: "2x2",
  fixSize: 18.5,
  fixScale: 0.81,
};

export const defaultMultiColorConfig: DitherMultiColorConfig = {
  enabled: false,
  colors: ["#FF6B2B", "#FFB800", "#9B59B6"],
  layerSpread: 0.25,
  blend: "screen",
};

export const defaultPixelGridConfig: DitherPixelGridConfig = {
  enabled: true,
  cell: 96,
  divisions: 4,
  gap: 6,
  radius: 40,
  snap: true,
  alignX: 0,
  alignY: 0,
};

export const defaultLayoutConfig: DitherLayoutConfig = {
  headlineCols: 8,
  responseCols: 4,
  gutter: 55,
  showBaselines: false,
};

export const defaultHapticConfig: DitherHapticConfig = {
  enabled: false,
  hoverEnter: "light",
  hoverLeave: "soft",
  tickDistance: 40,
  tickPattern: "selection",
  velocityIntensity: true,
  dwellComplete: "medium",
  dwellTickPercent: 10,
  debug: false,
};

export const defaultAnimationConfig: DitherAnimationConfig = {
  playing: true,
  fps: 0,
  frameStep: 0.5,
  // Texture lives here (pulse, gap breathing); the non-looping motion is the
  // separate Loop Break overlay below so it can be picked independently.
  driftY: 0,
  driftX: 0,
  rotationDrift: 0,
  pulseAmount: 0.02,
  pulseSpeed: 0.1,
  scanMode: "continuous",
  scanAmplitude: 0.6,
  scanSpeed: 0.06,
  scanAngle: 0,
  waveAmplitude: 0,
  waveSpeed: 0.08,
  waveAngle: 0,
  gapPulse: 2,
  gapPulseSpeed: 0.09,
  loopBreak: "orbit",
  loopBreakAmount: 0.5,
  tileDisplay: "color",
  tileSizeSpread: 0.55,
  tileSizeSpeed: 0.06,
  tileSizeNoise: 1.2,
};

export const sceneTemplates: Record<SceneTemplateId, SceneTemplate> = {
  "orbit": {
    label: "Orbit",
    desc: "Slow rotation + drift — never loops",
    shader: {
      speed: 0.1,
      transparentBg: true,
      colorCycleSpeed: 0.2,
      scale: 0.8,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0.006,
      driftX: 0.014,
      rotationDrift: 1.2,
      pulseAmount: 0.02,
      pulseSpeed: 0.1,
      scanMode: "continuous" as const,
      waveAmplitude: 0,
      gapPulse: 1.5,
      gapPulseSpeed: 0.08,
      tileDisplay: "points",
      tileSizeSpread: 0.5,
      tileSizeSpeed: 0.045,
      tileSizeNoise: 1.45,
    },
  },
  "breathe-tiles": {
    label: "Breathe",
    desc: "Tiles open & close + slow color shift",
    shader: {
      speed: 0.07,
      transparentBg: true,
      colorCycleSpeed: 0.3,
      scale: 0.82,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0,
      driftX: 0.004,
      rotationDrift: 0.25,
      pulseAmount: 0.03,
      pulseSpeed: 0.12,
      scanMode: "continuous" as const,
      waveAmplitude: 0,
      gapPulse: 5,
      gapPulseSpeed: 0.12,
      tileDisplay: "points",
      tileSizeSpread: 0.72,
      tileSizeSpeed: 0.08,
      tileSizeNoise: 1,
    },
  },
  "color-flow": {
    label: "Color Flow",
    desc: "Horizontal drift with color cycling",
    shader: {
      speed: 0.1,
      transparentBg: true,
      colorCycleSpeed: 0.3,
      alphaSpread: 0.04,
      scale: 0.8,
    },
    animation: {
      playing: true,
      fps: 0,
      frameStep: 0.5,
      driftY: 0,
      driftX: 0.02,
      rotationDrift: 1.5,
      pulseAmount: 0.025,
      pulseSpeed: 0.15,
      tileDisplay: "points",
      tileSizeSpread: 0.5,
      tileSizeSpeed: 0.075,
      tileSizeNoise: 1.8,
    },
  },
  "gentle-drift": {
    label: "Gentle Drift",
    desc: "Subtle flow with slow color shifts",
    shader: {
      speed: 0.12,
      transparentBg: true,
      colorCycleSpeed: 0.15,
      scale: 0.8,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0.015,
      driftX: 0.005,
      rotationDrift: 0,
      pulseAmount: 0.02,
      pulseSpeed: 0.15,
      tileDisplay: "points",
      tileSizeSpread: 0.42,
      tileSizeSpeed: 0.035,
      tileSizeNoise: 1.6,
    },
  },
  "living-texture": {
    label: "Living",
    desc: "Organic breathing with color shifts",
    shader: {
      speed: 0.08,
      transparentBg: true,
      colorCycleSpeed: 0.25,
      scale: 0.85,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0.5,
      pulseAmount: 0.04,
      pulseSpeed: 0.2,
      tileDisplay: "points",
      tileSizeSpread: 0.68,
      tileSizeSpeed: 0.055,
      tileSizeNoise: 0.9,
    },
  },
  "falling-errors": {
    label: "Falling",
    desc: "Errors gently cascading down",
    shader: {
      speed: 0.15,
      transparentBg: true,
      colorCycleSpeed: 0.2,
      scale: 0.8,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0.03,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.03,
      pulseSpeed: 0.2,
      tileDisplay: "points",
      tileSizeSpread: 0.48,
      tileSizeSpeed: 0.07,
      tileSizeNoise: 1.25,
    },
  },
  "signal-sweep": {
    label: "Sweep",
    desc: "Slow horizontal scan with 3 distinct blobs",
    shader: {
      speed: 0.1,
      transparentBg: true,
      colorCycleSpeed: 0,
      alphaSpread: 0.2,
      scale: 0.8,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0,
      driftX: 0.02,
      rotationDrift: 1.5,
      pulseAmount: 0.025,
      pulseSpeed: 0.15,
      tileDisplay: "points",
      tileSizeSpread: 0.5,
      tileSizeSpeed: 0.05,
      tileSizeNoise: 1.7,
    },
  },
  "radar-scan": {
    label: "Radar",
    desc: "Back-and-forth horizontal scan",
    shader: {
      speed: 0.12,
      transparentBg: true,
      colorCycleSpeed: 0.15,
      scale: 0.8,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.015,
      pulseSpeed: 0.1,
      scanMode: "oscillate" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0.15,
      waveSpeed: 0.08,
      waveAngle: 0,
      tileDisplay: "points",
      tileSizeSpread: 0.55,
      tileSizeSpeed: 0.06,
      tileSizeNoise: 1.2,
    },
  },
  "error-sweep": {
    label: "Error Sweep",
    desc: "Diagonal scan with origin wave",
    shader: {
      speed: 0.1,
      transparentBg: true,
      colorCycleSpeed: 0.25,
      alphaSpread: 0.06,
      scale: 0.85,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0.3,
      pulseAmount: 0.02,
      pulseSpeed: 0.15,
      scanMode: "oscillate" as const,
      scanAmplitude: 0.4,
      scanSpeed: 0.05,
      scanAngle: 30,
      waveAmplitude: 0.2,
      waveSpeed: 0.12,
      waveAngle: 90,
      tileDisplay: "points",
      tileSizeSpread: 0.62,
      tileSizeSpeed: 0.075,
      tileSizeNoise: 1.15,
    },
  },
  "deep-breath": {
    label: "Breath",
    desc: "Slow meditative breathing",
    shader: {
      speed: 0.06,
      transparentBg: true,
      colorCycleSpeed: 0.35,
      scale: 0.85,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.08,
      pulseSpeed: 0.12,
      tileDisplay: "points",
      tileSizeSpread: 0.58,
      tileSizeSpeed: 0.03,
      tileSizeNoise: 1.4,
    },
  },
  "solid-classic": {
    label: "Classic",
    desc: "Single color, minimal motion",
    shader: {
      speed: 0.15,
      transparentBg: false,
      colorCycleSpeed: 0,
      scale: 0.8,
    },
    animation: {
      playing: true,
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.02,
      pulseSpeed: 0.2,
      tileDisplay: "points",
      tileSizeSpread: 0.32,
      tileSizeSpeed: 0.025,
      tileSizeNoise: 2,
    },
  },
};

export const sceneTemplateIds: SceneTemplateId[] = [
  "orbit",
  "breathe-tiles",
  "color-flow",
  "gentle-drift",
  "living-texture",
  "falling-errors",
  "signal-sweep",
  "radar-scan",
  "error-sweep",
  "deep-breath",
  "solid-classic",
];

const defaults: DitherState = {
  headerBg: "solid",
  shader: { ...defaultShaderConfig },
  edge: { ...defaultEdgeConfig },
  hover: { ...defaultHoverConfig },
  multiColor: { ...defaultMultiColorConfig },
  pixelGrid: { ...defaultPixelGridConfig },
  animation: { ...defaultAnimationConfig },
  layout: { ...defaultLayoutConfig },
  haptic: { ...defaultHapticConfig },
  copyVariant: "broke-fixed",
  initialState: "problem",
  activeScene: null,
  terminalTheme: null,
  wtfTitlePositions: { ...defaultWtfTitlePositions },
};

/* ─── Store ─── */

let state: DitherState = structuredClone(defaults);
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useDitherStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* ─── Actions ─── */

/** Shader keys controlled by scene templates — changing these clears activeScene */
const SCENE_SHADER_KEYS: (keyof DitherShaderConfig)[] = [
  "speed", "transparentBg", "colorCycleSpeed", "alphaSpread", "scale",
];
/** Animation keys controlled by scene templates (excludes 'playing') */
const SCENE_ANIM_KEYS: (keyof DitherAnimationConfig)[] = [
  "driftY", "driftX", "rotationDrift", "pulseAmount", "pulseSpeed", "fps", "frameStep",
  "scanMode", "scanAmplitude", "scanSpeed", "scanAngle",
  "waveAmplitude", "waveSpeed", "waveAngle",
  "gapPulse", "gapPulseSpeed", "loopBreak", "loopBreakAmount",
  "tileDisplay", "tileSizeSpread", "tileSizeSpeed", "tileSizeNoise",
];

/** Recommended loop-breaker per scene — applied when you pick a scene (you can
 *  still change it independently afterward). */
const SCENE_LOOP_BREAK: Record<SceneTemplateId, LoopBreakMode> = {
  "orbit": "orbit",
  "breathe-tiles": "wander",
  "color-flow": "drift",
  "gentle-drift": "drift",
  "living-texture": "rotate",
  "falling-errors": "drift",
  "signal-sweep": "drift",
  "radar-scan": "wander",
  "error-sweep": "orbit",
  "deep-breath": "rotate",
  "solid-classic": "none",
};

export function setHeaderBg(mode: HeaderBgMode) {
  state.headerBg = mode;
  emit();
}

export function setShaderConfig(patch: Partial<DitherShaderConfig>) {
  state.shader = { ...state.shader, ...patch };
  if (SCENE_SHADER_KEYS.some((k) => k in patch)) state.activeScene = null;
  emit();
}

export function setEdgeConfig(patch: Partial<DitherEdgeConfig>) {
  state.edge = { ...state.edge, ...patch };
  emit();
}

export function setHoverConfig(patch: Partial<DitherHoverConfig>) {
  state.hover = { ...state.hover, ...patch };
  emit();
}

export function setHoverLayer(index: number, patch: Partial<DitherAlphaLayer>) {
  const hoverLayers = state.hover.hoverLayers.map((l, i) =>
    i === index ? { ...l, ...patch } : l,
  );
  state.hover = { ...state.hover, hoverLayers };
  emit();
}

/** Flip the hero between the 'problem' (pink) and 'fix' (green) states.
 *  The chosen state becomes the visible base; the other becomes the hover
 *  reveal. Only swaps colors/shapes; motion, scene, and per-layer opacities
 *  stay as the user left them. */
export function setInitialState(id: InitialStateId) {
  const base = id === "fix" ? fixLayers : problemLayers;
  const reveal = id === "fix" ? problemLayers : fixLayers;
  state.initialState = id;
  state.shader = {
    ...state.shader,
    alphaLayers: base.map((l) => ({ ...l })),
    colorFront: base[0].color,
  };
  state.hover = {
    ...state.hover,
    hoverLayers: reveal.map((l) => ({ ...l })),
    fixColor: reveal[0].color,
    fixShape: reveal[0].shape,
  };
  emit();
}

export function setMultiColorConfig(patch: Partial<DitherMultiColorConfig>) {
  state.multiColor = { ...state.multiColor, ...patch };
  emit();
}

export function setPixelGridConfig(patch: Partial<DitherPixelGridConfig>) {
  state.pixelGrid = { ...state.pixelGrid, ...patch };
  emit();
}

export function setMultiColorAt(index: number, color: string) {
  const colors = [...state.multiColor.colors];
  colors[index] = color;
  state.multiColor = { ...state.multiColor, colors };
  emit();
}

export function setAlphaLayer(index: number, patch: Partial<DitherAlphaLayer>) {
  const alphaLayers = state.shader.alphaLayers.map((l, i) =>
    i === index ? { ...l, ...patch } : l,
  );
  state.shader = { ...state.shader, alphaLayers };
  emit();
}

export function setLayoutConfig(patch: Partial<DitherLayoutConfig>) {
  state.layout = { ...state.layout, ...patch };
  emit();
}

export function setWtfTitlePos(key: keyof WtfTitlePositions, patch: Partial<TitlePos>) {
  state.wtfTitlePositions = {
    ...state.wtfTitlePositions,
    [key]: { ...state.wtfTitlePositions[key], ...patch },
  };
  emit();
}

export function resetWtfTitlePositions() {
  state.wtfTitlePositions = { ...defaultWtfTitlePositions };
  emit();
}

export function setHapticConfig(patch: Partial<DitherHapticConfig>) {
  state.haptic = { ...state.haptic, ...patch };
  emit();
}

export function setAnimationConfig(patch: Partial<DitherAnimationConfig>) {
  state.animation = { ...state.animation, ...patch };
  if (SCENE_ANIM_KEYS.some((k) => k in patch)) state.activeScene = null;
  emit();
}

export function applySceneTemplate(id: SceneTemplateId) {
  const tmpl = sceneTemplates[id];
  // Reset scene-controlled shader props to defaults, then apply template
  const sceneShaderDefaults: Partial<DitherShaderConfig> = {};
  for (const k of SCENE_SHADER_KEYS) sceneShaderDefaults[k] = defaultShaderConfig[k] as never;
  state.shader = { ...state.shader, ...sceneShaderDefaults, ...tmpl.shader };
  // Reset full animation to defaults, then apply template + its recommended
  // loop-breaker (template can still override loopBreak explicitly).
  state.animation = {
    ...defaultAnimationConfig,
    loopBreak: SCENE_LOOP_BREAK[id],
    ...tmpl.animation,
  };
  state.activeScene = id;
  emit();
}

export function setCopyVariant(id: CopyVariantId) {
  state.copyVariant = id;
  emit();
}

/** Live-tweak typography/color overrides for the current copy variant */
export function setCopyFont(patch: Partial<Pick<DitherCopy,
  'headlineFont' | 'headlineWeight' | 'headlineSize' | 'headlineTracking' | 'headlineLeading' |
  'headlineColorMode' | 'responseFont' | 'responseSize' | 'responseLeading' | 'responseColorMode' |
  'responseFontStyle' | 'responseWeight' | 'responseTracking' | 'responseBubble' | 'responseBubbleRadius' |
  'responseBubbleColor' | 'responseSeparator' | 'responseFontMode'
>>) {
  const id = state.copyVariant;
  Object.assign(copyVariants[id], patch);
  emit();
}


export function setTerminalTheme(id: string | null) {
  state.terminalTheme = id;
  if (id) {
    const theme = getThemeById(id);
    if (theme) {
      state.shader = { ...state.shader, colorBack: theme.bg };
    }
  } else {
    state.shader = { ...state.shader, colorBack: defaultShaderConfig.colorBack };
  }
  emit();
}

export function resetDither() {
  state = structuredClone(defaults);
  emit();
}
