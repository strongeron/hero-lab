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
  /** Where the response line sits vertically.
   *  'baseline' (default) aligns it to the headline's last baseline for
   *  cross-column rhythm; 'cta' groups it tight above the CTA as a lead-in. */
  responsePin?: 'baseline' | 'cta';
  /** CSS font-family for CTA labels (omit = the headline face).
   *  Escape hatch for display faces that go weak at button size: a 400-only
   *  hairline serif has no bold to lean on, so at 16px on a filled pill it
   *  reads fragile where a primary action needs optical weight. */
  ctaFont?: string;
  /** CSS font-family for the sub/body line (omit = the lab's body sans, Inter).
   *  Lets a template run a single-family system (headline face for body too) or
   *  an all-mono system, instead of defaulting every template to the same sans. */
  subFont?: string;
  /** How the hero composes at tablet widths (768–1023px).
   *  'columns' (default) keeps the two-column split from md up.
   *  'stack' delays the split to lg, so tablet composes like mobile — the
   *  headline gets full width instead of a starved 7/12 column. Monospace
   *  headlines need this (wide advance widths fragment into ragged lines);
   *  proportional faces fit the two-column split fine. */
  tabletLayout?: 'columns' | 'stack';
}

export type CopyVariantId =
  | "full-bleed"
  | "fine-grain"
  | "provocateur"
  | "value"
  | "ship-it"
  | "ai"
  | "speed"
  | "broke-fixed"
  | "wtf";

