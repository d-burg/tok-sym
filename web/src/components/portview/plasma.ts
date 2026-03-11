import * as THREE from 'three'
import type { Contour } from '../../lib/types'
import type { PortConfig } from './types'
import { toroidal, truncateAtWall, subsample, splitChains, densifyContour } from './types'

// ── Separatrix: mesh-based volumetric rendering ──
// The separatrix is rendered as multiple thin toroidal mesh shells with
// per-vertex Fresnel brightness. Face-on views are nearly transparent;
// edge-on (tangential) sight lines accumulate brightness through additive
// blending, creating a misty, limb-brightened boundary layer.
// Bloom post-processing then creates the soft glow halo.

// Toroidal mesh resolution — enough slices so individual quads aren't visible.
// Must cover the full torus (±π), so we need more slices than the old ±1.4 range.
const SEP_MESH_SLICES = 240

// Poloidal resolution (max contour points per shell) — high enough that
// polygon edges are invisible even on the limb.
const SEP_CONTOUR_PTS = 200

// Shell offsets (meters along contour normal).
// 6 shells with wider spacing gives a broader misty boundary.
// Fewer shells reduces face-on accumulation artifacts.
const SHELL_OFFSETS = [
  -0.025, -0.012, -0.003,
   0.003,  0.012,  0.025,
]

// Fresnel exponent: controls edge-on brightening shape.
// Lower values give a wider, mistier limb. Higher values make it thinner.
// 2.0 creates a broad misty glow that fades gradually from limb to face.
const FRESNEL_EXPONENT = 2.0

// Base intensity per shell fragment.
// With 6 shells × additive blending, tangential views accumulate
// ~30-60 overlapping fragments → bright misty limb + bloom.
const SEP_BASE_INTENSITY = 0.10

// ELM flash parameters
const ELM_FLASH_MULT = 5.0
const ELM_WHITE_SHIFT = 0.3

/** GLSL-style smoothstep: Hermite interpolation clamped to [0,1]. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// ── Divertor legs: line-based ──
const LEG_LINE_SLICES = 240
const LEG_INTENSITY = 2.0
const LEG_CONTOUR_PTS = 100

export interface PlasmaGroup {
  group: THREE.Group
  sepMaterial: THREE.MeshBasicMaterial
  legMaterial: THREE.LineBasicMaterial
  update: (params: PlasmaUpdateParams) => void
}

export interface PlasmaUpdateParams {
  separatrix: Contour
  fluxSurfaces: Contour[]
  axisR: number
  axisZ: number
  xpointR: number
  xpointZ: number
  xpointUpperR: number
  xpointUpperZ: number
  inHmode: boolean
  elmActive: boolean
  te0: number
  betaN: number
  opacity: number
  limiterPts: [number, number][]
}

/**
 * Create the plasma rendering group.
 * Separatrix: mesh-based volumetric shells with Fresnel limb brightening.
 * Divertor legs: line-based (same as before).
 */
export function createPlasmaGroup(cfg: PortConfig): PlasmaGroup {
  const group = new THREE.Group()
  group.renderOrder = 1

  // Separatrix material: mesh with additive blending for accumulation
  const sepMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })

  // Divertor leg material: lines with additive blending
  const legMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })

  const baseColor = { r: 0.4, g: 0.7, b: 1.0 }
  const legColor = { r: 0.55, g: 0.82, b: 1.0 }

  // Camera position (constant for a given device config)
  const camPos = new THREE.Vector3(
    cfg.camR * Math.cos(cfg.camPhi),
    cfg.camR * Math.sin(cfg.camPhi),
    cfg.camZ,
  )

  const update = (params: PlasmaUpdateParams) => {
    // Clear old children
    while (group.children.length > 0) {
      const child = group.children[0]
      group.remove(child)
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose()
      }
    }

    // Plasma color from temperature — cyan-blue base
    const tempFrac = Math.min(params.te0 / 12, 1)
    baseColor.r = 0.30 + tempFrac * 0.15
    baseColor.g = 0.60 + tempFrac * 0.15
    baseColor.b = 0.90 + tempFrac * 0.10

    const sepPts = params.separatrix.points
    if (sepPts.length < 4) return

    // Build separatrix mesh shells
    buildSeparatrixMesh(group, sepMaterial, cfg, sepPts, params, baseColor, camPos)

    // Build divertor leg lines in H-mode
    if (params.inHmode) {
      buildDivertorLegLines(group, legMaterial, cfg, params, legColor)
    }
  }

  return { group, sepMaterial, legMaterial, update }
}

