import type { PortConfig } from './types'

function defaultPortConfig(r0: number, a: number): PortConfig {
  const portR = r0 + a * 0.95
  const portLength = a * 0.25
  const fov = 80
  const portRadius = Math.tan((fov / 2) * Math.PI / 180) * portLength * 1.4
  return {
    portR, portZ: 0, portRadius, portLength, portPhi: 0,
    camR: portR + portLength, camZ: 0.04, camPhi: 0,
    lookR: r0 * 0.65, lookZ: -0.02, lookPhi: 0.25, fov,
    tileColor: [32, 32, 34],
    tileGridSpacing: { poloidal: 0.12, toroidal: 0.10 },
    tileGridDarken: 0.25,
    phiMin: -Math.PI, phiMax: Math.PI,
    plasmaPhiMin: -1.40, plasmaPhiMax: 1.40,
    nWallSlices: 100, nPlasmaSlices: 40,
  }
}

const PORT_CONFIGS: Record<string, PortConfig> = {
  diiid: {
    portR: 2.35, portZ: 0, portRadius: 0.42, portLength: 0.25, portPhi: 0,
    camR: 2.60, camZ: 0.04, camPhi: 0,
    lookR: 1.10, lookZ: -0.02, lookPhi: 0.28, fov: 80,
    tileColor: [38, 38, 42],
    tileGridSpacing: { poloidal: 0.10, toroidal: 0.10 },
    tileGridDarken: 0.30,
    phiMin: -Math.PI, phiMax: Math.PI,
    plasmaPhiMin: -1.40, plasmaPhiMax: 1.40,
    nWallSlices: 100, nPlasmaSlices: 40,
    tileRegions: {
      inboardGridSpacing: { poloidal: 0.10, toroidal: 0.10 },
      limiterGridSpacing: { poloidal: 0.10, toroidal: 0.20 },
      limiterZThreshold: 0.80,
    },
    extraPorts: [
      // ─── Upper outboard "2 o'clock" (theta 20°–55°) ───
      { theta: 45, phi: 0.18,  radius: 0.10 },
      { theta: 35, phi: -0.28, radius: 0.09 },
      { theta: 50, phi: 0.42,  radius: 0.07 },
      { theta: 25, phi: 0.48,  radius: 0.08 },
      { theta: 40, phi: -0.55, radius: 0.07 },
      { theta: 55, phi: 0.80,  radius: 0.06 },
      { theta: 30, phi: -0.78, radius: 0.06 },
      { theta: 38, phi: 0.05,  radius: 0.08 },

      // ─── Midplane "3 o'clock" (theta -15°–15°) ───
      { theta: 8,   phi: -0.32, radius: 0.07 },
      { theta: -10, phi: 0.42,  radius: 0.06 },
      { theta: 15,  phi: 0.38,  radius: 0.06 },
      { theta: -15, phi: -0.38, radius: 0.06 },
      { theta: 5,   phi: 0.82,  radius: 0.07 },
      { theta: -5,  phi: -0.78, radius: 0.06 },

      // ─── Lower outboard "4 o'clock" (theta -55°–-20°) ───
      { theta: -30, phi: 0.20,  radius: 0.09 },
      { theta: -42, phi: -0.25, radius: 0.10 },
      { theta: -25, phi: -0.58, radius: 0.07 },
      { theta: -35, phi: 0.55,  radius: 0.08 },
      { theta: -50, phi: 0.35,  radius: 0.06 },
      { theta: -28, phi: -0.75, radius: 0.06 },
      { theta: -38, phi: 0.80,  radius: 0.07 },
      { theta: -45, phi: -0.45, radius: 0.08 },
    ],
    antennae: [
      { r: 2.35, zMin: -0.28, zMax: 0.28, phiMin: 0.55, phiMax: 0.72 },   // ICRH
      { r: 2.35, zMin: -0.12, zMax: 0.12, phiMin: -0.60, phiMax: -0.48 },  // LHRF
      { r: 2.35, zMin: -0.18, zMax: 0.18, phiMin: -0.92, phiMax: -0.80 },  // ECH launcher
    ],
    fresnelStrength: 0.55,
  },
  centaur: {
    portR: 2.73, portZ: 0, portRadius: 0.42, portLength: 0.22, portPhi: 0,
    camR: 2.95, camZ: 0.04, camPhi: 0,
    lookR: 1.30, lookZ: -0.02, lookPhi: 0.26, fov: 80,
    tileColor: [34, 34, 38],
    tileGridSpacing: { poloidal: 0.10, toroidal: 0.10 },
    tileGridDarken: 0.28,
    phiMin: -Math.PI, phiMax: Math.PI,
    plasmaPhiMin: -1.40, plasmaPhiMax: 1.40,
    nWallSlices: 100, nPlasmaSlices: 40,
    tileRegions: {
      inboardGridSpacing: { poloidal: 0.10, toroidal: 0.10 },
      limiterGridSpacing: { poloidal: 0.10, toroidal: 0.18 },
      limiterZThreshold: 1.0,
    },
    extraPorts: [
      // ─── Upper outboard "2 o'clock" (theta 20°–50°) ───
      { theta: 40, phi: 0.20,  radius: 0.09 },
      { theta: 30, phi: -0.30, radius: 0.08 },
      { theta: 45, phi: 0.50,  radius: 0.07 },
      { theta: 25, phi: 0.45,  radius: 0.07 },
      { theta: 35, phi: -0.60, radius: 0.06 },
      { theta: 50, phi: 0.75,  radius: 0.06 },
      { theta: 28, phi: -0.80, radius: 0.06 },

      // ─── Midplane "3 o'clock" (theta -15°–15°) ───
      { theta: 8,   phi: -0.35, radius: 0.07 },
      { theta: -10, phi: 0.40,  radius: 0.06 },
      { theta: 12,  phi: 0.35,  radius: 0.06 },
      { theta: -12, phi: -0.40, radius: 0.06 },
      { theta: 5,   phi: 0.85,  radius: 0.06 },
      { theta: -5,  phi: -0.80, radius: 0.06 },

      // ─── Lower outboard "4 o'clock" (theta -50°–-20°) ───
      { theta: -28, phi: 0.18,  radius: 0.08 },
      { theta: -40, phi: -0.28, radius: 0.09 },
      { theta: -25, phi: -0.55, radius: 0.07 },
      { theta: -35, phi: 0.50,  radius: 0.07 },
      { theta: -48, phi: 0.38,  radius: 0.06 },
      { theta: -30, phi: -0.75, radius: 0.06 },
      { theta: -42, phi: 0.78,  radius: 0.06 },
    ],
    antennae: [
      // ICRF antenna — large Faraday screen panel on outboard midplane
      { r: 2.73, zMin: -0.35, zMax: 0.35, phiMin: 0.50, phiMax: 0.70 },
      { r: 2.73, zMin: -0.35, zMax: 0.35, phiMin: -0.70, phiMax: -0.50 },
    ],
    fresnelStrength: 0.40,
    divertorRegion: {
      zThreshold: -1.2,
      tileColor: [20, 18, 16],
      gridSpacing: { poloidal: 0.08, toroidal: 0.08 },
    },
  },
  iter: {
    portR: 8.30, portZ: 0, portRadius: 0.60, portLength: 0.35, portPhi: 0,
    camR: 8.65, camZ: 0.06, camPhi: 0,
    lookR: 4.00, lookZ: -0.03, lookPhi: 0.22, fov: 80,
    tileColor: [38, 36, 32],
    tileGridSpacing: { poloidal: 0.15, toroidal: 0.12 },
    tileGridDarken: 0.15,
    phiMin: -Math.PI, phiMax: Math.PI,
    plasmaPhiMin: -1.40, plasmaPhiMax: 1.40,
    nWallSlices: 100, nPlasmaSlices: 40,
    tileRegions: {
      inboardGridSpacing: { poloidal: 0.18, toroidal: 0.18 },
      limiterGridSpacing: { poloidal: 0.15, toroidal: 0.30 },
      limiterZThreshold: 2.5,
    },
    extraPorts: [
      { theta: 25,  phi: 0.12,  radius: 0.22 },
      { theta: -30, phi: -0.08, radius: 0.20 },
      { theta: 5,   phi: -0.25, radius: 0.18 },
    ],
    antennae: [
      { r: 8.30, zMin: -0.8, zMax: 0.8, phiMin: 0.35, phiMax: 0.55 },
    ],
    fresnelStrength: 0.20,
  },
  sparc: {
    portR: 2.10, portZ: 0, portRadius: 0.35, portLength: 0.20, portPhi: 0,
    camR: 2.30, camZ: 0.04, camPhi: 0,
    lookR: 1.10, lookZ: -0.02, lookPhi: 0.28, fov: 80,
    tileColor: [36, 34, 30],
    tileGridSpacing: { poloidal: 0.08, toroidal: 0.07 },
    tileGridDarken: 0.16,
    phiMin: -Math.PI, phiMax: Math.PI,
    plasmaPhiMin: -1.40, plasmaPhiMax: 1.40,
    nWallSlices: 100, nPlasmaSlices: 40,
    tileRegions: {
      inboardGridSpacing: { poloidal: 0.08, toroidal: 0.08 },
      limiterGridSpacing: { poloidal: 0.08, toroidal: 0.14 },
      limiterZThreshold: 0.55,
    },
    extraPorts: [
      { theta: 20,  phi: 0.15,  radius: 0.06 },
      { theta: -15, phi: -0.20, radius: 0.05 },
    ],
    fresnelStrength: 0.18,
  },
  jet: {
    portR: 3.80, portZ: 0, portRadius: 0.50, portLength: 0.30, portPhi: 0,
    camR: 4.10, camZ: 0.06, camPhi: 0,
    lookR: 2.00, lookZ: -0.03, lookPhi: 0.25, fov: 80,
    tileColor: [32, 30, 28],
    tileGridSpacing: { poloidal: 0.12, toroidal: 0.10 },
    tileGridDarken: 0.15,
    phiMin: -Math.PI, phiMax: Math.PI,
    plasmaPhiMin: -1.40, plasmaPhiMax: 1.40,
    nWallSlices: 100, nPlasmaSlices: 40,
    tileRegions: {
      inboardGridSpacing: { poloidal: 0.12, toroidal: 0.12 },
      limiterGridSpacing: { poloidal: 0.12, toroidal: 0.22 },
      limiterZThreshold: 1.2,
    },
    extraPorts: [
      // ─── Upper outboard "2 o'clock" (theta 25°–55°) ───
      { theta: 40, phi: 0.15,  radius: 0.14 },
      { theta: 50, phi: -0.35, radius: 0.12 },
      { theta: 30, phi: 0.50,  radius: 0.10 },
      { theta: 45, phi: 0.72,  radius: 0.09 },
      { theta: 35, phi: -0.62, radius: 0.11 },
      { theta: 55, phi: 0.40,  radius: 0.08 },
      { theta: 28, phi: -0.85, radius: 0.09 },

      // ─── Midplane "3 o'clock" (theta -15°–15°) ───
      { theta: 10,  phi: 0.22,  radius: 0.08 },
      { theta: -10, phi: -0.20, radius: 0.08 },
      { theta: 5,   phi: 0.60,  radius: 0.07 },
      { theta: -8,  phi: -0.60, radius: 0.07 },
      { theta: 15,  phi: 0.98,  radius: 0.09 },
      { theta: -12, phi: -0.98, radius: 0.08 },

      // ─── Lower outboard "4 o'clock" (theta -55°–-20°) ───
      { theta: -30, phi: 0.18,  radius: 0.13 },
      { theta: -42, phi: -0.30, radius: 0.11 },
      { theta: -25, phi: 0.55,  radius: 0.10 },
      { theta: -48, phi: 0.72,  radius: 0.09 },
      { theta: -35, phi: -0.55, radius: 0.10 },
      { theta: -22, phi: -0.82, radius: 0.08 },
      { theta: -40, phi: 0.42,  radius: 0.08 },
    ],
    antennae: [
      // JET A2 ICRH antenna modules — 4 large Faraday screen panels
      { r: 3.80, zMin: -0.55, zMax: 0.55, phiMin: 0.30, phiMax: 0.52 },
      { r: 3.80, zMin: -0.55, zMax: 0.55, phiMin: 0.66, phiMax: 0.88 },
      { r: 3.80, zMin: -0.55, zMax: 0.55, phiMin: -0.52, phiMax: -0.30 },
      { r: 3.80, zMin: -0.55, zMax: 0.55, phiMin: -0.88, phiMax: -0.66 },
    ],
    fresnelStrength: 0.25,
    inboardStyle: 'bands',
    bandWidth: 0.06,
    divertorRegion: {
      zThreshold: -1.0,
      tileColor: [18, 16, 14],
      gridSpacing: { poloidal: 0.08, toroidal: 0.08 },
    },
  },
}

