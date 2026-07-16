/**
 * APCA-based contrast utilities for CTA text/background selection.
 *
 * For terminal themes we want to preserve the accent color, but also guarantee
 * readable CTA text. This module can slightly nudge the background toward white
 * or black until the selected text color meets the APCA threshold.
 */

type Rgb = [number, number, number]
type TextHex = '#FFFFFF' | '#14141E'

const WHITE_RGB: Rgb = [255, 255, 255]
const DARK_RGB: Rgb = [20, 20, 30]
const WHITE_HEX: TextHex = '#FFFFFF'
const DARK_HEX: TextHex = '#14141E'

function normalizeHex(hex: string): string | null {
  const input = hex.trim()
  const short = /^#([0-9a-f]{3})$/i.exec(input)
  if (short) {
    const [r, g, b] = short[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  const full = /^#([0-9a-f]{6})$/i.exec(input)
  if (!full) return null
  return `#${full[1].toUpperCase()}`
}

function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const h = normalized.slice(1)
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(rgb: Rgb): `#${string}` {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase()
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const tt = Math.max(0, Math.min(1, t))
  return [
    a[0] + (b[0] - a[0]) * tt,
    a[1] + (b[1] - a[1]) * tt,
    a[2] + (b[2] - a[2]) * tt,
  ]
}

function sRGBtoLin(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function rgbToY(r: number, g: number, b: number): number {
  return 0.2126729 * sRGBtoLin(r) + 0.7151522 * sRGBtoLin(g) + 0.0721750 * sRGBtoLin(b)
}

function apcaLc(textRgb: Rgb, bgRgb: Rgb): number {
  let txtY = rgbToY(...textRgb)
  let bgY = rgbToY(...bgRgb)

  txtY = txtY > 0.022 ? txtY : txtY + Math.pow(0.022 - txtY, 1.414)
  bgY = bgY > 0.022 ? bgY : bgY + Math.pow(0.022 - bgY, 1.414)

  if (Math.abs(bgY - txtY) < 0.0005) return 0

  if (bgY > txtY) {
    const lc = (Math.pow(bgY, 0.56) - Math.pow(txtY, 0.57)) * 1.14
    if (lc < 0.1) return 0
    return (lc - 0.027) * 100
  }

  const lc = (Math.pow(bgY, 0.65) - Math.pow(txtY, 0.62)) * 1.14
  if (lc > -0.1) return 0
  return (lc + 0.027) * 100
}

function absLc(textRgb: Rgb, bgRgb: Rgb): number {
  return Math.abs(apcaLc(textRgb, bgRgb))
}

interface CandidateResult {
  textHex: TextHex
  bgHex: `#${string}`
  lc: number
  mixAmount: number
}

function solveCandidate(baseBg: Rgb, textHex: TextHex, threshold: number): CandidateResult {
  const textRgb = textHex === WHITE_HEX ? WHITE_RGB : DARK_RGB
  const mixTarget = textHex === WHITE_HEX ? ([0, 0, 0] as Rgb) : ([255, 255, 255] as Rgb)
  const baseLc = absLc(textRgb, baseBg)
  let best: CandidateResult = {
    textHex,
    bgHex: rgbToHex(baseBg),
    lc: baseLc,
    mixAmount: 0,
  }

  if (baseLc >= threshold) return best

  const steps = 100
  for (let i = 1; i <= steps; i += 1) {
    const amount = i / steps
    const mixedBg = mixRgb(baseBg, mixTarget, amount)
    const lc = absLc(textRgb, mixedBg)
    if (lc > best.lc) {
      best = {
        textHex,
        bgHex: rgbToHex(mixedBg),
        lc,
        mixAmount: amount,
      }
    }
    if (lc >= threshold) {
      return {
        textHex,
        bgHex: rgbToHex(mixedBg),
        lc,
        mixAmount: amount,
      }
    }
  }

  return best
}

export interface AccessibleCtaPair {
  backgroundHex: `#${string}`
  textHex: TextHex
  lc: number
  passes: boolean
  adjusted: boolean
  mixAmount: number
}

/**
 * Build an APCA-safe CTA pair from a base background color.
 *
 * Strategy:
 * 1) Try white and dark text against the base color.
 * 2) If needed, minimally nudge background toward black/white for each text.
 * 3) Pick the solution with the smallest color shift (then higher Lc on ties).
 */
export function getAccessibleCtaPair(bgHex: string, threshold = 60): AccessibleCtaPair {
  const bgRgb = hexToRgb(bgHex)
  if (!bgRgb) {
    return {
      backgroundHex: '#1A8A70',
      textHex: WHITE_HEX,
      lc: 0,
      passes: false,
      adjusted: true,
      mixAmount: 1,
    }
  }

  const whiteCandidate = solveCandidate(bgRgb, WHITE_HEX, threshold)
  const darkCandidate = solveCandidate(bgRgb, DARK_HEX, threshold)

  const whitePass = whiteCandidate.lc >= threshold
  const darkPass = darkCandidate.lc >= threshold

  let chosen = whiteCandidate
  if (whitePass && darkPass) {
    chosen = whiteCandidate.mixAmount <= darkCandidate.mixAmount
      ? whiteCandidate
      : darkCandidate
  } else if (darkPass) {
    chosen = darkCandidate
  } else if (!whitePass && !darkPass) {
    chosen = darkCandidate.lc > whiteCandidate.lc ? darkCandidate : whiteCandidate
  }

  return {
    backgroundHex: chosen.bgHex,
    textHex: chosen.textHex,
    lc: chosen.lc,
    passes: chosen.lc >= threshold,
    adjusted: chosen.mixAmount > 0,
    mixAmount: chosen.mixAmount,
  }
}

export function getContrastValues(bgHex: string): { lcWhite: number; lcDark: number } {
  const bg = hexToRgb(bgHex)
  if (!bg) return { lcWhite: 0, lcDark: 0 }
  return {
    lcWhite: apcaLc(WHITE_RGB, bg),
    lcDark: apcaLc(DARK_RGB, bg),
  }
}
