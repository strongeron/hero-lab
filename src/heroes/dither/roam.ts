/** Roam: the warp blob's own path, with no pointer. One pure function of the
 *  roam clock (seconds), shared by the hero and the panel/Recipe previews.
 *  Each axis is a sum of two sines with incommensurate frequencies, so the
 *  path never repeats. At t = 0 the pose is the still one (reduced motion):
 *  a little right of and above the centre, full radius, no morph. */
export interface RoamPose {
  /** Blob centre, 0–1 across the visible field. */
  x: number
  y: number
  /** Radius multiplier (breathing), about 0.72–1.28. */
  breath: number
  /** Shape morph signals, −1…1 each (rotate, round, scale). */
  m1: number
  m2: number
  m3: number
}

export function roamPose(t: number): RoamPose {
  return {
    x: 0.5 + 0.3 * Math.sin(t * 0.17) + 0.14 * Math.sin(t * 0.43 + 0.8),
    y: 0.5 + 0.26 * Math.sin(t * 0.23) + 0.14 * Math.sin(t * 0.59 + 3.5),
    breath: 1 + 0.2 * Math.sin(t * 0.71) + 0.08 * Math.sin(t * 1.63),
    m1: Math.sin(t * 0.37),
    m2: Math.sin(t * 0.53),
    m3: Math.sin(t * 0.47),
  }
}

export interface WarpShapeLike { rotate: number; round: number; scale: number }

/** The warp feel, morphed by a pose. `amount` (0–1) fades the morph out when
 *  the pointer takes over. Stays in the feel's character: Crisp only tilts a
 *  little and softens its corners a touch; Bubble swings round its 35°. */
export function morphShape<T extends WarpShapeLike>(base: T, p: RoamPose, amount = 1): T {
  if (amount <= 0) return base
  return {
    ...base,
    rotate: base.rotate + amount * p.m1 * Math.max(6, 0.4 * Math.abs(base.rotate)),
    round: Math.min(1, Math.max(0, base.round + amount * 0.2 * p.m2)),
    scale: Math.min(1, Math.max(0.3, base.scale - amount * 0.12 * (0.5 + 0.5 * p.m3))),
  }
}
