import { useLayoutEffect, type RefObject } from 'react'

/** Headline fit: the authored size (copy.headlineSize, a vw clamp) is the
 *  ceiling, and the headline steps down in whole px until it sets in 3 lines.
 *  Below desktop (1024px) it gives up on 3 once that needs more than a 20% cut
 *  and settles for 4. It never goes below 1.6x the sub's size, so the headline
 *  keeps its rank over the body even when it cannot reach 4 lines.
 *
 *  Why a fit rule and not only tuned clamps: the clamps read the viewport, but
 *  the hero column is narrower than the viewport whenever the Design Panel is
 *  open (1440 viewport, 1040 hero), so a size tuned for one width wraps to 5-6
 *  lines in the other.
 *
 *  The result is written to `--hl-fit-size` on the element (React never owns
 *  that property, so re-renders keep it). The h1's fontSize reads
 *  `var(--hl-fit-size, <authored size>)`. Runs before paint: in a layout effect
 *  on copy change, in a ResizeObserver callback on column-width change, and
 *  when a web font finishes loading. */
export function useHeadlineFit(ref: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const lineCount = () => {
      const cs = getComputedStyle(el)
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2
      return Math.round(el.getBoundingClientRect().height / lh)
    }
    const fit = () => {
      el.style.removeProperty('--hl-fit-size')
      const lines = lineCount()
      if (lines <= 3) return
      const base = parseFloat(getComputedStyle(el).fontSize)
      const sub = el.parentElement?.querySelector('p')
      const floor = Math.ceil(1.6 * (sub ? parseFloat(getComputedStyle(sub).fontSize) : 17))
      if (base <= floor) return
      const desktop = window.matchMedia('(min-width: 1024px)').matches
      const step = Math.max(1, Math.round(base * 0.02))
      const tryDown = (target: number, min: number) => {
        for (let px = Math.floor(base) - step; px >= min; px -= step) {
          el.style.setProperty('--hl-fit-size', `${px}px`)
          if (lineCount() <= target) return true
        }
        return false
      }
      if (tryDown(3, desktop ? floor : Math.max(floor, Math.ceil(base * 0.8)))) return
      el.style.removeProperty('--hl-fit-size')
      if (lines <= 4 || tryDown(4, floor)) return
      el.style.setProperty('--hl-fit-size', `${floor}px`)
    }
    fit()
    // Width only: the fit itself changes the column's height.
    let width = el.parentElement?.clientWidth ?? 0
    const ro = new ResizeObserver(() => {
      const w = el.parentElement?.clientWidth ?? 0
      if (w === width) return
      width = w
      fit()
    })
    if (el.parentElement) ro.observe(el.parentElement)
    document.fonts.addEventListener('loadingdone', fit)
    let live = true
    document.fonts.ready.then(() => { if (live) fit() })
    return () => {
      live = false
      ro.disconnect()
      document.fonts.removeEventListener('loadingdone', fit)
    }
  }, [ref, key])
}