// ═══════════════════════════════════════════════════════════════════
// Separatrix mesh rendering
// ═══════════════════════════════════════════════════════════════════

/**
 * Laplacian smooth a contour to eliminate jagged polygon edges.
 * Each point is averaged with its neighbours, preserving overall shape
 * but removing high-frequency kinks.  Handles both open and closed contours.
 */
function smoothContour(pts: [number, number][], iterations: number): [number, number][] {
  if (pts.length < 3) return pts

  // Detect closed contour
  const d = Math.sqrt(
    (pts[0][0] - pts[pts.length - 1][0]) ** 2 +
    (pts[0][1] - pts[pts.length - 1][1]) ** 2,
  )
  let avgSpacing = 0
  for (let i = 1; i < pts.length; i++) {
    avgSpacing += Math.sqrt(
      (pts[i][0] - pts[i - 1][0]) ** 2 +
      (pts[i][1] - pts[i - 1][1]) ** 2,
    )
  }
  avgSpacing /= pts.length - 1
  const closed = d < avgSpacing * 3

  let current = pts
  for (let iter = 0; iter < iterations; iter++) {
    const n = current.length
    const next: [number, number][] = new Array(n)
    for (let i = 0; i < n; i++) {
      const prev = closed ? (i - 1 + n) % n : Math.max(0, i - 1)
      const nxt = closed ? (i + 1) % n : Math.min(n - 1, i + 1)
      // Weighted: 50% self + 25% each neighbour
      next[i] = [
        0.5 * current[i][0] + 0.25 * current[prev][0] + 0.25 * current[nxt][0],
        0.5 * current[i][1] + 0.25 * current[prev][1] + 0.25 * current[nxt][1],
      ]
    }
    current = next
  }
  return current
}

/**
 * Build the separatrix as volumetric toroidal mesh shells.
 * Multiple shells at slight offsets create a misty depth effect.
 * Per-vertex Fresnel modulates brightness: transparent face-on, bright edge-on.
 */
