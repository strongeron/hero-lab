import { useSyncExternalStore } from "react";
import { getThemeById } from "../../themes/terminalThemes";
import { getAccessibleCtaPair } from "../../utils/colorContrast";

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

export interface DitherAlphaLayer {
  color: string;
  opacity: number;
  shape: DitheringShape;
}

export type HeaderBgMode = "transparent" | "solid";
/** How the scene meets the copy block. 'dissolve' drops tiles out in a band at
 *  Position; 'full' fills the whole hero and carves whole-tile clearance around
 *  each text block with a dissolve rim (GPU tile field only). */
export type EdgeMode = "dissolve" | "full";

/* ─── Copy Variations ─── */

export type DitherCopyColorMode = "current" | "white";

export interface DitherCopy {
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
  /** Sub font-size override (default 17px, 20px from md). Monospace sets it
   *  smaller: its wide advance makes the same px read ~15% larger. */
  subSize?: string;
  /** CTA font-size override (default 16px, 18px from xl). */
  ctaSize?: string;
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
  | "broke-fixed";

export const copyVariants: Record<CopyVariantId, DitherCopy & { label: string }> =
  {
    // Template-only variant: preserves the Broke / Fixed copy while giving the
    // Fine Grain artboard its own typography instead of mutating Broke/Fixed.
    "fine-grain": {
      label: "Fine Grain",
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
      // Body and CTA run in Instrument Sans, the serif's own companion family:
      // same foundry, matched x-height and proportions, so the condensed serif
      // headline and the sans sub read as one system. Before, the sub fell back
      // to Inter and the CTA to the panel's body face (DM Sans): two unrelated
      // sans under one serif. The wordmark keeps the serif (it reads elegant at
      // 18px); CTAs stay sans because Instrument Serif ships a 400 weight only,
      // which reads fragile on a filled 16px pill.
      subFont: "'Instrument Sans', sans-serif",
      ctaFont: "'Instrument Sans', sans-serif",
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
      // Mono scale, ~0.85× the sans copies: a fixed advance makes JetBrains
      // Mono read about 15% larger than a proportional face at the same px,
      // and its sub ran 20px, louder than a sans sub. Sub, response and CTA
      // follow the same step so the whole block keeps its proportions.
      headlineSize: "clamp(2.5rem, 4vw + 1rem, 4.5rem)",
      subSize: "clamp(15px, 0.4vw + 13px, 17px)",
      ctaSize: "clamp(14px, 0.3vw + 12.5px, 16px)",
      responseFontMode: "headline",
      responseSize: "28px",
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
      headline: "Something broke. You should already know what.",
      sub: "Errors, performance, and logs — one place. Five-minute install.",
      response: "Caught everything. Start at line\u00A042.",
      cta: "Start free in 5 minutes",
      headlineColorMode: "white",
      // Geist Mono over JetBrains: same terminal voice, but circular bowls and
      // round dots that echo the point-field geometry instead of fighting it.
      headlineFont: "'Geist Mono', monospace",
      headlineWeight: 500,
      // Mono scale (see "ai"): ~0.85× the sans size, same tight tracking.
      headlineSize: "clamp(2.375rem, 3.4vw + 1rem, 3.875rem)",
      headlineLeading: "1.08",
      headlineTracking: "-0.04em",
      responseFontMode: "headline",
      responseSize: "30px",
      responseFontStyle: "normal",
      responseWeight: 400,
    },
  };

export const copyVariantIds: CopyVariantId[] = [
  "fine-grain",
  "full-bleed",
  "provocateur",
  "value",
  "ship-it",
  "ai",
  "speed",
  "broke-fixed",
];

/** The resting scene: a stack of screen-blended colour layers over `colorBack`.
 *  Paper renders it without a pixel grid; the GPU tile field samples it with one. */
export interface DitherShaderConfig {
  colorBack: string;
  /** Stacked colour layers, each with its own opacity and dither shape */
  alphaLayers: DitherAlphaLayer[];
  /** Paper dither matrix (no pixel grid only) */
  type: DitheringType;
  /** Paper dither cell size in CSS px (no pixel grid only). Rendered as a whole
   *  number of pixels. */
  size: number;
  /** Speed of colour cycling across the layers (0 = static) */
  colorCycleSpeed: number;
  /** Offset between layers — higher = more separation between colour blobs */
  alphaSpread: number;
  /** Paper time speed (scenes set it) */
  speed: number;
  scale: number;
  rotation: number;
}

export interface DitherEdgeConfig {
  mode: EdgeMode;
  /** Where shader coverage ends (% of viewport height, 30–90) */
  position: number;
  /** 'dissolve' mode: how many tile rows the random drop-out band spans. */
  dissolveDepth: number;
  /** 'dissolve' mode: PRNG seed — change it to reshuffle which tiles drop out. */
  dissolveSeed: number;
  /** Extend the dissolve band below Position into the copy area (px). */
  shaderExtend: number;
  /** Noise strength in the dissolve band and the Full rim (0 = static, 1 = lively). */
  textBlendMotion: number;
  /** Noise animation speed (Hz). */
  textBlendSpeed: number;
  /** 'full' mode — what the clearance traces: 'lines' hugs each rendered text
   *  line; 'box' clears the whole element rectangle. */
  textRectMode: "lines" | "box";
  /** 'full' mode: clear distance (px) kept between shapes and text blocks. */
  fullPadding: number;
  /** Top start (px) — first row of shapes begins at the first whole tile at or
   *  below this line, so nothing is cut by the fixed header. */
  topInset: number;
}

/** How the pixel grid draws the scene: snapped colour per tile, or point sizes. */
export type TileDisplayMode = "color" | "points";

/** The hover: warp reveal inside a pixel circle of whole tiles. Tiles under the
 *  cursor rotate, round and resize and show the other state's layers. */
/** What drives the warp: the pointer, a roaming blob, or both (pointer wins). */
export type WarpMode = "hover" | "roam" | "both";

export interface DitherHoverConfig {
  enabled: boolean;
  /** Hover = pointer only; Roam = one blob drifts by itself; Both = Roam, the pointer takes over. */
  mode: WarpMode;
  /** The other state's layers, revealed under the cursor */
  hoverLayers: DitherAlphaLayer[];
  /** Radius of the pixel circle in px (snaps to whole tile rings) */
  radius: number;
  /** Rotation (deg) of warped tiles. */
  warpRotate: number;
  /** Corner rounding (0–1) of warped tiles. */
  warpRound: number;
  /** Warped tile size toward the full piece (0–1). */
  warpScale: number;
  /** Random big→small range for warped tiles (0 = uniform, 1.5 = down to tiny). */
  warpJitter: number;
  /** Short log strings surface below the cursor while revealing. */
  warpErrorText: boolean;
}

/** Pixel grid — the scene shows only through a lattice of rounded tiles.
 *  Pitch = cell / divisions, a whole number of px. */
export interface DitherPixelGridConfig {
  enabled: boolean;
  /** Master tile size in px, divided into `divisions` equal pieces per axis. */
  cell: number;
  divisions: number;
  /** Gap in px between pieces */
  gap: number;
  /** Corner radius of each piece in px (0 = sharp squares) */
  radius: number;
  /** One stable colour sample per tile (GPU tile field). Off = Paper dither
   *  flows freely under a CSS tile mask. */
  snap: boolean;
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
  /** Motion speed multiplier for every loop (1 = as authored). The panel's
   *  Speed control; scenes and templates never set it. */
  speed: number;
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
  /* ── Loop break — non-looping motion layered on top of the scene ── */
  /** How to break the repeating feel (rotate / drift / orbit / wander / none) */
  loopBreak: LoopBreakMode;
  /** Loop-break intensity (0 = off, 1 = strong) */
  loopBreakAmount: number;
  /* ── Tile size animation (pixel grid) ── */
  tileDisplay: TileDisplayMode;
  /** Size spread — 0 = uniform max piece, 1 = down to tiny (gaps preserved). */
  tileSizeSpread: number;
  /** Tile size animation speed (Hz). */
  tileSizeSpeed: number;
  /** Perlin noise spatial scale for tile sizes. */
  tileSizeNoise: number;
  /** Point sizes only: 0 = authored sizes, 1 = dots swing between specks and
   *  full pieces, with the travelling wave weighted up so the pulse reads. */
  tileSizeContrast: number;
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
  /** Debug overlay: column grid plus the left/right/top/bottom content edges
   *  (header row and copy block), to check every element sits on one frame. */
  showGuides: boolean;
}

/** Where the copy sits. 'split': headline left, response + CTA right, at the
 *  bottom (the original hero). 'centered': headline, sub and CTA in the
 *  middle; the field fills the hero and flows round each text line (the
 *  'full' edge, shaped by the same edge controls). A layout option on top of
 *  any template, never a template of its own. */
export type CompositionId = "split" | "centered";
export interface DitherCompositionConfig {
  mode: CompositionId;
}
export const defaultCompositionConfig: DitherCompositionConfig = { mode: "split" };
/** The 'full' edge values Centered starts from: Full Bleed's line-hugging
 *  look (8px clearance, a 2-row rim that moves). */
export const centeredEdge = {
  fullPadding: 8,
  textRectMode: "lines",
  dissolveDepth: 2,
  textBlendMotion: 1,
  textBlendSpeed: 0.33,
} satisfies Partial<DitherEdgeConfig>;
/** Size contrast Centered uses on a point field whose template authored none,
 *  so dots swing between specks and full pieces round the copy. */
export const CENTERED_SIZE_CONTRAST = 0.7;
/** Centered's edge stops in the Design Panel (opinionated presets). Clearance
 *  = edge.fullPadding (CSS px), rim = edge.dissolveDepth (tile rows), rim
 *  motion = edge.textBlendMotion (GPU tile field only: the Paper clearance
 *  mask is static). */
export const clearanceStops = [
  { value: 4, label: "Hug" },
  { value: 8, label: "Tight" },
  { value: 16, label: "Snug" },
] as const;
export const rimStops = [
  { value: 1, label: "Crisp" },
  { value: 2, label: "Soft" },
  { value: 4, label: "Feathered" },
] as const;
export const rimMotionStops = [
  { value: 0, label: "Still" },
  { value: 0.5, label: "Calm" },
  { value: 1, label: "Lively" },
] as const;

export interface DitherState {
  headerBg: HeaderBgMode;
  composition: DitherCompositionConfig;
  shader: DitherShaderConfig;
  edge: DitherEdgeConfig;
  hover: DitherHoverConfig;
  pixelGrid: DitherPixelGridConfig;
  animation: DitherAnimationConfig;
  layout: DitherLayoutConfig;
  button: DitherButtonConfig;
  copyVariant: CopyVariantId;
  /** Which named state is shown at rest. The other becomes the hover reveal. */
  initialState: InitialStateId;
  activeScene: SceneTemplateId | null;
  /** Last applied hero template (picker highlight); null = untracked/custom */
  activeTemplate: string | null;
  /** Active terminal theme ID (null = default colors) */
  terminalTheme: string | null;
  /** Colour pair for both states (rest and reveal). See `palettes`. */
  palette: PaletteId;
  /** Tested type pair laid over the copy's own fonts; null = the copy's own. */
  typePair: TypePairId | null;
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
  alphaLayers: defaultAlphaLayers.map((l) => ({ ...l })),
  type: "8x8",
  size: 16,
  colorCycleSpeed: 0.15,
  alphaSpread: 0.04,
  speed: 0.12,
  scale: 0.21,
  rotation: 8,
};

export const defaultEdgeConfig: DitherEdgeConfig = {
  mode: "dissolve",
  position: 62,
  dissolveDepth: 7,
  dissolveSeed: 1,
  shaderExtend: 160,
  textBlendMotion: 0.35,
  textBlendSpeed: 0.08,
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

// Warp reveal + error text is the hover story: the resting problem scene peels
// back to the fix (or vice versa) with log fragments below.
export const defaultHoverConfig: DitherHoverConfig = {
  enabled: true,
  mode: "hover",
  hoverLayers: fixLayers.map((l) => ({ ...l })),
  radius: 100,
  warpRotate: 35,
  warpRound: 1,
  warpScale: 1,
  warpJitter: 1.5,
  warpErrorText: true,
};

export const defaultPixelGridConfig: DitherPixelGridConfig = {
  enabled: true,
  cell: 96,
  divisions: 4,
  gap: 6,
  radius: 40,
  snap: true,
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
  showGuides: false,
};

export const defaultAnimationConfig: DitherAnimationConfig = {
  playing: true,
  speed: 1,
  // Texture lives here (pulse); the non-looping motion is the
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
  loopBreak: "orbit",
  loopBreakAmount: 0.5,
  tileDisplay: "color",
  tileSizeSpread: 0.55,
  tileSizeSpeed: 0.12,
  tileSizeNoise: 1.2,
  tileSizeContrast: 0,
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
      tileSizeSpread: 0.65,
      tileSizeSpeed: 0.16,
      tileSizeNoise: 1.2,
    },
  },
  "error-sweep": {
    label: "Error Sweep",
    desc: "Diagonal scan with a vertical wave",
    // 2026-11-22: was 3× the other scenes (speed 0.36, rotation 1.2, scan
    // 0.85 @ 0.2 Hz, wave 0.42 @ 0.24 Hz). Under Problem's large square tiles
    // (and its 1.8× rest boost) nearly every tile flipped within 0.3s, which
    // read as flicker, not a sweep. These values keep the diagonal sweep and
    // the wave but let shapes flow tile to tile.
    shader: {
      speed: 0.12,
      colorCycleSpeed: 0.15,
    },
    animation: {
      driftY: 0,
      driftX: 0,
      rotationDrift: 0.3,
      pulseAmount: 0.035,
      pulseSpeed: 0.18,
      scanMode: "oscillate" as const,
      scanAmplitude: 0.35,
      scanSpeed: 0.08,
      scanAngle: 30,
      waveAmplitude: 0.18,
      waveSpeed: 0.1,
      waveAngle: 90,
      tileSizeSpread: 0.6,
      tileSizeSpeed: 0.13,
      tileSizeNoise: 1.15,
    },
  },
  "deep-breath": {
    label: "Deep Breath",
    desc: "Slow, deep meditative breathing",
    shader: {
      speed: 0.06,
      colorCycleSpeed: 0.32,
    },
    animation: {
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
  composition: { ...defaultCompositionConfig },
  shader: { ...defaultShaderConfig },
  edge: { ...defaultEdgeConfig },
  hover: { ...defaultHoverConfig },
  pixelGrid: { ...defaultPixelGridConfig },
  animation: { ...defaultAnimationConfig },
  layout: { ...defaultLayoutConfig },
  button: { ...defaultButtonConfig },
  copyVariant: "broke-fixed",
  initialState: "problem",
  activeScene: null,
  activeTemplate: null,
  terminalTheme: null,
  stableColorField: false,
  palette: "signal",
  typePair: null,
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
// A hot update keeps the previous state on window; it may predate new keys.
const kept = storeWindow?.__ditherState;
let state: DitherState = kept
  ? { ...kept, composition: { ...defaults.composition, ...kept.composition }, animation: { ...defaults.animation, ...kept.animation }, hover: { ...defaults.hover, ...kept.hover } }
  : structuredClone(defaults);
if (storeWindow) {
  storeWindow.__ditherState = state;
  storeWindow.__dither = () => state;
}

type DitherSyncMessage = { type: "state"; state: DitherState; sourceId?: string };
interface DitherSyncBridge {
  started?: boolean;
  role?: "source" | "preview";
  templateId?: string | null;
  live?: boolean;
  lastAppliedJson?: string;
  sourceSend?: () => void;
  snapshot?: () => { state: DitherState };
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
syncBridge.snapshot = () => ({ state });
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
    const latest = syncBridge.snapshot?.() ?? { state };
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

/** The current state, outside React (e.g. to snapshot a template as applied). */
export const getDitherState = getSnapshot;

export function useDitherStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* ─── Actions ─── */

/** Shader keys a scene may drive — MOTION ONLY. Scenes never touch look keys
 *  (scale, alphaSpread, shapes, colours, pixel grid). */
const SCENE_SHADER_KEYS: (keyof DitherShaderConfig)[] = [
  "speed", "colorCycleSpeed",
];
/** Animation keys a scene may drive (excludes 'playing' and — deliberately —
 *  'tileDisplay': the tile renderer is a look choice, not a motion one). */
const SCENE_ANIM_KEYS: (keyof DitherAnimationConfig)[] = [
  "driftY", "driftX", "rotationDrift", "pulseAmount", "pulseSpeed",
  "scanMode", "scanAmplitude", "scanSpeed", "scanAngle",
  "waveAmplitude", "waveSpeed", "waveAngle",
  "loopBreak", "loopBreakAmount",
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
  // Not "orbit": its pan wrapped ±2 units (×1.8 on Problem), pushing centred
  // shapes off canvas and jumping the whole field on each wrap, and its
  // 4°/s spin was ~13× the scene's own rotation. Scan 0.08 Hz, wave 0.1 Hz and
  // pulse 0.18 Hz already never line up, so the scene does not visibly loop.
  "error-sweep": "none",
  "deep-breath": "rotate",
  "solid-classic": "none",
};

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
  const base = paletteLayers(state.palette, id);
  const reveal = paletteLayers(state.palette, id === "fix" ? "problem" : "fix");
  const baseOpacities = state.shader.alphaLayers.map((layer) => layer.opacity);
  const revealOpacities = state.hover.hoverLayers.map((layer) => layer.opacity);
  state.initialState = id;
  state.shader = {
    ...state.shader,
    alphaLayers: base.map((l, i) => ({
      ...l,
      opacity: baseOpacities[i] ?? l.opacity,
    })),
  };
  state.hover = {
    ...state.hover,
    hoverLayers: reveal.map((l, i) => ({
      ...l,
      opacity: revealOpacities[i] ?? l.opacity,
    })),
  };
  emit();
}

export function setPixelGridConfig(patch: Partial<DitherPixelGridConfig>) {
  state.pixelGrid = { ...state.pixelGrid, ...patch };
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

/** Switch the layout. Centered sets the line-hugging edge values and, when
 *  the size contrast is 0, a lively one; Split puts back the active
 *  template's authored values (the defaults without a template). */
export function setComposition(mode: CompositionId) {
  if (state.composition.mode === mode) return;
  if (mode === "centered") {
    state.edge = { ...state.edge, ...centeredEdge };
    const points = state.pixelGrid.enabled && state.animation.tileDisplay === "points";
    if (points && !state.animation.tileSizeContrast) state.animation = { ...state.animation, tileSizeContrast: CENTERED_SIZE_CONTRAST };
  } else {
    const tmpl = heroTemplates.find((t) => t.id === state.activeTemplate);
    const authored = { ...defaultEdgeConfig, ...tmpl?.edge };
    const keys = Object.keys(centeredEdge) as (keyof typeof centeredEdge)[];
    state.edge = { ...state.edge, ...Object.fromEntries(keys.map((k) => [k, authored[k]])) };
    state.animation = { ...state.animation, tileSizeContrast: tmpl?.animation?.tileSizeContrast ?? defaultAnimationConfig.tileSizeContrast };
  }
  state.composition = { mode };
  emit();
}

export function setButtonConfig(patch: Partial<DitherButtonConfig>) {
  state.button = { ...state.button, ...patch };
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

/** Layers-explorer only: set scene-motion keys (speeds) WITHOUT detaching
 *  from the active scene, so a speed preset keeps the scene selected. */
export function setSceneMotion(shader: Partial<DitherShaderConfig>, animation: Partial<DitherAnimationConfig>) {
  state.shader = { ...state.shader, ...shader };
  state.animation = { ...state.animation, ...animation };
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

/* ─── Design Panel presets ───
   The panel offers curated choices, not free values: each preset is checked to
   keep the resting state and the hover intact (whole-pixel sizes, readable
   text, a reveal that contrasts with the rest). */

export type PaletteId = "signal" | "ember" | "ultra" | "mono" | "prism" | "aurora";
type Trio = [string, string, string];
export interface Palette {
  label: string;
  hint: string;
  back: string;
  problem: Trio;
  fix: Trio;
  /** CTA fill when it should not be the reveal colour fix[0]. */
  cta?: string;
}
export const palettes: Record<PaletteId, Palette> = {
  signal: { label: "Signal", hint: "pink → teal", back: "#0A1714",
    problem: ["#E6307A", "#FF6B2B", "#FF3366"], fix: ["#2DD4A8", "#3ECF8E", "#1A8A70"], cta: "#1A8A70" },
  ember: { label: "Ember", hint: "orange → blue", back: "#0B0F1A",
    problem: ["#FF7A1A", "#FFB020", "#E8432E"], fix: ["#3BA4FF", "#6BC6FF", "#1F5FD1"] },
  ultra: { label: "Ultra", hint: "violet → lime", back: "#0E0A16",
    problem: ["#B04BFF", "#FF4FD8", "#7A2CFF"], fix: ["#C6F432", "#7FE06A", "#3FAF5A"] },
  mono: { label: "Mono", hint: "grey → pink", back: "#0C0C0E",
    problem: ["#F2F2F2", "#9A9AA2", "#5A5A62"], fix: ["#E6307A", "#FF6B2B", "#FF3366"] },
  // Multi-colour pairs: one distinct hue per layer instead of three shades of
  // one hue. This replaces the old separate multi-colour mode; the three
  // resting layers already are the colour layers.
  // Prism and Aurora were near twins (warm trio at rest, teal-led cool trio
  // on hover, same #2DD4A8 CTA). Now: Prism is additive vs subtractive
  // primaries on a neutral black, with its own violet accent; Aurora is a
  // sunset over a night sky, revealing aurora greens, and keeps a mint CTA.
  prism: { label: "Prism", hint: "RGB → CMY", back: "#0B0B0F",
    problem: ["#FF3B5C", "#34E07A", "#3D7BFF"], fix: ["#2EE6E6", "#FF4FD8", "#FFE14D"], cta: "#6D5BFF" },
  aurora: { label: "Aurora", hint: "sunset → aurora", back: "#070B1A",
    problem: ["#FF5E7E", "#FF9F45", "#FFD36E"], fix: ["#3DFFB0", "#2BB8FF", "#9D7BFF"] },
};
export const paletteIds = Object.keys(palettes) as PaletteId[];

/** CTA colours for the hero and its header. A terminal theme brings its own
 *  accent; otherwise the CTA takes the palette's reveal colour, so the buttons
 *  match the response line and the hover reveal instead of a fixed teal.
 *  APCA nudges the fill until the label reads (Lc 60). */
export function heroCtaColors(paletteId: PaletteId, terminalThemeId?: string | null) {
  const theme = terminalThemeId ? getThemeById(terminalThemeId) : undefined;
  const p = palettes[paletteId];
  const pair = getAccessibleCtaPair(theme ? theme.accent2 : (p.cta ?? p.fix[0]), 60);
  return {
    bg: pair.backgroundHex,
    text: pair.textHex,
    hover: `oklch(from ${pair.backgroundHex} calc(l + 0.08) c h)`,
  };
}

/** A state's authored layers (shapes, opacities) in a palette's colours. */
function paletteLayers(palette: PaletteId, which: InitialStateId): DitherAlphaLayer[] {
  const src = which === "fix" ? fixLayers : problemLayers;
  return src.map((l, i) => ({ ...l, color: palettes[palette][which][i] }));
}

/** Recolour both states; shapes and opacities stay as they are. */
export function setPalette(id: PaletteId) {
  const p = palettes[id];
  const rest = state.initialState;
  const reveal = rest === "fix" ? "problem" : "fix";
  state.palette = id;
  state.terminalTheme = null;
  state.shader = {
    ...state.shader,
    colorBack: p.back,
    alphaLayers: state.shader.alphaLayers.map((l, i) => ({ ...l, color: p[rest][i] ?? l.color })),
  };
  state.hover = {
    ...state.hover,
    hoverLayers: state.hover.hoverLayers.map((l, i) => ({ ...l, color: p[reveal][i] ?? l.color })),
  };
  emit();
}

export type TypePairId = "editorial" | "geometric" | "grotesk" | "quirky" | "soft" | "terminal";
export interface TypePair {
  label: string;
  hint: string;
  headlineFont: string;
  bodyFont: string;
  headlineWeight: number;
  headlineLeading: string;
  headlineTracking: string;
  /** Only set where the face needs it (mono advances run wide). */
  headlineSize?: string;
}
export const typePairs: Record<TypePairId, TypePair> = {
  editorial: { label: "Editorial", hint: "Instrument", headlineFont: "'Instrument Serif', Georgia, serif", bodyFont: "'Instrument Sans', Inter, sans-serif", headlineWeight: 400, headlineLeading: "1.02", headlineTracking: "-0.01em" },
  geometric: { label: "Geometric", hint: "Outfit", headlineFont: "'Outfit', Inter, sans-serif", bodyFont: "'Outfit', Inter, sans-serif", headlineWeight: 500, headlineLeading: "1.0", headlineTracking: "-0.02em" },
  grotesk: { label: "Grotesk", hint: "Space Grotesk + Inter", headlineFont: "'Space Grotesk', Inter, sans-serif", bodyFont: "'Inter', system-ui, sans-serif", headlineWeight: 500, headlineLeading: "1.0", headlineTracking: "-0.03em" },
  quirky: { label: "Quirky", hint: "Bricolage + Inter", headlineFont: "'Bricolage Grotesque', Inter, sans-serif", bodyFont: "'Inter', system-ui, sans-serif", headlineWeight: 500, headlineLeading: "1.0", headlineTracking: "-0.03em" },
  soft: { label: "Soft serif", hint: "Fraunces + DM Sans", headlineFont: "'Fraunces', Georgia, serif", bodyFont: "'DM Sans', Inter, sans-serif", headlineWeight: 500, headlineLeading: "1.04", headlineTracking: "-0.02em" },
  terminal: { label: "Terminal", hint: "Geist Mono + Inter", headlineFont: "'Geist Mono', ui-monospace, monospace", bodyFont: "'Inter', system-ui, sans-serif", headlineWeight: 500, headlineLeading: "1.08", headlineTracking: "-0.04em", headlineSize: "clamp(2.25rem, 3.4vw + 1rem, 3.875rem)" },
};
export const typePairIds = Object.keys(typePairs) as TypePairId[];

/** The copy as rendered: the variant's words, with a type pair's faces laid
 *  over its own when one is picked. */
export function resolveCopy(id: CopyVariantId, pair: TypePairId | null): DitherCopy {
  const copy = copyVariants[id];
  // A state from an older tab can name a pair that no longer exists.
  const p = pair ? typePairs[pair] : undefined;
  if (!p) return copy;
  return {
    ...copy,
    headlineFont: p.headlineFont,
    headlineWeight: p.headlineWeight,
    headlineLeading: p.headlineLeading,
    headlineTracking: p.headlineTracking,
    headlineSize: p.headlineSize ?? copy.headlineSize,
    subFont: p.bodyFont,
    ctaFont: p.bodyFont,
    // A pair's body face is proportional: drop a mono copy's smaller sizes.
    subSize: undefined,
    ctaSize: undefined,
    responseFontMode: "headline",
    responseFontStyle: "normal",
    tabletLayout: pair === "terminal" ? "stack" : copy.tabletLayout,
  };
}

export function setTypePair(id: TypePairId | null) {
  state.typePair = id;
  emit();
}

export type GrainId = "fine" | "medium" | "coarse" | "chunky";
/** Piece pitch in px when the pixel grid is on. */
export const grainPitch: Record<GrainId, number> = { fine: 8, medium: 12, coarse: 24, chunky: 32 };
/** Paper dot size in px when there is no grid (Fine Grain). */
export const grainDot: Record<GrainId, number> = { fine: 1, medium: 2, coarse: 4, chunky: 6 };
export const grainIds = Object.keys(grainPitch) as GrainId[];

export type GapId = "none" | "tight" | "open";
export const gapIds: GapId[] = ["none", "tight", "open"];
/** Gap in whole px for a pitch: 0, a quarter, or two fifths of it. */
export function gapFor(id: GapId, pitch: number): number {
  if (id === "none") return 0;
  return Math.min(pitch - 1, Math.max(1, Math.round(pitch * (id === "tight" ? 0.25 : 0.4))));
}
export function gridPitch(pg: DitherPixelGridConfig): number {
  return Math.max(2, Math.round(pg.cell / Math.max(1, pg.divisions)));
}

/** Set the size. On a grid this keeps the gap preset and clamps the corner
 *  radius, so the new pitch never yields a gap or radius that does not fit. */
export function setGrain(id: GrainId) {
  const pg = state.pixelGrid;
  if (!pg.enabled) {
    state.shader = { ...state.shader, size: grainDot[id] };
    emit();
    return;
  }
  const pitch = grainPitch[id];
  const oldPitch = gridPitch(pg);
  const gapId = gapIds.find((g) => gapFor(g, oldPitch) === pg.gap);
  state.pixelGrid = {
    ...pg,
    cell: pitch * pg.divisions,
    gap: gapId ? gapFor(gapId, pitch) : Math.min(pg.gap, pitch - 1),
    radius: Math.min(pg.radius, Math.floor(pitch / 2)),
  };
  emit();
}

export function setGap(id: GapId) {
  const pg = state.pixelGrid;
  state.pixelGrid = { ...pg, gap: gapFor(id, gridPitch(pg)) };
  emit();
}

export type WarpFeelId = "crisp" | "soft" | "twist" | "bubble";
type WarpFeel = Pick<DitherHoverConfig, "warpRotate" | "warpRound" | "warpJitter">;
export const warpFeels: Record<WarpFeelId, { label: string } & WarpFeel> = {
  crisp: { label: "Crisp", warpRotate: 0, warpRound: 0, warpJitter: 0 },
  soft: { label: "Soft", warpRotate: 0, warpRound: 0.5, warpJitter: 0.4 },
  twist: { label: "Twist", warpRotate: 35, warpRound: 0.2, warpJitter: 0.6 },
  bubble: { label: "Bubble", warpRotate: 35, warpRound: 1, warpJitter: 1.5 },
};
export const warpFeelIds = Object.keys(warpFeels) as WarpFeelId[];

export const warpModeIds: WarpMode[] = ["hover", "roam", "both"];
export const warpModeLabel: Record<WarpMode, string> = { hover: "Hover", roam: "Roam", both: "Both" };
export const warpModeTitle: Record<WarpMode, string> = {
  hover: "The pointer drives the warp",
  roam: "One warp blob drifts by itself, breathing and morphing",
  both: "Roams by itself; the pointer takes over while it is on the hero",
};

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
    // Points now honours Break loop and colour cycling; pin both off so Full
    // Bleed keeps the calm look it was designed with (they were no-ops here).
    shader: { colorCycleSpeed: 0 },
    animation: { tileDisplay: "points", loopBreak: "none" },
  },
  {
    id: "problem",
    name: "Problem",
    desc: "Square 24px error tiles with open gaps, pink problem state at rest; hover reveals the green fix. AI-native copy in JetBrains Mono.",
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
    // 24px tiles (Coarse, 10px Open gap). 32px (Chunky) read as a zoomed-in
    // crop: too few tiles across the hero to show a shape.
    pixelGrid: { cell: 72, divisions: 3, gap: 10, radius: 0, snap: false },
    // The most expressive color/alpha scene: diagonal scan + vertical wave,
    // slow rotation and color cycling. No loop-break pan, so the panel's
    // shape picks stay on canvas.
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
    // Only the look keys that differ from the defaults. The hover inherits the
    // field's own dither (type, size, scale), so the warp reveals whole cells
    // of the Fine Grain field instead of the coarse tiles of the gridded
    // templates. Edge and hover are the defaults.
    shader: { size: 2, scale: 0.6, speed: 0.1, colorCycleSpeed: 0.12 },
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
      loopBreak: "rotate",
      loopBreakAmount: 1.3,
      tileSizeSpread: 0.5,
      tileSizeSpeed: 0.11,
      tileSizeNoise: 1.7,
    },
  },
];

/** The Speed control's stops (animation.speed; 0 = paused). Design Panel and
 *  Layers use the same four. */
export const speedStops = [
  { value: 0, label: "Pause" },
  { value: 0.5, label: "Slow" },
  { value: 1, label: "Normal" },
  { value: 2, label: "Fast" },
  // Full Bleed's noise field reads calm even at 2×, so it needs a faster stop.
  { value: 4, label: "Rapid" },
] as const;
/** The stop for the current animation, or null for an off-stop speed. */
export function speedStop(a: Pick<DitherAnimationConfig, "playing" | "speed">) {
  const v = a.playing ? a.speed : 0;
  return speedStops.find((s) => s.value === v) ?? null;
}

/** A copy of the whole state, to put back later with restoreDitherState. */
export function snapshotDitherState(): DitherState {
  return structuredClone(state);
}

/** Put back a state taken with snapshotDitherState (Layers uses it to return
 *  the Design Panel look it took apart). */
export function restoreDitherState(snap: DitherState) {
  state = structuredClone(snap);
  emit();
}

export function applyHeroTemplate(id: string) {
  const tmpl = heroTemplates.find((t) => t.id === id);
  if (!tmpl) return;
  const base = structuredClone(defaults);
  const rest = tmpl.initialState === "fix" ? fixLayers : problemLayers;
  const reveal = tmpl.initialState === "fix" ? problemLayers : fixLayers;
  state = {
    ...base,
    // Debug overlays are a view setting, not part of a template's look: keep
    // them on while the user flips between templates to compare alignment.
    layout: { ...base.layout, showBaselines: state.layout.showBaselines, showGuides: state.layout.showGuides },
    shader: {
      ...base.shader,
      ...tmpl.shader,
      alphaLayers: rest.map((l) => ({ ...l })),
    },
    // topInset is viewport-specific (measured off the live header) — keep it.
    edge: { ...base.edge, ...tmpl.edge, topInset: state.edge.topInset },
    hover: {
      ...base.hover,
      ...tmpl.hover,
      hoverLayers: reveal.map((l) => ({ ...l })),
    },
    animation: { ...base.animation, ...tmpl.animation },
    pixelGrid: { ...base.pixelGrid, ...tmpl.pixelGrid },
    button: { ...base.button, ...tmpl.button },
    copyVariant: tmpl.copyVariant ?? base.copyVariant,
    initialState: tmpl.initialState,
    activeScene: tmpl.scene !== undefined ? tmpl.scene : base.activeScene,
    activeTemplate: id,
    palette: "signal",
    typePair: null,
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
    const json = JSON.stringify(message.state);
    if (json === syncBridge.lastAppliedJson) return;
    syncBridge.lastAppliedJson = json;
    // A tab still running older code can send state without keys added
    // since (composition, animation.tileSizeContrast, hover.mode): fill them
    // from the defaults so no reader meets undefined.
    state = {
      ...incoming,
      composition: { ...defaults.composition, ...incoming.composition },
      animation: { ...defaults.animation, ...incoming.animation },
      hover: { ...defaults.hover, ...incoming.hover },
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
