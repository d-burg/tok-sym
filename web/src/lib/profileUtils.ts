import type { ProfileFrame, ProcessedProfile } from './types'

export const THOMSON_POINTS = 45
// Base scatter ±5%; actual scatter scales with local profile value
// so core (high Te/ne) is noisier and edge (low Te/ne) is tighter.
export const THOMSON_SCATTER_BASE = 0.05

/** Simple xorshift PRNG for reproducible Thomson scatter noise. */
export function xorshift(seed: number): () => number {
  let s = seed | 1
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

/** Gaussian(0, sigma) via Box-Muller, using the provided RNG. */
export function gaussian(rng: () => number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-10)
  const u2 = rng()
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Post-process raw profile frames into downsampled profiles with
 * pre-generated Thomson scatter points and global axis maxima.
 */
export function processProfileFrames(frames: ProfileFrame[]): {
  profiles: ProcessedProfile[]
  teMax: number
  neMax: number
  pMax: number
} {
  if (frames.length === 0) {
    return { profiles: [], teMax: 0.1, neMax: 0.01, pMax: 0.1 }
  }

  // 1. Scan all frames for global max Te, ne, and pressure values
  let teMax = 0
  let neMax = 0
  let pMax = 0

  for (const frame of frames) {
    const te = frame.te_profile
    const ne = frame.ne_profile
    for (let i = 0; i < te.length; i++) {
      if (te[i] > teMax) teMax = te[i]
      if (ne[i] > neMax) neMax = ne[i]
      const p = 2 * ne[i] * te[i]
      if (p > pMax) pMax = p
    }
  }

  // Add 15% headroom
  teMax *= 1.15
  neMax *= 1.15
  pMax *= 1.15

  // Ensure minimum sensible axis ranges
  teMax = Math.max(teMax, 0.1)
  neMax = Math.max(neMax, 0.01)
  pMax = Math.max(pMax, 0.1)

  // 2. For each frame, generate Thomson scatter points
  const profiles: ProcessedProfile[] = frames.map((frame, frameIndex) => {
    const te = frame.te_profile
    const ne = frame.ne_profile
    const nRho = te.length

    // Deterministic seed per frame
    const seed = (frameIndex * 73856093) ^ 0xdeadbeef
    const rng = xorshift(seed)

    const te_thomson: { rho: number; val: number }[] = []
    const ne_thomson: { rho: number; val: number }[] = []

    // Find peak profile values for this frame (for relative scatter scaling)
    const tePeak = Math.max(...te, 0.01)
    const nePeak = Math.max(...ne, 0.001)

    for (let i = 0; i < THOMSON_POINTS; i++) {
      // Non-uniform radial distribution: denser at edge (like DIII-D edge Thomson).
      // Map uniform r → rho = r^0.6 which concentrates points toward rho=1.
      const r = 0.03 + rng() * 0.94 // uniform in [0.03, 0.97]
      const rho = Math.pow(r, 0.6) // shifts distribution toward edge

      // Interpolate profile at this rho
      const idx = rho * (nRho - 1)
      const lo = Math.floor(idx)
      const hi = Math.min(lo + 1, nRho - 1)
      const f = idx - lo
      const teVal = te[lo] * (1 - f) + te[hi] * f
      const neVal = ne[lo] * (1 - f) + ne[hi] * f

      // Profile-dependent scatter: noise scales with local value / peak.
      // Core (high values) → larger scatter; edge (low values) → tighter.
      const teSigma = THOMSON_SCATTER_BASE + 0.10 * (teVal / tePeak)
      const neSigma = THOMSON_SCATTER_BASE + 0.10 * (neVal / nePeak)

      te_thomson.push({
        rho,
        val: teVal * (1 + gaussian(rng, teSigma)),
      })
      ne_thomson.push({
        rho,
        val: neVal * (1 + gaussian(rng, neSigma)),
      })
    }

    return {
      time: frame.time,
      te_profile: te,
      ne_profile: ne,
      in_hmode: frame.in_hmode,
      te_thomson,
      ne_thomson,
    }
  })

  return { profiles, teMax, neMax, pMax }
}