function buildSeparatrixMesh(
  group: THREE.Group,
  material: THREE.MeshBasicMaterial,
  cfg: PortConfig,
  sepPts: [number, number][],
  params: PlasmaUpdateParams,
  color: { r: number; g: number; b: number },
  camPos: THREE.Vector3,
): void {
  const chains = splitChains(sepPts)
  if (chains.length === 0) return

  // Only render the main LCFS loop (longest chain).
  // Divertor leg fragments are handled by buildDivertorLegLines.
  // Densify first (fill gaps), then subsample to target resolution,
  // then Laplacian-smooth to eliminate polygon edges.
  const densified = densifyContour(chains[0], 0.02)
  const sampled = subsample(densified, SEP_CONTOUR_PTS)
  const mainLoop = smoothContour(sampled, 3)
  const nPts = mainLoop.length
  if (nPts < 4) return

  // Check if the main loop is closed (first ≈ last point)
  let avgSpacing = 0
  for (let i = 1; i < nPts; i++) {
    const dr = mainLoop[i][0] - mainLoop[i - 1][0]
    const dz = mainLoop[i][1] - mainLoop[i - 1][1]
    avgSpacing += Math.sqrt(dr * dr + dz * dz)
  }
  avgSpacing /= Math.max(nPts - 1, 1)
  const closureThreshold = Math.max(avgSpacing * 5, 0.05)
  const dClose = Math.sqrt(
    (mainLoop[0][0] - mainLoop[nPts - 1][0]) ** 2 +
    (mainLoop[0][1] - mainLoop[nPts - 1][1]) ** 2,
  )
  const isClosed = dClose < closureThreshold

  // Compute contour normals (perpendicular to tangent in R-Z plane)
  const cNormals: [number, number][] = []
  for (let i = 0; i < nPts; i++) {
    const prev = isClosed ? (i - 1 + nPts) % nPts : Math.max(0, i - 1)
    const next = isClosed ? (i + 1) % nPts : Math.min(nPts - 1, i + 1)
    const dR = mainLoop[next][0] - mainLoop[prev][0]
    const dZ = mainLoop[next][1] - mainLoop[prev][1]
    const len = Math.sqrt(dR * dR + dZ * dZ) || 1
    cNormals.push([-dZ / len, dR / len])
  }

  const nShells = SHELL_OFFSETS.length
  const nSlices = SEP_MESH_SLICES
  // Use full wall phi range so the separatrix wraps all the way around
  // (or at least behind the center stack). Fresnel and depth fade naturally
  // dim the back portions; the key is avoiding hard cutoff edges.
  const phiMin = cfg.phiMin
  const phiMax = cfg.phiMax
  const opacity = params.opacity

  // Per-slice depth fades: nearer slices brighter
  let rMin = Infinity, rMax = -Infinity
  for (const [R] of mainLoop) {
    if (R < rMin) rMin = R
    if (R > rMax) rMax = R
  }
  const rGeo = (rMin + rMax) / 2
  const depthFades = computeDepthFades(cfg, rGeo, nSlices, phiMin, phiMax)

  // ELM flash
  const elmMult = params.elmActive ? ELM_FLASH_MULT : 1.0
  const elmW = params.elmActive ? ELM_WHITE_SHIFT : 0.0

  // Allocate combined buffers for all shells in a single geometry
  const totalVerts = nShells * nSlices * nPts
  const positions = new Float32Array(totalVerts * 3)
  const colors = new Float32Array(totalVerts * 3)
  const indices: number[] = []

  // Number of quads in poloidal direction per slice
  const nQuadsPol = isClosed ? nPts : nPts - 1

  // Per-shell phi stagger: offset each shell's toroidal grid by a fraction
  // of a slice width so quad edges don't align coherently across shells.
  // This breaks up the visual banding that additive blending would otherwise show.
  const phiStep = (phiMax - phiMin) / (nSlices - 1)

  for (let sh = 0; sh < nShells; sh++) {
    const shellBase = sh * nSlices * nPts
    const offset = SHELL_OFFSETS[sh]
    // Golden-ratio-based stagger so no two shells align
    const phiStagger = phiStep * ((sh * 0.618) % 1.0)

    // Offset contour along normals to create shell
    const shellPts: [number, number][] = mainLoop.map((pt, i) => [
      pt[0] + offset * cNormals[i][0],
      pt[1] + offset * cNormals[i][1],
    ])

    for (let si = 0; si < nSlices; si++) {
      const phi = phiMin + (si / (nSlices - 1)) * (phiMax - phiMin) + phiStagger
      const cosPhi = Math.cos(phi)
      const sinPhi = Math.sin(phi)
      const dFade = depthFades[si]

      for (let pi = 0; pi < nPts; pi++) {
        const vi = shellBase + si * nPts + pi
        const R = shellPts[pi][0]
        const Z = shellPts[pi][1]

        // 3D position (toroidal coordinates)
        const px = R * cosPhi
        const py = R * sinPhi
        const pz = Z
        positions[vi * 3] = px
        positions[vi * 3 + 1] = py
        positions[vi * 3 + 2] = pz

        // Surface normal = cross(poloidalTangent, toroidalTangent)
        // Poloidal tangent: (dR·cosφ, dR·sinφ, dZ) along contour
        // Toroidal tangent: (-R·sinφ, R·cosφ, 0) around torus
        // Cross product simplifies to: (-dZ·cosφ, -dZ·sinφ, dR)
        const prev = isClosed ? (pi - 1 + nPts) % nPts : Math.max(0, pi - 1)
        const next = isClosed ? (pi + 1) % nPts : Math.min(nPts - 1, pi + 1)
        const dR = shellPts[next][0] - shellPts[prev][0]
        const dZ = shellPts[next][1] - shellPts[prev][1]

        let nx = -dZ * cosPhi
        let ny = -dZ * sinPhi
        let nz = dR
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz)
        if (nLen > 1e-10) { nx /= nLen; ny /= nLen; nz /= nLen }

        // View direction (camera → vertex)
        const vx = camPos.x - px
        const vy = camPos.y - py
        const vz = camPos.z - pz
        const vLen = Math.sqrt(vx * vx + vy * vy + vz * vz)
        const NdotV = Math.abs((nx * vx + ny * vy + nz * vz) / vLen)

        // Fresnel: transparent face-on (NdotV≈1), bright edge-on (NdotV≈0)
        let fresnel = Math.pow(Math.max(0, 1.0 - NdotV), FRESNEL_EXPONENT)
        // Smooth remap: suppress face-on fragments aggressively while keeping
        // the broad misty limb.  The steep smoothstep ensures near-zero face-on
        // brightness to prevent any grid texture from showing.
        fresnel *= smoothstep(0.08, 0.35, fresnel)

        // Final per-vertex brightness
        const brightness = SEP_BASE_INTENSITY * fresnel * dFade * opacity * elmMult

        colors[vi * 3] = (color.r + elmW) * brightness
        colors[vi * 3 + 1] = (color.g + elmW) * brightness
        colors[vi * 3 + 2] = (color.b + elmW) * brightness
      }
    }

    // Triangle indices for this shell's quad grid
    for (let si = 0; si < nSlices - 1; si++) {
      for (let pi = 0; pi < nQuadsPol; pi++) {
        const nextPi = (pi + 1) % nPts
        const a = shellBase + si * nPts + pi
        const b = shellBase + (si + 1) * nPts + pi
        const c = shellBase + (si + 1) * nPts + nextPi
        const d = shellBase + si * nPts + nextPi
        // Two triangles per quad
        indices.push(a, b, c, a, c, d)
      }
    }
  }

  // Single combined geometry for all shells
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(indices)

  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = 1
  mesh.frustumCulled = false
  group.add(mesh)
}

