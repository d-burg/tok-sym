/**
 * CENTAUR (Compact Experimental Negative TriAngUlarity Reactor) limiter geometry.
 *
 * Negative-triangularity Q > 1 demonstration machine (SPARC-class).
 * R₀ = 2.0 m, a = 0.72 m, κ = 1.65, δ = −0.55, B₀ = 10.9 T.
 *
 * Limiter contour in (R, Z) metres, computed from the CENTAUR design study
 * (The CENTAUR Collaboration, January 2026). The contour is vertically
 * symmetric — bottom_lim is mirrored (reversed, Z negated) to form top_lim,
 * and both halves are concatenated.
 *
 * The contour includes the divertor "neck" features (pinch points near
 * the X-point region) characteristic of the NT snowflake-like divertor.
 */
export const CENTAUR_LIMITER: [number, number][] = [
  // ─── Bottom half (Z < 0) ───
  [1.26,          -0.27],
  [1.45,          -0.69],
  [2.178,         -1.2],
  [2.178,         -1.293],       // first divertor neck
  [2.283,         -1.56],
  [2.46303142,    -1.37471264],
  [2.7,           -1.42],
  [2.674,         -1.2375],      // second divertor neck
  [2.6,           -1.1],
  [2.73,          -0.45517241],
  // ─── Top half (Z > 0), mirrored ───
  [2.73,           0.45517241],
  [2.6,            1.1],
  [2.674,          1.2375],      // second divertor neck (mirrored)
  [2.7,            1.42],
  [2.46303142,     1.37471264],
  [2.283,          1.56],
  [2.178,          1.293],       // first divertor neck (mirrored)
  [2.178,          1.2],
  [1.45,           0.69],
  [1.26,           0.27],
]
