import * as THREE from 'three'
import type { PortConfig } from './types'
import { WallRegion, toroidal, densifyContour } from './types'

export interface WallMeshData {
  geometry: THREE.BufferGeometry
  /** Per-quad region classification for shader use. */
  regions: Float32Array
}

/**
 * Build wall mesh from limiter contour × toroidal slices.
 * Produces an indexed BufferGeometry with custom attributes for
 * the tile shader (UVs, normals, region, tileHash).
 */
export function buildWallGeometry(
  limiterPts: [number, number][],
  cfg: PortConfig,
  axisR: number,
): WallMeshData {
  // Densify contour for smooth quads
  const pts = densifyContour(limiterPts, 0.08)
  const nPts = pts.length
  const nSlices = cfg.nWallSlices

  const phiMin = cfg.phiMin
  const phiMax = cfg.phiMax
  const phiRange = phiMax - phiMin

  // Compute poloidal arc lengths for UV mapping
  const arcLengths = new Float64Array(nPts + 1)
  arcLengths[0] = 0
  for (let i = 1; i <= nPts; i++) {
    const prev = pts[(i - 1) % nPts]
    const curr = pts[i % nPts]
    const dR = curr[0] - prev[0]
    const dZ = curr[1] - prev[1]
    arcLengths[i] = arcLengths[i - 1] + Math.sqrt(dR * dR + dZ * dZ)
  }
  const totalArc = arcLengths[nPts]

  // Port hole test — only removes tiles for the main camera viewport port.
  // Extra ports are rendered as decal discs (see buildExtraPortDecals) and
  // do NOT require wall quad removal.
  const portMargin = 1.15
  const portTest = (R: number, Z: number, phi: number): boolean => {
    // Main viewport port — must be near the outboard wall (portR)
    if (Math.abs(R - cfg.portR) < cfg.portRadius * 1.5) {
      const dz = Z - cfg.portZ
      const dp = phi - cfg.portPhi
      if (Math.sqrt(dz * dz + dp * dp * R * R) < cfg.portRadius * portMargin) return true
    }
    return false
  }

  // Region classification
  const classifyRegion = (R: number, Z: number, phi: number): WallRegion => {
    // Antenna regions — must also check R to avoid classifying center stack
    // quads in the same Z/phi range as outboard antennae
    if (cfg.antennae) {
      for (const ant of cfg.antennae) {
        if (Math.abs(R - ant.r) < ant.r * 0.15 &&
            Z >= ant.zMin && Z <= ant.zMax &&
            phi >= ant.phiMin && phi <= ant.phiMax) {
          return WallRegion.Antenna
        }
      }
    }
    // Divertor region
    if (cfg.divertorRegion && Z < cfg.divertorRegion.zThreshold) {
      return WallRegion.Divertor
    }
    // Limiter (top/bottom)
    if (cfg.tileRegions && Math.abs(Z) > cfg.tileRegions.limiterZThreshold) {
      return WallRegion.Limiter
    }
    // Inboard
    if (R < axisR * 0.85) {
      return WallRegion.Inboard
    }
    return WallRegion.Outboard
  }

  // Count valid quads (non-port-hole)
  const quads: {
    pi: number; si: number
    r00: number; z00: number; phi0: number
    r10: number; z10: number; phi1: number
    r01: number; z01: number
    r11: number; z11: number
    region: WallRegion
    arcU: number; arcV: number
  }[] = []

  for (let si = 0; si < nSlices; si++) {
    const phi0 = phiMin + (si / nSlices) * phiRange
    const phi1 = phiMin + ((si + 1) / nSlices) * phiRange
    const phiMid = (phi0 + phi1) * 0.5

    for (let pi = 0; pi < nPts; pi++) {
      const ni = (pi + 1) % nPts
      const [r0, z0] = pts[pi]
      const [r1, z1] = pts[ni]
      const rMid = (r0 + r1) * 0.5
      const zMid = (z0 + z1) * 0.5

      // Skip port holes
      if (portTest(rMid, zMid, phiMid)) continue

      const region = classifyRegion(rMid, zMid, phiMid)
      const arcU = (arcLengths[pi] + arcLengths[pi + 1]) * 0.5 / totalArc
      const arcV = (si + 0.5) / nSlices

      quads.push({
        pi, si,
        r00: r0, z00: z0, phi0,
        r10: r1, z10: z1, phi1,
        r01: r0, z01: z0,
        r11: r1, z11: z1,
        region,
        arcU, arcV,
      })
    }
  }

  const nQuads = quads.length
  const nVerts = nQuads * 4
  const nIndices = nQuads * 6

  const positions = new Float32Array(nVerts * 3)
  const normals = new Float32Array(nVerts * 3)
  const uvs = new Float32Array(nVerts * 2)
  const regions = new Float32Array(nVerts)
  const tileHashes = new Float32Array(nVerts)
  const indices = new Uint32Array(nIndices)

  for (let q = 0; q < nQuads; q++) {
    const quad = quads[q]
    const base = q * 4

    // Four corners: (r0,z0,phi0), (r1,z1,phi0), (r1,z1,phi1), (r0,z0,phi1)
    const v0 = toroidal(quad.r00, quad.z00, quad.phi0)
    const v1 = toroidal(quad.r10, quad.z10, quad.phi0)
    const v2 = toroidal(quad.r11, quad.z11, quad.phi1)
    const v3 = toroidal(quad.r01, quad.z01, quad.phi1)

    // Positions
    positions[base * 3 + 0] = v0.x; positions[base * 3 + 1] = v0.y; positions[base * 3 + 2] = v0.z
    positions[base * 3 + 3] = v1.x; positions[base * 3 + 4] = v1.y; positions[base * 3 + 5] = v1.z
    positions[base * 3 + 6] = v2.x; positions[base * 3 + 7] = v2.y; positions[base * 3 + 8] = v2.z
    positions[base * 3 + 9] = v3.x; positions[base * 3 + 10] = v3.y; positions[base * 3 + 11] = v3.z

    // Normal from cross product of quad diagonals
    const d1x = v2.x - v0.x, d1y = v2.y - v0.y, d1z = v2.z - v0.z
    const d2x = v3.x - v1.x, d2y = v3.y - v1.y, d2z = v3.z - v1.z
    let nx = d1y * d2z - d1z * d2y
    let ny = d1z * d2x - d1x * d2z
    let nz = d1x * d2y - d1y * d2x
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx /= len; ny /= len; nz /= len

    // Ensure normal points inward (toward the magnetic axis)
    const cx = (v0.x + v1.x + v2.x + v3.x) * 0.25
    const cy = (v0.y + v1.y + v2.y + v3.y) * 0.25
    const rMid = Math.sqrt(cx * cx + cy * cy)
    const inwardX = cx * (axisR / rMid - 1)
    const inwardY = cy * (axisR / rMid - 1)
    if (nx * inwardX + ny * inwardY < 0) {
      nx = -nx; ny = -ny; nz = -nz
    }

    for (let i = 0; i < 4; i++) {
      normals[(base + i) * 3 + 0] = nx
      normals[(base + i) * 3 + 1] = ny
      normals[(base + i) * 3 + 2] = nz
    }

    // UVs: poloidal arc (u) × toroidal position (v)
    const polU0 = arcLengths[quad.pi] / totalArc
    const polU1 = arcLengths[quad.pi + 1] / totalArc
    const torV0 = (quad.phi0 - phiMin) / phiRange
    const torV1 = (quad.phi1 - phiMin) / phiRange

    uvs[base * 2 + 0] = polU0; uvs[base * 2 + 1] = torV0
    uvs[base * 2 + 2] = polU1; uvs[base * 2 + 3] = torV0
    uvs[base * 2 + 4] = polU1; uvs[base * 2 + 5] = torV1
    uvs[base * 2 + 6] = polU0; uvs[base * 2 + 7] = torV1

    // Per-tile hash for brightness variation
    const cellP = Math.floor(polU0 * totalArc / getGridSpacing(quad.region, cfg).poloidal)
    const cellT = Math.floor(torV0 * nSlices)
    const hash = ((cellP * 7919 + cellT * 104729) & 0xFFFF) / 65536

    for (let i = 0; i < 4; i++) {
      regions[base + i] = quad.region
      tileHashes[base + i] = hash
    }

    // Indices: two triangles per quad
    const idx = q * 6
    indices[idx + 0] = base + 0
    indices[idx + 1] = base + 1
    indices[idx + 2] = base + 2
    indices[idx + 3] = base + 0
    indices[idx + 4] = base + 2
    indices[idx + 5] = base + 3
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('a_region', new THREE.BufferAttribute(regions, 1))
  geometry.setAttribute('a_tileHash', new THREE.BufferAttribute(tileHashes, 1))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  return { geometry, regions }
}

function getGridSpacing(region: WallRegion, cfg: PortConfig): { poloidal: number; toroidal: number } {
  if (region === WallRegion.Inboard && cfg.tileRegions) return cfg.tileRegions.inboardGridSpacing
  if (region === WallRegion.Limiter && cfg.tileRegions) return cfg.tileRegions.limiterGridSpacing
  if (region === WallRegion.Divertor && cfg.divertorRegion) return cfg.divertorRegion.gridSpacing
  return cfg.tileGridSpacing
}

/**
 * Build the port cylinder geometry (the tube the camera looks through).
 */
export function buildPortGeometry(cfg: PortConfig): THREE.BufferGeometry {
  const nRings = 8
  const nSegments = 24
  const nVerts = nRings * nSegments
  const nQuads = (nRings - 1) * nSegments

  const positions = new Float32Array(nVerts * 3)
  const normals = new Float32Array(nVerts * 3)
  const uvs = new Float32Array(nVerts * 2)
  const indices = new Uint32Array(nQuads * 6)

  for (let ri = 0; ri < nRings; ri++) {
    const t = ri / (nRings - 1)
    const ringR = cfg.portR + t * cfg.portLength
    for (let si = 0; si < nSegments; si++) {
      const angle = (si / nSegments) * Math.PI * 2
      const localZ = Math.cos(angle) * cfg.portRadius
      const localPhi = Math.sin(angle) * cfg.portRadius / ringR

      const v = toroidal(ringR, cfg.portZ + localZ, cfg.portPhi + localPhi)
      const idx = ri * nSegments + si
      positions[idx * 3] = v.x
      positions[idx * 3 + 1] = v.y
      positions[idx * 3 + 2] = v.z

      // Normal points inward (toward cylinder axis)
      normals[idx * 3] = -Math.cos(cfg.portPhi + localPhi) * Math.cos(angle)
      normals[idx * 3 + 1] = -Math.sin(cfg.portPhi + localPhi) * Math.cos(angle)
      normals[idx * 3 + 2] = -Math.sin(angle)

      uvs[idx * 2] = si / nSegments
      uvs[idx * 2 + 1] = t
    }
  }

  let triIdx = 0
  for (let ri = 0; ri < nRings - 1; ri++) {
    for (let si = 0; si < nSegments; si++) {
      const ns = (si + 1) % nSegments
      const a = ri * nSegments + si
      const b = ri * nSegments + ns
      const c = (ri + 1) * nSegments + ns
      const d = (ri + 1) * nSegments + si
      indices[triIdx++] = a; indices[triIdx++] = b; indices[triIdx++] = c
      indices[triIdx++] = a; indices[triIdx++] = c; indices[triIdx++] = d
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  return geometry
}

/**
 * Compute the geometric center of a closed (R, Z) limiter contour
 * from its bounding box.
 */
export function contourCenter(pts: [number, number][]): { r: number; z: number } {
  let rMin = Infinity, rMax = -Infinity
  let zMin = Infinity, zMax = -Infinity
  for (const [r, z] of pts) {
    if (r < rMin) rMin = r
    if (r > rMax) rMax = r
    if (z < zMin) zMin = z
    if (z > zMax) zMax = z
  }
  return { r: (rMin + rMax) / 2, z: (zMin + zMax) / 2 }
}

/**
 * Sample a point on the limiter contour at a given poloidal angle.
 *
 * The angle is measured in degrees from the outboard midplane:
 *    0° = outboard midplane  (3 o'clock)
 *   90° = top                (12 o'clock)
 *  -90° = bottom             (6 o'clock)
 *  180° = inboard            (9 o'clock)
 *
 * Casts a ray from the contour center at the specified angle and
 * returns the (R, Z) of the first intersection with the contour
 * boundary.  This is the wall surface.
 */
export function sampleContourAtAngle(
  pts: [number, number][],
  thetaDeg: number,
  center?: { r: number; z: number },
): { r: number; z: number } | null {
  const c = center ?? contourCenter(pts)
  const thetaRad = thetaDeg * Math.PI / 180

  // Ray direction in (R, Z) space
  const dr = Math.cos(thetaRad)
  const dz = Math.sin(thetaRad)

  // Find the first (closest) intersection with the contour.
  // For a simple closed contour with the center inside, the first
  // outward intersection is the wall surface.
  let bestT = Infinity
  let bestR = 0
  let bestZ = 0

  for (let i = 0; i < pts.length; i++) {
    const ni = (i + 1) % pts.length
    const [r0, z0] = pts[i]
    const [r1, z1] = pts[ni]

    // Segment direction
    const sr = r1 - r0
    const sz = z1 - z0

    const denom = dr * sz - dz * sr
    if (Math.abs(denom) < 1e-12) continue

    const t = ((r0 - c.r) * sz - (z0 - c.z) * sr) / denom
    const u = ((r0 - c.r) * dz - (z0 - c.z) * dr) / denom

    if (t > 1e-6 && u >= 0 && u <= 1 && t < bestT) {
      bestT = t
      bestR = c.r + t * dr
      bestZ = c.z + t * dz
    }
  }

  return bestT < Infinity ? { r: bestR, z: bestZ } : null
}

/**
 * Find the outboard (maximum) wall R at a given Z by interpolating
 * the limiter contour. Returns the largest R among all segments that
 * cross the target Z — this is the outboard wall surface.
 */
function findOutboardR(pts: [number, number][], z: number): number {
  let maxR = 0
  for (let i = 0; i < pts.length; i++) {
    const ni = (i + 1) % pts.length
    const [r0, z0] = pts[i]
    const [r1, z1] = pts[ni]
    if ((z0 <= z && z1 >= z) || (z1 <= z && z0 >= z)) {
      const dz = z1 - z0
      if (Math.abs(dz) < 1e-10) continue
      const t = (z - z0) / dz
      const r = r0 + t * (r1 - r0)
      if (r > maxR) maxR = r
    }
  }
  return maxR
}

/**
 * Build dark circular disc decals for all extra port locations.
 *
 * Instead of cutting holes in the wall mesh (which depends on mesh
 * resolution and distorts tiles), these discs sit ON the wall surface
 * and use polygonOffset to win the depth test — a "press/pull" decal
 * approach. Each port is a smooth 32-segment circle completely
 * independent of wall quad density.
 *
 * Port positions are specified as poloidal angles (theta) and resolved
 * to (R, Z) via ray-casting against the limiter contour. This means
 * ports automatically follow the actual wall surface at any angle.
 *
 * Supports elliptical ports via the zRadius field.
 */

/** Resolved port position in (R, Z, φ) space for shader-based rendering. */
export interface ResolvedPort {
  wallR: number
  wallZ: number
  phi: number
  radius: number
  zRadius: number
  /** 0 = circle, 1 = square, 2 = stadium */
  shape: number
  /** Half-length of the straight section for stadium ports (metres) */
  toroidalExtent: number
  /** 0 = dark recess, 1 = ridged RF emitter */
  textureType: number
}

/**
 * Resolve each extra port's (R, Z) wall position by ray-casting against
 * the limiter contour.  Returns an array ready for packing into a data
 * texture consumed by the wall fragment shader.
 */
export function resolveExtraPortPositions(
  cfg: PortConfig,
  limiterPts: [number, number][],
): ResolvedPort[] {
  const ports = cfg.extraPorts
  if (!ports || ports.length === 0) return []
  const center = contourCenter(limiterPts)
  const resolved: ResolvedPort[] = []
  const shapeMap = { circle: 0, square: 1, stadium: 2 } as const
  const texMap = { dark: 0, rf: 1 } as const
  for (const port of ports) {
    const hit = sampleContourAtAngle(limiterPts, port.theta, center)
    if (!hit) continue
    resolved.push({
      wallR: hit.r,
      wallZ: hit.z,
      phi: port.phi,
      radius: port.radius,
      zRadius: port.zRadius ?? port.radius,
      shape: shapeMap[port.shape ?? 'circle'] ?? 0,
      toroidalExtent: port.toroidalExtent ?? 0,
      textureType: texMap[port.texture ?? 'dark'] ?? 0,
    })
  }
  return resolved
}

export function buildExtraPortDecals(
  cfg: PortConfig,
  limiterPts: [number, number][],
): THREE.BufferGeometry | null {
  const ports = cfg.extraPorts
  if (!ports || ports.length === 0) return null

  // Compute contour center once for all ports
  const center = contourCenter(limiterPts)

  const nSeg = 32      // segments per circle — smooth at any zoom
  const vertsPerPort = nSeg + 1   // center + rim
  const trisPerPort = nSeg

  const totalVerts = ports.length * vertsPerPort
  const totalIndices = ports.length * trisPerPort * 3

  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const indices = new Uint32Array(totalIndices)

  let vi = 0
  let ii = 0

  for (const port of ports) {
    // Resolve (R, Z) from poloidal angle via contour ray-casting
    const hit = sampleContourAtAngle(limiterPts, port.theta, center)
    if (!hit) continue

    const wallR = hit.r
    const wallZ = hit.z
    const zR = port.zRadius ?? port.radius
    const baseVert = vi

    // Disc normal: points inward (toward magnetic axis) at this phi
    const nx = -Math.cos(port.phi)
    const ny = -Math.sin(port.phi)

    // ── Center vertex ──
    const cv = toroidal(wallR, wallZ, port.phi)
    positions[vi * 3]     = cv.x
    positions[vi * 3 + 1] = cv.y
    positions[vi * 3 + 2] = cv.z
    normals[vi * 3]     = nx
    normals[vi * 3 + 1] = ny
    normals[vi * 3 + 2] = 0
    uvs[vi * 2]     = 0.5
    uvs[vi * 2 + 1] = 0.5
    vi++

    // ── Rim vertices — each rim point snaps to the wall R at its Z ──
    for (let si = 0; si < nSeg; si++) {
      const angle = (si / nSeg) * Math.PI * 2
      const localZ = Math.cos(angle) * zR
      const rimZ = wallZ + localZ
      const rimR = findOutboardR(limiterPts, rimZ) || wallR
      const localPhi = Math.sin(angle) * port.radius / rimR

      const v = toroidal(rimR, rimZ, port.phi + localPhi)
      positions[vi * 3]     = v.x
      positions[vi * 3 + 1] = v.y
      positions[vi * 3 + 2] = v.z
      normals[vi * 3]     = nx
      normals[vi * 3 + 1] = ny
      normals[vi * 3 + 2] = 0
      // UVs map (0,0)–(1,1) across disc for radial gradient in shader
      uvs[vi * 2]     = 0.5 + Math.cos(angle) * 0.5
      uvs[vi * 2 + 1] = 0.5 + Math.sin(angle) * 0.5
      vi++
    }

    // ── Triangle fan ──
    for (let si = 0; si < nSeg; si++) {
      const ns = (si + 1) % nSeg
      indices[ii++] = baseVert              // center
      indices[ii++] = baseVert + 1 + si     // current rim
      indices[ii++] = baseVert + 1 + ns     // next rim
    }
  }

  if (vi === 0) return null

  // Trim arrays if some ports were skipped (no contour intersection)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, vi * 3), 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals.subarray(0, vi * 3), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs.subarray(0, vi * 2), 2))
  geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, ii), 1))

  return geometry
}