// ═══════════════════════════════════════════════════════════════════
// Divertor legs: line-based rendering (unchanged from original)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute toroidal path-length factor for each slice.
 * Face-on slices (nearest camera) → short path → dim.
 * Tangential slices (toroidal limbs) → long path → bright.
 */
function computePathFactors(
  cfg: PortConfig,
  rGeo: number,
  nSlices: number,
  phiMin: number,
  phiMax: number,
): Float32Array {
  const factors = new Float32Array(nSlices)
  let minFactor = Infinity

  for (let s = 0; s < nSlices; s++) {
    const phi = phiMin + (s / (nSlices - 1)) * (phiMax - phiMin)
    const cosPhi = Math.cos(phi)
    const sinPhi = Math.sin(phi)

    const dx = rGeo * cosPhi - cfg.camR
    const dy = rGeo * sinPhi
    const dist = Math.sqrt(dx * dx + dy * dy)

    const faceOn = Math.abs(rGeo - cfg.camR * cosPhi)
    const pf = faceOn > 0.01 ? dist / faceOn : 10.0
    factors[s] = pf
    if (pf < minFactor) minFactor = pf
  }

  for (let s = 0; s < nSlices; s++) {
    factors[s] = Math.min(factors[s] / minFactor, 4.0)
  }

  return factors
}

/**
 * Compute depth fade per slice — nearer slices brighter.
 */
function computeDepthFades(
  cfg: PortConfig,
  rGeo: number,
  nSlices: number,
  phiMin: number,
  phiMax: number,
): Float32Array {
  const fades = new Float32Array(nSlices)
  const depths = new Float32Array(nSlices)
  let minDepth = Infinity, maxDepth = -Infinity

  for (let s = 0; s < nSlices; s++) {
    const phi = phiMin + (s / (nSlices - 1)) * (phiMax - phiMin)
    const dx = rGeo * Math.cos(phi) - cfg.camR
    const dy = rGeo * Math.sin(phi)
    const d = Math.sqrt(dx * dx + dy * dy)
    depths[s] = d
    if (d < minDepth) minDepth = d
    if (d > maxDepth) maxDepth = d
  }

  const range = maxDepth - minDepth + 0.01
  for (let s = 0; s < nSlices; s++) {
    const depthFrac = 1 - (depths[s] - minDepth) / range
    fades[s] = 0.85 + depthFrac * 0.15
  }

  return fades
}

/**
 * Build divertor leg lines using full separatrix geometry.
 * Splits divertor points into inner/outer legs by X-point R,
 * sorts by Z, prepends X-point, truncates at wall.
 */