export function getPortConfig(deviceId?: string, r0?: number, a?: number): PortConfig {
  if (deviceId && PORT_CONFIGS[deviceId]) return PORT_CONFIGS[deviceId]
  return defaultPortConfig(r0 ?? 1.7, a ?? 0.6)
}

// Per-machine separatrix opacity tuning
// DIII-D visible, JET/ITER nearly invisible except during ELMs
export const DEVICE_OPACITY_SCALE: Record<string, number> = {
  diiid: 0.08,
  centaur: 0.06,
  iter: 0.012,
  sparc: 0.10,
  jet: 0.020,
}
export const DEFAULT_OPACITY_SCALE = 0.10

// Per-machine power scaling for strike point glow.
// Hierarchy: ITER (highest heat flux) > CENTAUR > JET > DIII-D (most subtle)
export const DEVICE_POWER_SCALE: Record<string, number> = {
  diiid: 0.04,     // very subtle — low-power research tokamak
  centaur: 3.0,    // dazzling — high-field D-T breakeven, intense divertor load
  iter: 5.0,       // most dazzling — 500 MW fusion, extreme divertor heat flux
  sparc: 0.8,
  jet: 1.5,        // moderate — 29 MW heating, visible but not dramatic
}
export const DEFAULT_POWER_SCALE = 0.5