export const copyVariants: Record<CopyVariantId, DitherCopy & { label: string }> =
  {
    // Template-only variant: preserves the Broke / Fixed copy while giving the
    // Fine Grain artboard its own typography instead of mutating Broke/Fixed.
    "fine-grain": {
      label: "Fine Grain",
      layout: "problem",
      headline: "Something broke. You should already know what.",
      sub: "Errors, performance, and logs — one place. Five-minute install.",
      response: "Caught everything. Start at line 42.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      // Fine art, fine strokes: this scene is a smooth, high-detail continuous
      // field, not a discrete lattice. A serif's modulated stroke — thick stems
      // against hairline joins — echoes that fine grain, and gives the gallery
      // a third typographic voice instead of a third monospace.
      headlineFont: "'Instrument Serif', serif",
      // The wordmark keeps the serif (it reads elegant at 18px), but CTAs fall
      // back to the body sans: Instrument Serif ships a 400 weight only, so on a
      // filled 16px pill it reads fragile where a primary action needs presence.
      ctaFont: "var(--font-sans, Inter, sans-serif)",
      headlineWeight: 400,
      headlineLeading: "1.02",
      headlineTracking: "-0.01em",
      headlineSize: "clamp(3rem, 5vw + 1rem, 5.25rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
      // Serifs set compactly, so the 7/12 tablet column is comfortable.
      tabletLayout: "columns",
    },
    // Template-only variant: preserves the Broke / Fixed copy while giving the
    // top Full Bleed artboard its own typography instead of mutating Problem.
    "full-bleed": {
      label: "Full Bleed",
      layout: "problem",
      headline: "Something broke. You should already know what.",
      sub: "Errors, performance, and logs — one place. Five-minute install.",
      response: "Caught everything. Start at line\u00A042.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      // Round art, round letterforms: the point renderer draws circular dots,
      // so the headline uses a geometric sans whose bowls are true circles.
      // Space Grotesk's narrow, quirky forms fought that geometry.
      headlineFont: "'Outfit', sans-serif",
      // Single-family system: the body runs in Outfit too. One geometric voice
      // top to bottom reads more brand-forward than sans-for-body-by-default.
      subFont: "'Outfit', sans-serif",
      headlineWeight: 500,
      headlineLeading: "1.0",
      headlineSize: "clamp(2.8rem, 4vw + 1rem, 4.5rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
      // Proportional face fits the 7/12 tablet column, so keep two columns.
      tabletLayout: "columns",
    },
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
      // Focused: concrete signals, then the AI-native benefit that ties back to
      // the headline's "who's watching it run". No em dash.
      sub: "Errors, performance, and logs in one place. Ask what happened in plain language, no dashboard required.",
      response: "We speak AI\u00A0too.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      // Square art, monospace grid: the 96px tile field is hard squares on a
      // fixed lattice, and a monospace face is the type equivalent \u2014 every
      // glyph on the same advance width. JetBrains Mono over Space Mono because
      // it is meaningfully narrower: tracking can shrink the gaps but can't fix
      // monospace's uneven rhythm, so a tighter face does what tracking can't.
      headlineFont: "'JetBrains Mono', monospace",
      // All-mono system: the body runs in the same face. For error monitoring
      // this is the on-message choice \u2014 the whole hero reads terminal-native.
      subFont: "'JetBrains Mono', monospace",
      headlineWeight: 500,
      // 0.95 was too tight: monospace carries generous side bearings, so
      // sub-1 leading collapsed the block and read cramped rather than
      // confident. 1.08 lets the lines breathe without losing density.
      headlineLeading: "1.08",
      // Monospace is drawn for code legibility at 14px, so at display sizes its
      // fixed advance leaves too much air between glyphs. Pulling tracking to
      // -0.05em (from the -0.03em default) tightens the words into solid blocks
      // without breaking the even monospace rhythm or colliding glyphs.
      headlineTracking: "-0.05em",
      headlineSize: "clamp(3rem, 5vw + 1rem, 5.5rem)",
      responseFontMode: "headline",
      responseSize: "36px",
      responseFontStyle: "normal",
      responseWeight: 400,
      // Group the tagline tight above the CTA so "We speak AI too." reads as a
      // lead-in to the button instead of floating up to the headline baseline.
      responsePin: "cta",
      // Monospace is wide: in a 7/12 tablet column this headline fragments
      // into five ragged lines. Stacking gives it the full width (two lines).
      tabletLayout: "stack",
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

// 'wtf' stays defined (URL params / old configs keep working) but is no longer
// offered in the panel.
export const copyVariantIds: CopyVariantId[] = [
  "provocateur",
  "value",
  "ship-it",
  "ai",
  "speed",
  "broke-fixed",
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
  /** Scene-behind-text: clear space (px) kept between shapes and every text
   *  block — a tile whose padded box would touch text is dropped whole
   *  (never cut). Applies in any edge mode when textBlend is on. */
  textPadding: number;
  /** What the clearance traces: 'lines' hugs each rendered text line (organic
   *  ragged edge, shapes fill beside short lines); 'box' clears the whole
   *  element rectangle (calmer, blocky negative space). Also used by 'full'. */
  textRectMode: "lines" | "box";
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
  /** Scenes are state-agnostic motion recipes. Keeping this type narrow makes
   * it impossible for a scene to hardcode pink/green, shapes, scale, or grid. */
  shader: Partial<Pick<DitherShaderConfig, "speed" | "colorCycleSpeed">>;
  animation: Partial<Omit<DitherAnimationConfig, "playing" | "tileDisplay">>;
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

/** CTA / button styling shared by header and hero buttons. */
export interface DitherButtonConfig {
  /** Corner radius in px (0 = square, 999 = pill) */
  radius: number;
  /** Uppercase the button label */
  uppercase: boolean;
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
  button: DitherButtonConfig;
  haptic: DitherHapticConfig;
  copyVariant: CopyVariantId;
  /** Which named state is shown at rest. The other becomes the hover reveal. */
  initialState: InitialStateId;
  activeScene: SceneTemplateId | null;
  /** Last applied hero template (picker highlight); null = untracked/custom */
  activeTemplate: string | null;
  /** Active terminal theme ID (null = default colors) */
  terminalTheme: string | null;
  /** Absolute positions for WTF hero title elements */
  wtfTitlePositions: WtfTitlePositions;
  /** Layers-explorer only: hold the screen-blended Color/alpha layers at their
   *  authored opacity instead of running the per-frame emphasis swing. The swing
   *  pulses the composite under `screen` blend (a recurring blink); the Layers
   *  view wants a calm, stable base to stack onto. Off everywhere else, so Live
   *  and Templates keep their colour shimmer unchanged. */
  stableColorField: boolean;
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
  textPadding: 24,
  textRectMode: "lines",
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

export const defaultButtonConfig: DitherButtonConfig = {
  radius: 999,
  uppercase: false,
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
  gapPulse: 3,
  gapPulseSpeed: 0.12,
  loopBreak: "orbit",
  loopBreakAmount: 0.5,
  tileDisplay: "color",
  tileSizeSpread: 0.55,
  tileSizeSpeed: 0.12,
  tileSizeNoise: 1.2,
};

export const sceneTemplates: Record<SceneTemplateId, SceneTemplate> = {
  "orbit": {
    label: "Orbit",
    desc: "Rotating drift that never loops",
    shader: {
      // Strong enough to remain legible when sampled through Problem's fixed
      // 32px square grid; the previous values looked static at gallery scale.
      speed: 0.18,
      colorCycleSpeed: 0.32,
    },
    animation: {
      fps: 0,
      driftY: 0.018,
      driftX: 0.025,
      rotationDrift: 4.0,
      pulseAmount: 0.028,
      pulseSpeed: 0.16,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 3,
      gapPulseSpeed: 0.14,
      tileSizeSpread: 0.52,
      tileSizeSpeed: 0.1,
      tileSizeNoise: 1.4,
    },
  },
  "breathe-tiles": {
    label: "Breathe",
    desc: "Tiles open & close in place",
    shader: {
      speed: 0.07,
      colorCycleSpeed: 0.28,
    },
    animation: {
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.03,
      pulseSpeed: 0.12,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 6,
      gapPulseSpeed: 0.16,
      tileSizeSpread: 0.82,
      tileSizeSpeed: 0.16,
      tileSizeNoise: 1.0,
    },
  },
  "color-flow": {
    label: "Color Flow",
    desc: "Horizontal flow with strong color cycling",
    shader: {
      speed: 0.1,
      colorCycleSpeed: 0.45,
    },
    animation: {
      fps: 0,
      driftY: 0,
      driftX: 0.04,
      rotationDrift: 0,
      pulseAmount: 0.02,
      pulseSpeed: 0.12,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 2,
      gapPulseSpeed: 0.12,
      tileSizeSpread: 0.5,
      tileSizeSpeed: 0.12,
      tileSizeNoise: 1.6,
    },
  },
  "gentle-drift": {
    label: "Gentle Drift",
    desc: "Soft diagonal drift",
    shader: {
      speed: 0.1,
      colorCycleSpeed: 0.15,
    },
    animation: {
      fps: 0,
      // One panel Offset step is 0.05; the former 0.01/0.016 rates needed
      // several seconds to move even that far and looked frozen between alpha
      // pulses. Keep the motion gentle, but make every second visibly advance.
      driftY: 0.05,
      driftX: 0.035,
      rotationDrift: 0,
      pulseAmount: 0.02,
      pulseSpeed: 0.12,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 1.5,
      gapPulseSpeed: 0.08,
      tileSizeSpread: 0.42,
      tileSizeSpeed: 0.08,
      tileSizeNoise: 1.6,
    },
  },
  "living-texture": {
    label: "Living",
    desc: "Organic breathing with slow rotation",
    shader: {
      speed: 0.09,
      colorCycleSpeed: 0.3,
    },
    animation: {
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0.8,
      pulseAmount: 0.04,
      pulseSpeed: 0.12,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 5,
      gapPulseSpeed: 0.15,
      tileSizeSpread: 0.72,
      tileSizeSpeed: 0.13,
      tileSizeNoise: 0.9,
    },
  },
  "falling-errors": {
    label: "Falling",
    desc: "Errors cascading straight down",
    shader: {
      speed: 0.14,
      colorCycleSpeed: 0.18,
    },
    animation: {
      fps: 0,
      driftY: 0.05,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.02,
      pulseSpeed: 0.12,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 2,
      gapPulseSpeed: 0.13,
      tileSizeSpread: 0.52,
      tileSizeSpeed: 0.14,
      tileSizeNoise: 1.25,
    },
  },
  "signal-sweep": {
    label: "Sweep",
    desc: "Fast horizontal sweep",
    shader: {
      speed: 0.1,
      colorCycleSpeed: 0.12,
    },
    animation: {
      fps: 0,
      driftY: 0,
      driftX: 0.05,
      rotationDrift: 0.6,
      pulseAmount: 0.02,
      pulseSpeed: 0.12,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 2.5,
      gapPulseSpeed: 0.11,
      tileSizeSpread: 0.5,
      tileSizeSpeed: 0.11,
      tileSizeNoise: 1.7,
    },
  },
  "radar-scan": {
    label: "Radar",
    desc: "Back-and-forth horizontal scan",
    shader: {
      speed: 0.16,
      colorCycleSpeed: 0.22,
    },
    animation: {
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.02,
      pulseSpeed: 0.16,
      scanMode: "oscillate" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.13,
      scanAngle: 0,
      waveAmplitude: 0.18,
      waveSpeed: 0.16,
      waveAngle: 0,
      gapPulse: 3,
      gapPulseSpeed: 0.14,
      tileSizeSpread: 0.65,
      tileSizeSpeed: 0.16,
      tileSizeNoise: 1.2,
    },
  },
  "error-sweep": {
    label: "Error Sweep",
    desc: "Diagonal scan with a vertical wave",
    shader: {
      speed: 0.36,
      colorCycleSpeed: 0.4,
    },
    animation: {
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 1.2,
      pulseAmount: 0.035,
      pulseSpeed: 0.18,
      scanMode: "oscillate" as const,
      scanAmplitude: 0.85,
      scanSpeed: 0.2,
      scanAngle: 30,
      waveAmplitude: 0.42,
      waveSpeed: 0.24,
      waveAngle: 90,
      gapPulse: 3.5,
      gapPulseSpeed: 0.2,
      tileSizeSpread: 0.6,
      tileSizeSpeed: 0.13,
      tileSizeNoise: 1.15,
    },
  },
  "deep-breath": {
    label: "Breath",
    desc: "Slow, deep meditative breathing",
    shader: {
      speed: 0.06,
      colorCycleSpeed: 0.32,
    },
    animation: {
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.08,
      pulseSpeed: 0.08,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 8,
      gapPulseSpeed: 0.06,
      tileSizeSpread: 0.72,
      tileSizeSpeed: 0.05,
      tileSizeNoise: 1.4,
    },
  },
  "solid-classic": {
    label: "Classic",
    desc: "Near-static shader motion — calm baseline",
    shader: {
      // Paper's large contours reorganize dramatically even at the default
      // 0.12-ish speed. Keep Classic genuinely ambient so it does not read as
      // a periodic blink in the bare Layers view.
      speed: 0.025,
      colorCycleSpeed: 0.0,
    },
    animation: {
      fps: 0,
      driftY: 0,
      driftX: 0,
      rotationDrift: 0,
      pulseAmount: 0.006,
      pulseSpeed: 0.06,
      scanMode: "continuous" as const,
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 0.25,
      gapPulseSpeed: 0.04,
      tileSizeSpread: 0.28,
      tileSizeSpeed: 0.04,
      tileSizeNoise: 2.0,
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
  button: { ...defaultButtonConfig },
  haptic: { ...defaultHapticConfig },
  copyVariant: "broke-fixed",
  initialState: "problem",
  activeScene: null,
  activeTemplate: null,
  terminalTheme: null,
  wtfTitlePositions: { ...defaultWtfTitlePositions },
  stableColorField: false,
};

/* ─── Store ─── */

type DitherStoreWindow = Window & {
  __dither?: () => DitherState;
  __ditherState?: DitherState;
  __ditherSyncBridge?: DitherSyncBridge;
};
const storeWindow = typeof window === "undefined" ? null : window as DitherStoreWindow;
// Fast Refresh replaces this module but not `window`. Reuse the live snapshot
// so editing store or scene code cannot flash the preview back to defaults.
let state: DitherState = storeWindow?.__ditherState ?? structuredClone(defaults);
if (storeWindow) {
  storeWindow.__ditherState = state;
  storeWindow.__dither = () => state;
}

type DitherSyncMessage = { type: "state"; state: DitherState; copyVariants: typeof copyVariants; sourceId?: string };
interface DitherSyncBridge {
  started?: boolean;
  role?: "source" | "preview";
  templateId?: string | null;
  live?: boolean;
  lastAppliedJson?: string;
  sourceSend?: () => void;
  snapshot?: () => { state: DitherState; copyVariants: typeof copyVariants };
  applyMessage?: (message: DitherSyncMessage) => void;
  /** Stable per-tab id for the source in THIS window. Survives Fast Refresh
   *  because it lives on the window-level bridge, not the module. */
  sourceId?: string;
  /** Preview-only: apply broadcasts from ONLY this source id. When set, the
   *  frame ignores every other Hero Lab tab on the shared channel, so a second
   *  tab's heartbeat can't overwrite it (the Layers scene-switch blink). */
  expectSourceId?: string | null;
  /** The live BroadcastChannel, kept on the bridge so the sender can be rebuilt
   *  from a fresh module (HMR) without recreating the channel. */
  channel?: BroadcastChannel;
  /** Preview-only: timestamp (performance.now) of the last message accepted from
   *  the bound source. Powers the liveness fallback so a preview can never stay
   *  frozen if its source dies or desyncs. */
  lastBoundMsgAt?: number;
}

// BroadcastChannel objects and timers survive Vite Fast Refresh, while this
// module's `state` binding does not. Keep a tiny window-level bridge whose
// callbacks are replaced by every fresh module instance; surviving channels
// then always read/write the current store instead of blinking to stale state.
const syncBridge: DitherSyncBridge = storeWindow
  ? (storeWindow.__ditherSyncBridge ??= {})
  : {};
syncBridge.snapshot = () => ({ state, copyVariants });
// Mint this tab's source id once (kept on the surviving bridge across HMR).
syncBridge.sourceId ??= (typeof crypto !== "undefined" && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

/** This tab's source id — embed it in a preview iframe's URL (`&sid=…`) so the
 *  frame binds to this source only and ignores other Hero Lab tabs. */
export function getTabSourceId(): string {
  return syncBridge.sourceId ?? "";
}

/** Build the source broadcaster from THIS module, reading the channel, id and
 *  snapshot off the bridge at call time. Rebuilt on every module load so an HMR
 *  across a protocol change (e.g. sourceId tagging) can never leave a stale,
 *  untagged closure broadcasting — which would make bound previews reject every
 *  message and freeze. The BroadcastChannel object itself survives on the bridge. */
function refreshSourceSend(): () => void {
  const send = () => {
    const latest = syncBridge.snapshot?.() ?? { state, copyVariants };
    syncBridge.channel?.postMessage({ type: "state", sourceId: syncBridge.sourceId, ...latest });
  };
  syncBridge.sourceSend = send;
  return send;
}

const listeners = new Set<() => void>();
if (syncBridge.role === "source") {
  // Rebuild (not reuse) the sender so a surviving stale closure can't broadcast.
  listeners.add(refreshSourceSend());
}

let batchDepth = 0;
let batchDirty = false;

function flushEmit() {
  state = { ...state };
  if (storeWindow) storeWindow.__ditherState = state;
  listeners.forEach((l) => l());
}

function emit() {
  if (batchDepth > 0) {
    batchDirty = true;
    return;
  }
  flushEmit();
}

/** Apply several related controls as one externally-observable state. This is
 *  primarily for compound UI actions (Layers Full stack/Bare scene): React and
 *  preview sync receive only the complete configuration, never transient
 *  renderer combinations between individual setters. */
export function batchDitherUpdates(run: () => void) {
  batchDepth += 1;
  try {
    run();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0 && batchDirty) {
      batchDirty = false;
      flushEmit();
    }
  }
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

/** Shader keys a scene may drive — MOTION ONLY. Scenes never touch look keys
 *  (scale, transparentBg, alphaSpread, shapes, colors, pixel grid). */
const SCENE_SHADER_KEYS: (keyof DitherShaderConfig)[] = [
  "speed", "colorCycleSpeed",
];
/** Animation keys a scene may drive (excludes 'playing' and — deliberately —
 *  'tileDisplay': the tile renderer is a look choice, not a motion one). */
const SCENE_ANIM_KEYS: (keyof DitherAnimationConfig)[] = [
  "driftY", "driftX", "rotationDrift", "pulseAmount", "pulseSpeed", "fps", "frameStep",
  "scanMode", "scanAmplitude", "scanSpeed", "scanAngle",
  "waveAmplitude", "waveSpeed", "waveAngle",
  "gapPulse", "gapPulseSpeed", "loopBreak", "loopBreakAmount",
  "tileSizeSpread", "tileSizeSpeed", "tileSizeNoise",
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
  const baseOpacities = state.shader.alphaLayers.map((layer) => layer.opacity);
  const revealOpacities = state.hover.hoverLayers.map((layer) => layer.opacity);
  state.initialState = id;
  state.shader = {
    ...state.shader,
    alphaLayers: base.map((l, i) => ({
      ...l,
      opacity: baseOpacities[i] ?? l.opacity,
    })),
    colorFront: base[0].color,
  };
  state.hover = {
    ...state.hover,
    hoverLayers: reveal.map((l, i) => ({
      ...l,
      opacity: revealOpacities[i] ?? l.opacity,
    })),
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

export function setButtonConfig(patch: Partial<DitherButtonConfig>) {
  state.button = { ...state.button, ...patch };
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

/** Layers-explorer only: calm the screen-blended Color/alpha base (see
 *  DitherState.stableColorField). Set on entering Layers, cleared on leaving. */
export function setStableColorField(on: boolean) {
  if (state.stableColorField === on) return;
  state.stableColorField = on;
  emit();
}

/** Change the loop-breaker WITHOUT detaching from the active scene. Plain
 *  setAnimationConfig() nulls activeScene for any scene-motion key (loopBreak is
 *  one), which would clear the scene highlight. This layers non-repeating motion
 *  ('wander' = organic/random) on top of the CURRENT scene and keeps it
 *  selected. Turning it on from a zero amount raises it to a visible default. */
export function setLoopBreak(mode: LoopBreakMode) {
  // Turning it on from the Layers picker uses a pronounced amount so the effect
  // clearly reads as dynamic (scene defaults keep the subtler 0.5 for a gentle
  // production anti-loop). Leave an already-strong amount alone.
  const amount = mode === "none"
    ? state.animation.loopBreakAmount
    : Math.max(state.animation.loopBreakAmount, 1.3);
  state.animation = { ...state.animation, loopBreak: mode, loopBreakAmount: amount };
  emit();
}

/** Motion-only patches for a scene — shared by the scene buttons and by hero
 *  templates that bake a scene in. */
function sceneMotionPatches(id: SceneTemplateId) {
  const tmpl = sceneTemplates[id];
  const tShader = tmpl.shader as Partial<DitherShaderConfig>;
  const tAnim = tmpl.animation as Partial<DitherAnimationConfig>;
  const shaderPatch: Partial<DitherShaderConfig> = {};
  for (const k of SCENE_SHADER_KEYS) {
    shaderPatch[k] = (tShader[k] ?? defaultShaderConfig[k]) as never;
  }
  const animPatch: Partial<DitherAnimationConfig> = {};
  for (const k of SCENE_ANIM_KEYS) {
    animPatch[k] = (tAnim[k] ?? defaultAnimationConfig[k]) as never;
  }
  animPatch.loopBreak = tAnim.loopBreak ?? SCENE_LOOP_BREAK[id];
  return { shaderPatch, animPatch };
}

export function applySceneTemplate(id: SceneTemplateId) {
  // Scenes are MOTION OVERLAYS: reset only the motion keys to defaults, lay
  // the scene's motion on top, and leave every look decision (tile display,
  // scale, transparency, spread, pixel grid, shapes, colors) exactly as the
  // user set it. Switching scenes swaps the dynamic, never the style.
  const { shaderPatch, animPatch } = sceneMotionPatches(id);
  state.shader = { ...state.shader, ...shaderPatch };
  state.animation = { ...state.animation, ...animPatch, playing: true };
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

/* ─── Hero templates ─── */

/** A template is a curated snapshot: defaults + a small patch, applied
 *  wholesale so every pick lands on the same art-directed look regardless of
 *  what was tweaked before. topInset stays locally measured (header height). */
export interface HeroTemplate {
  id: string;
  name: string;
  desc: string;
  /** Swatch colors for the picker's mini dot preview */
  swatch: string[];
  initialState: InitialStateId;
  shader?: Partial<DitherShaderConfig>;
  edge?: Partial<DitherEdgeConfig>;
  hover?: Partial<DitherHoverConfig>;
  animation?: Partial<DitherAnimationConfig>;
  pixelGrid?: Partial<DitherPixelGridConfig>;
  copyVariant?: CopyVariantId;
  scene?: SceneTemplateId | null;
  button?: Partial<DitherButtonConfig>;
}

export const heroTemplates: HeroTemplate[] = [
  {
    id: "full-bleed",
    name: "Full Bleed",
    desc: "Shapes fill the whole hero and flow around every text line — tight 8px clearance with a lively 2-row rim, resting on the pink problem state.",
    swatch: ["#E6307A", "#FF6B2B", "#FF3366"],
    initialState: "problem",
    copyVariant: "full-bleed",
    edge: {
      mode: "full",
      fullPadding: 8,
      textRectMode: "lines",
      dissolveDepth: 2,
      textBlendMotion: 1,
      textBlendSpeed: 0.33,
    },
    animation: { tileDisplay: "points" },
  },
  {
    id: "problem",
    name: "Problem",
    desc: "Square error tiles on a 96px grid with wide gaps, pink problem state at rest; hover reveals the green fix. AI-native copy in Space Mono.",
    swatch: ["#E6307A", "#FF6B2B", "#FF3366"],
    initialState: "problem",
    // AI-native headline baked in: "Your AI built the app. Who's watching it run?"
    copyVariant: "ai",
    // Match the reveal layer's detailed sampling. The global 0.21 scale makes
    // Error Sweep read as a few broad, almost-static regions; 0.81 exposes the
    // moving scan/wave structure in the resting pink scene too.
    shader: { scale: 0.81 },
    // snap OFF: with snap on, every tile locks to one identical dot and the
    // dither axis-aligns, so scene drift/scan/rotation can only flip tiles
    // on/off at the threshold — every scene looks the same. Snap off lets the
    // dither flow freely under the square tile mask, so scene motion reads.
    pixelGrid: { cell: 96, divisions: 3, gap: 13, radius: 0, snap: false },
    // The most expressive color/alpha scene: diagonal scan + vertical wave,
    // slow rotation, color cycling, and an orbiting non-looping drift.
    scene: "error-sweep",
    animation: { tileDisplay: "color" },
    // Square, uppercase CTA to echo the sharp pixel tiles.
    button: { radius: 0, uppercase: true },
  },
  {
    // Captured from a live Layers exploration — the fine-grain Paper dither on
    // the green fix state (Color/alpha renderer, no pixel grid), with the Sweep
    // scene's slow diagonal scan and a rotating loop-break so it never repeats.
    // Motion is authored directly (scene: null) so the rotate loop-break isn't
    // overwritten by the scene's own recommended drift.
    id: "fine-grain",
    name: "Fine Grain",
    desc: "Fine-grain Paper dither on the green fix state — a smooth, high-detail field with a slow diagonal sweep and a rotating loop-break so the motion never repeats. Hover warps to the pink problem with error-log fragments.",
    swatch: ["#2DD4A8", "#3ECF8E", "#1A8A70"],
    initialState: "fix",
    copyVariant: "fine-grain",
    shader: {
      type: "8x8",
      shape: "simplex",
      size: 2,
      scale: 0.6,
      speed: 0.1,
      colorCycleSpeed: 0.12,
      rotation: 8,
      transparentBg: true,
      alphaSpread: 0.04,
      fit: "cover",
    },
    edge: {
      mode: "dissolve",
      position: 62,
      dissolveDepth: 7,
      dissolveSeed: 1,
      shaderExtend: 160,
      ripplePixelate: true,
      rippleDither: true,
      rippleAmplitude: 4,
      rippleFrequency: 6,
      rippleSpeed: 0.5,
      textBlend: false,
    },
    // Full hover story on top of the calm resting field: warp reveal to the pink
    // problem with error-log fragments (defaults already enable reveal + text).
    hover: {
      enabled: true,
      mode: "warp",
      wholeTiles: true,
      hoverShape: "pixel-circle",
      warpRevealEnabled: true,
      warpErrorText: true,
      warpRotate: 35,
      warpJitter: 1.5,
      fixType: "2x2",
      fixSize: 18.5,
      fixScale: 0.81,
      radius: 100,
    },
    // Color/alpha renderer — no pixel grid, so the dither reads as a fine
    // continuous field rather than discrete tiles.
    pixelGrid: { enabled: false, snap: false },
    scene: null,
    animation: {
      tileDisplay: "color",
      driftX: 0.05,
      driftY: 0,
      rotationDrift: 0.6,
      pulseAmount: 0.02,
      pulseSpeed: 0.12,
      scanMode: "continuous",
      scanAmplitude: 0.6,
      scanSpeed: 0.06,
      scanAngle: 0,
      waveAmplitude: 0,
      waveSpeed: 0.08,
      waveAngle: 0,
      gapPulse: 2.5,
      gapPulseSpeed: 0.11,
      loopBreak: "rotate",
      loopBreakAmount: 1.3,
      tileSizeSpread: 0.5,
      tileSizeSpeed: 0.11,
      tileSizeNoise: 1.7,
      frameStep: 0.5,
      fps: 0,
    },
  },
];

export function applyHeroTemplate(id: string) {
  const tmpl = heroTemplates.find((t) => t.id === id);
  if (!tmpl) return;
  const base = structuredClone(defaults);
  const rest = tmpl.initialState === "fix" ? fixLayers : problemLayers;
  const reveal = tmpl.initialState === "fix" ? problemLayers : fixLayers;
  state = {
    ...base,
    shader: {
      ...base.shader,
      ...tmpl.shader,
      alphaLayers: rest.map((l) => ({ ...l })),
      colorFront: rest[0].color,
    },
    // topInset is viewport-specific (measured off the live header) — keep it.
    edge: { ...base.edge, ...tmpl.edge, topInset: state.edge.topInset },
    hover: {
      ...base.hover,
      ...tmpl.hover,
      hoverLayers: reveal.map((l) => ({ ...l })),
      fixColor: reveal[0].color,
      fixShape: reveal[0].shape,
    },
    animation: { ...base.animation, ...tmpl.animation },
    pixelGrid: { ...base.pixelGrid, ...tmpl.pixelGrid },
    button: { ...base.button, ...tmpl.button },
    copyVariant: tmpl.copyVariant ?? base.copyVariant,
    initialState: tmpl.initialState,
    activeScene: tmpl.scene !== undefined ? tmpl.scene : base.activeScene,
    activeTemplate: id,
  };
  // A baked-in scene contributes its motion overlay on top of the template's
  // look (same motion-only contract as picking the scene in the panel).
  if (tmpl.scene) {
    const { shaderPatch, animPatch } = sceneMotionPatches(tmpl.scene);
    state.shader = { ...state.shader, ...shaderPatch };
    state.animation = { ...state.animation, ...animPatch };
  }
  emit();
}

/* ─── Preview sync ─── */

let syncStarted = syncBridge.started === true;

function configurePreviewSync(templateId: string | null, expectSourceId: string | null = null) {
  syncBridge.role = "preview";
  syncBridge.templateId = templateId;
  syncBridge.expectSourceId = expectSourceId;
  // Assume the bound source is live at bind time so the fallback below only fires
  // after real silence, not on the first frame before the source is heard.
  syncBridge.lastBoundMsgAt = typeof performance !== "undefined" ? performance.now() : 0;
  syncBridge.applyMessage = (message) => {
    if (message?.type !== "state") return;
    // Bound to a single source tab: normally ignore every other Hero Lab tab's
    // broadcast (and heartbeat) on the shared channel, so a second tab can't
    // overwrite the scene the user just picked (the Layers blink).
    if (syncBridge.expectSourceId) {
      if (message.sourceId === syncBridge.expectSourceId) {
        syncBridge.lastBoundMsgAt = typeof performance !== "undefined" ? performance.now() : 0;
      } else {
        // Not our bound source. Liveness safety-net: if our source has gone
        // silent (no tagged message for >5s — 3+ missed heartbeats, i.e. its
        // tab was closed or wedged), accept other traffic so the preview can
        // NEVER stay permanently frozen. Otherwise keep ignoring it.
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        const silentFor = now - (syncBridge.lastBoundMsgAt ?? 0);
        if (silentFor <= 5000) return;
      }
    }
    const incoming = message.state;
    if (templateId) {
      if (incoming.activeTemplate !== templateId) {
        // Someone else's artboard is being edited — return to canonical.
        if (syncBridge.live) {
          syncBridge.live = false;
          syncBridge.lastAppliedJson = "";
          applyHeroTemplate(templateId);
          state = { ...state, animation: { ...state.animation, playing: false } };
          emit();
        }
        return;
      }
      syncBridge.live = true;
    }
    const json = JSON.stringify(message.state) + JSON.stringify(message.copyVariants);
    if (json === syncBridge.lastAppliedJson) return;
    syncBridge.lastAppliedJson = json;
    for (const id of Object.keys(message.copyVariants) as CopyVariantId[]) {
      Object.assign(copyVariants[id], message.copyVariants[id]);
    }
    state = {
      ...incoming,
      edge: { ...incoming.edge, topInset: state.edge.topInset },
    };
    emit();
  };
}

// A preview's channel may have survived a hot update. Refresh its destination
// callback immediately even when React preserves the [] effect that created it.
if (syncBridge.role === "preview") {
  configurePreviewSync(syncBridge.templateId ?? null, syncBridge.expectSourceId ?? null);
}

/** Mirror the store across windows (main window ↔ preview iframes) over a
 *  BroadcastChannel. 'source' broadcasts every change and answers a
 *  late-joining frame's hello; 'preview' applies incoming state wholesale —
 *  except edge.topInset, which stays locally measured because it depends on
 *  the frame's own header height (the nav collapses at small widths).
 *
 *  A preview frame can be pinned to a template (`templateId`): it renders that
 *  template's canonical look and only goes LIVE (mirroring the main store)
 *  while that template is the active one in the main window. When another
 *  artboard takes over, the frame snaps back to its canonical template. */
export function initDitherSync(role: "source" | "preview", templateId: string | null = null, expectSourceId: string | null = null) {
  if (syncStarted || typeof BroadcastChannel === "undefined") return;
  syncStarted = true;
  syncBridge.started = true;
  syncBridge.role = role;
  syncBridge.templateId = templateId;
  const ch = new BroadcastChannel("hero-lab-dither-sync");
  syncBridge.channel = ch;
  if (role === "source") {
    // Build the sender from the current module and keep every caller pointed at
    // syncBridge.sourceSend (indirection) so an HMR that rebuilds it — see
    // refreshSourceSend — is picked up by the heartbeat and hello handler too,
    // never a captured stale closure.
    listeners.add(refreshSourceSend());
    ch.onmessage = (e) => {
      if (e.data?.type === "hello") syncBridge.sourceSend?.();
    };
    // Heartbeat: re-broadcast periodically so a frame that missed a message
    // (HMR reload, throttled background tab) always converges instead of
    // staying stale forever. Frames skip identical payloads, so idle
    // heartbeats cost nothing downstream.
    setInterval(() => syncBridge.sourceSend?.(), 1500);
  } else {
    // Canonical artboards hold a STATIC preview (one rendered frame, zero GPU
    // work) — animation runs only on the artboard being edited.
    const applyCanonicalPaused = () => {
      if (!templateId) return;
      applyHeroTemplate(templateId);
      state = { ...state, animation: { ...state.animation, playing: false } };
      emit();
    };
    applyCanonicalPaused();
    configurePreviewSync(templateId, expectSourceId);
    ch.onmessage = (e) => {
      syncBridge.applyMessage?.(e.data as DitherSyncMessage);
    };
    ch.postMessage({ type: "hello" });
  }
}