function buildDivertorLegLines(
  group: THREE.Group,
  material: THREE.LineBasicMaterial,
  cfg: PortConfig,
  params: PlasmaUpdateParams,
  color: { r: number; g: number; b: number },
): void {
  const { separatrix, xpointR, xpointZ, xpointUpperR, xpointUpperZ, limiterPts } = params
  const sepPts = separatrix.points
  if (sepPts.length < 4) return

  const allLegs: [number, number][][] = []

  // Lower divertor legs
  if (xpointR > 0) {
    const lowerDivPts = sepPts.filter(p => p[1] < xpointZ - 0.05)
    if (lowerDivPts.length >= 2) {
      const inner: [number, number][] = []
      const outer: [number, number][] = []
      for (const pt of lowerDivPts) {
        if (pt[0] < xpointR - 0.01) inner.push(pt)
        else if (pt[0] > xpointR + 0.01) outer.push(pt)
      }
      inner.sort((a, b) => b[1] - a[1])
      outer.sort((a, b) => b[1] - a[1])

      const xPt: [number, number] = [xpointR, xpointZ]
      if (inner.length >= 2) {
        inner.unshift(xPt)
        allLegs.push(truncateAtWall(inner, limiterPts))
      }
      if (outer.length >= 2) {
        outer.unshift(xPt)
        allLegs.push(truncateAtWall(outer, limiterPts))
      }
    }
  }

  // Upper divertor legs
  if (xpointUpperR > 0) {
    const upperDivPts = sepPts.filter(p => p[1] > xpointUpperZ + 0.05)
    if (upperDivPts.length >= 2) {
      const inner: [number, number][] = []
      const outer: [number, number][] = []
      for (const pt of upperDivPts) {
        if (pt[0] < xpointUpperR - 0.01) inner.push(pt)
        else if (pt[0] > xpointUpperR + 0.01) outer.push(pt)
      }
      inner.sort((a, b) => a[1] - b[1])
      outer.sort((a, b) => a[1] - b[1])

      const xPt: [number, number] = [xpointUpperR, xpointUpperZ]
      if (inner.length >= 2) {
        inner.unshift(xPt)
        allLegs.push(truncateAtWall(inner, limiterPts))
      }
      if (outer.length >= 2) {
        outer.unshift(xPt)
        allLegs.push(truncateAtWall(outer, limiterPts))
      }
    }
  }

  if (allLegs.length === 0) return

  const nSlices = LEG_LINE_SLICES
  // Use full wall phi range so divertor legs wrap all the way around
  const phiMin = cfg.phiMin
  const phiMax = cfg.phiMax

  let rSum = 0, rCount = 0
  for (const leg of allLegs) {
    for (const [R] of leg) { rSum += R; rCount++ }
  }
  const rGeo = rCount > 0 ? rSum / rCount : params.axisR

  const pathFactors = computePathFactors(cfg, rGeo, nSlices, phiMin, phiMax)
  const depthFades = computeDepthFades(cfg, rGeo, nSlices, phiMin, phiMax)

  const opacity = params.opacity

  let totalPts = 0
  for (const leg of allLegs) totalPts += leg.length

  const totalVerts = nSlices * totalPts
  const positions = new Float32Array(totalVerts * 3)
  const vertColors = new Float32Array(totalVerts * 3)
  const indices: number[] = []

  let vi = 0
  for (let si = 0; si < nSlices; si++) {
    const phi = phiMin + (si / (nSlices - 1)) * (phiMax - phiMin)
    const brightness = LEG_INTENSITY * pathFactors[si] * depthFades[si] * opacity

    for (const leg of allLegs) {
      const legBase = vi
      for (let pi = 0; pi < leg.length; pi++) {
        const v = toroidal(leg[pi][0], leg[pi][1], phi)
        positions[vi * 3] = v.x
        positions[vi * 3 + 1] = v.y
        positions[vi * 3 + 2] = v.z
        vertColors[vi * 3] = color.r * brightness
        vertColors[vi * 3 + 1] = color.g * brightness
        vertColors[vi * 3 + 2] = color.b * brightness
        vi++
      }

      for (let pi = 0; pi < leg.length - 1; pi++) {
        indices.push(legBase + pi, legBase + pi + 1)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, vi * 3), 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(vertColors.slice(0, vi * 3), 3))
  geometry.setIndex(indices)

  const lines = new THREE.LineSegments(geometry, material)
  lines.renderOrder = 1
  lines.frustumCulled = false
  group.add(lines)
}