// ═══ Per-device glow tuning ═══
export interface GlowTuning {
  color: { r: number; g: number; b: number }
  jitterAmplitude: number   // R/Z position jitter (metres)
  flickerDepth: number      // 0 = uniform, 1 = full range
  pointSize: number         // sprite size in world units
}

export const DEVICE_GLOW_TUNING: Record<string, GlowTuning> = {
  // DIII-D: very subtle — faint warm glow, barely perceptible
  diiid: {
    color: { r: 1.0, g: 0.45, b: 0.15 },      // warm orange
    jitterAmplitude: 0.002,
    flickerDepth: 0.10,
    pointSize: 0.12,
  },
  // CENTAUR: dazzling — 30 MW ICRH into compact NT plasma, intense divertor load
  centaur: {
    color: { r: 1.0, g: 0.25, b: 0.06 },       // deep reddish orange (D-T)
    jitterAmplitude: 0.008,
    flickerDepth: 0.40,
    pointSize: 0.40,
  },
  // ITER: most dazzling — 500 MW fusion power, extreme divertor heat flux
  iter: {
    color: { r: 1.0, g: 0.18, b: 0.05 },       // deep red
    jitterAmplitude: 0.022,
    flickerDepth: 0.55,
    pointSize: 0.75,
  },
  // SPARC: moderate
  sparc: {
    color: { r: 1.0, g: 0.35, b: 0.10 },       // reddish orange
    jitterAmplitude: 0.006,
    flickerDepth: 0.30,
    pointSize: 0.28,
  },
  // JET: moderate — visible but less intense than ITER/CENTAUR
  jet: {
    color: { r: 1.0, g: 0.22, b: 0.06 },       // deep red
    jitterAmplitude: 0.007,
    flickerDepth: 0.25,
    pointSize: 0.35,
  },
}

export const DEFAULT_GLOW_TUNING: GlowTuning = {
  color: { r: 1.0, g: 0.45, b: 0.15 },
  jitterAmplitude: 0.006,
  flickerDepth: 0.35,
  pointSize: 0.30,
}

// Rendering constants
export const STRIKE_FADE_RATE = 0.5
export const LEG_FADE_RATE = 0.4
