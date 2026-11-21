type NetworkInformation = { saveData?: boolean; effectiveType?: string }

/** True when the visitor asked to save data or is on a slow connection.
 *  `navigator.connection` and `prefers-reduced-data` exist only in Chromium,
 *  so treat this as a hint: elsewhere it returns false. index.html repeats
 *  this test inline for the static shell; keep the two in step. */
export function prefersLessData(): boolean {
  const c = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (c?.saveData) return true
  if (c?.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType)) return true
  return window.matchMedia('(prefers-reduced-data: reduce)').matches
}
