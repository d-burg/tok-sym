import { useRef, useEffect, useCallback } from 'react'
import type { Snapshot } from '../lib/types'

interface Props {
  snapshot: Snapshot | null
  limiterPoints?: [number, number][]
  deviceId?: string
}

// ── Per-machine opacity tuning ───────────────────────────────────────────
// Hotter / larger machines get lower opacity so the plasma surface looks
// more tenuous and physically correct (optically thinner at higher Te).
const DEVICE_OPACITY_SCALE: Record<string, number> = {
  diiid:   0.45,   // medium-size — keep plasma subtle / tenuous
  iter:    0.55,   // very large, very hot → more transparent than DIII-D
  sparc:   0.55,   // compact but high-field / high-Te
  jet:     0.60,   // large conventional tokamak
}
const DEFAULT_OPACITY_SCALE = 0.65

// Per-machine power scaling for strike point glow intensity.
// Higher-power devices produce brighter divertor strike-point emission.
const DEVICE_POWER_SCALE: Record<string, number> = {
  diiid:   0.18,  // ~5–15 MW NBI — very subtle hint
  iter:    1.0,   // ~50 MW — very bright strike points
  sparc:   0.8,   // ~25 MW in compact device
  jet:     0.6,   // ~25 MW conventional
}
const DEFAULT_POWER_SCALE = 0.5

// Strike-point glow fade-in/out time constant (seconds).
// The glow ramps smoothly over this duration rather than snapping on/off.
const STRIKE_FADE_RATE = 0.5   // seconds to go 0→1 (or 1→0)

// ── Camera & projection constants ──────────────────────────────────────────

const CAM_R = 3.8
const CAM_PHI = 0
const CAM_Z = 0.15
const LOOK_R = 1.2
const LOOK_PHI = 0.25
const LOOK_Z = -0.05
const FOV = 55

// Toroidal sweep range
const PHI_MIN = -0.65
const PHI_MAX = 0.75
const N_SLICES = 50

// Surface rendering tuning — multi-shell radial emission profile
// Physically, visible-light emission peaks near the separatrix where
// partially-ionized impurities and neutrals radiate (cooler edge).
// The hot core is essentially transparent at visible wavelengths.
const SURFACE_BASE_ALPHA = 0.005
const SURFACE_ELM_ALPHA  = 0.010
const SURFACE_BLUR_PX = 2.5

// Radial emission shells: each shell is a concentric contour at a given
// scale factor from the centroid.  The alpha weight follows a peaked
// profile centred on the separatrix (scale = 1.0).
//   - Inner shells (scale < 0.8):  nearly invisible → transparent core
//   - Mid shells  (0.8 – 0.93):   very gentle ramp → faint pedestal hint
//   - Edge shells (0.95 – 1.03):  steep rise to bright peak → luminous separatrix
//   - SOL shells  (> 1.03):       fast drop-off → thin scrape-off layer
const EMISSION_SHELLS: { scale: number; weight: number }[] = [
  { scale: 0.65, weight: 0.01 },   // deep core — nearly invisible
  { scale: 0.82, weight: 0.03 },   // mid core — very faint
  { scale: 0.92, weight: 0.10 },   // inner pedestal — gentle hint
  { scale: 0.97, weight: 0.50 },   // outer pedestal — rising fast
  { scale: 1.00, weight: 1.00 },   // separatrix peak
  { scale: 1.02, weight: 0.50 },   // near SOL — still bright
  { scale: 1.05, weight: 0.10 },   // far SOL — fading fast
]

// ── Limb-brightened separatrix glow ─────────────────────────────────────
// In a real tokamak, sight lines tangent to the separatrix shell pass
// through a long column of emitting material.  Path length through a
// thin toroidal shell at major radius R goes roughly as ~1/R, so the
// inboard side (small R, tight curvature) accumulates ~2× more emission
// than the outboard side.  We model this as per-segment stroke alpha
// weighted by (R_geo / R_local)^LIMB_EXPONENT.
const LIMB_GLOW_PASSES: { lineWidth: number; alphaScale: number }[] = [
  { lineWidth: 6.0, alphaScale: 0.20 },  // outer halo — wider, slightly brighter
  { lineWidth: 2.5, alphaScale: 0.55 },  // bright core
]
const LIMB_EXPONENT = 1.4   // controls inboard/outboard contrast
const LIMB_BASE_ALPHA = 0.018  // overall brightness of the limb glow (up from 0.015)
const LIMB_N_SECTORS = 6     // split LCFS into N angular sectors for perf

// Divertor leg rendering: half-width of the ribbon (in meters, R-Z space)
const LEG_HALF_WIDTH = 0.04
// Number of waypoints along each divertor leg
const LEG_NPTS = 6

// ── 3D math helpers ────────────────────────────────────────────────────────

interface Vec3 { x: number; y: number; z: number }

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (len < 1e-12) return { x: 0, y: 0, z: 1 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function buildCamera(W: number, H: number) {
  const camPos: Vec3 = {
    x: CAM_R * Math.cos(CAM_PHI),
    y: CAM_R * Math.sin(CAM_PHI),
    z: CAM_Z,
  }
  const lookAt: Vec3 = {
    x: LOOK_R * Math.cos(LOOK_PHI),
    y: LOOK_R * Math.sin(LOOK_PHI),
    z: LOOK_Z,
  }

  const forward = normalize(sub(lookAt, camPos))
  const worldUp: Vec3 = { x: 0, y: 0, z: 1 }
  const right = normalize(cross(forward, worldUp))
  const up = cross(right, forward)

  const focal = (Math.min(W, H) * 0.5) / Math.tan((FOV * Math.PI) / 360)
  const cx = W * 0.5
  const cy = H * 0.5

  return {
    pos: camPos,
    project(p: Vec3): { sx: number; sy: number; depth: number } | null {
      const d = sub(p, camPos)
      const cz = dot(forward, d)
      if (cz < 0.05) return null
      const px = dot(right, d)
      const py = dot(up, d)
      return {
        sx: cx + (focal * px) / cz,
        sy: cy - (focal * py) / cz,
        depth: cz,
      }
    },
  }
}

// ── Toroidal sweep ─────────────────────────────────────────────────────────

function toroidal(R: number, Z: number, phi: number): Vec3 {
  return { x: R * Math.cos(phi), y: R * Math.sin(phi), z: Z }
}

function subsample(pts: [number, number][], maxPts: number): [number, number][] {
  if (pts.length <= maxPts) return pts
  const step = pts.length / maxPts
  const out: [number, number][] = []
  for (let i = 0; i < maxPts; i++) {
    out.push(pts[Math.floor(i * step)])
  }
  return out
}

/**
 * Densify a closed (R,Z) contour by interpolating points where consecutive
 * points are more than maxGap apart. Treats the contour as a closed loop.
 */
function densifyContour(pts: [number, number][], maxGap: number): [number, number][] {
  const result: [number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    result.push(pts[i])
    const ni = (i + 1) % pts.length
    const dR = pts[ni][0] - pts[i][0]
    const dZ = pts[ni][1] - pts[i][1]
    const dist = Math.sqrt(dR * dR + dZ * dZ)
    if (dist > maxGap) {
      const n = Math.ceil(dist / maxGap)
      for (let k = 1; k < n; k++) {
        const t = k / n
        result.push([pts[i][0] + t * dR, pts[i][1] + t * dZ])
      }
    }
  }
  return result
}

// ── Projected point type ───────────────────────────────────────────────────

interface ScreenPt { sx: number; sy: number; depth: number }

// ── Divertor leg geometry ─────────────────────────────────────────────────

/**
 * Build (R, Z) polyline waypoints for inner and outer divertor legs.
 * Each leg curves from the X-point down to approximate strike point locations.
 * Returns [innerLeg, outerLeg] arrays of (R,Z) pairs.
 */
function buildDivertorLegs(xR: number, xZ: number): [[number, number][], [number, number][]] {
  const inner: [number, number][] = []
  const outer: [number, number][] = []
  for (let i = 0; i < LEG_NPTS; i++) {
    const t = i / (LEG_NPTS - 1) // 0 = X-point, 1 = strike point
    // Inner leg: curves inboard and down
    inner.push([
      xR - 0.04 * t - 0.12 * t * t,  // R decreases (inboard)
      xZ - 0.30 * t,                  // Z decreases (downward)
    ])
    // Outer leg: curves outboard and down
    outer.push([
      xR + 0.04 * t + 0.10 * t * t,  // R increases (outboard)
      xZ - 0.30 * t,                  // Z decreases (downward)
    ])
  }
  return [inner, outer]
}

/**
 * Build a thin ribbon polygon from a (R,Z) polyline with given half-width.
 * Returns an array of (R,Z) points forming a closed ribbon (forward along
 * one side, backward along the other).
 */
function buildLegRibbon(leg: [number, number][], halfW: number): [number, number][] {
  if (leg.length < 2) return []
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < leg.length; i++) {
    // Compute perpendicular direction from local tangent
    let dR: number, dZ: number
    if (i === 0) {
      dR = leg[1][0] - leg[0][0]
      dZ = leg[1][1] - leg[0][1]
    } else if (i === leg.length - 1) {
      dR = leg[i][0] - leg[i - 1][0]
      dZ = leg[i][1] - leg[i - 1][1]
    } else {
      dR = leg[i + 1][0] - leg[i - 1][0]
      dZ = leg[i + 1][1] - leg[i - 1][1]
    }
    const len = Math.sqrt(dR * dR + dZ * dZ) || 1
    // Perpendicular: rotate tangent 90°
    const nR = -dZ / len
    const nZ = dR / len
    // Taper: narrower at X-point (i=0), wider at strike point
    const taper = 0.5 + 0.5 * (i / (leg.length - 1))
    const w = halfW * taper
    left.push([leg[i][0] + nR * w, leg[i][1] + nZ * w])
    right.push([leg[i][0] - nR * w, leg[i][1] - nZ * w])
  }
  // Closed ribbon: left forward, right backward
  return [...left, ...right.reverse()]
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PortView({ snapshot, limiterPoints, deviceId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const wallCacheRef = useRef<{ canvas: HTMLCanvasElement; w: number; h: number; key: string } | null>(null)
  const strikeGlowRef = useRef(0)       // current fade level 0–1
  const prevTimeRef = useRef<number>(0)  // previous snapshot time for dt calc

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Size canvas to container — only resize when dimensions change
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const targetW = Math.round(rect.width * dpr)
    const targetH = Math.round(rect.height * dpr)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const W = rect.width
    const H = rect.height

    // Ensure offscreen canvas — only resize when dimensions change
    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas')
    }
    const offscreen = offscreenRef.current
    if (offscreen.width !== canvas.width || offscreen.height !== canvas.height) {
      offscreen.width = canvas.width
      offscreen.height = canvas.height
    }

    // Dark background
    ctx.fillStyle = '#06080d'
    ctx.fillRect(0, 0, W, H)

    const cam = buildCamera(W, H)

    // Draw limiter wall (cached — geometry is static so we only redraw on resize)
    if (limiterPoints && limiterPoints.length > 2) {
      const wallKey = `${canvas.width}x${canvas.height}x${limiterPoints.length}`
      const wc = wallCacheRef.current
      if (!wc || wc.key !== wallKey) {
        const wallCanvas = wc?.canvas ?? document.createElement('canvas')
        wallCanvas.width = canvas.width
        wallCanvas.height = canvas.height
        const wallCtx = wallCanvas.getContext('2d')
        if (wallCtx) {
          wallCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
          drawLimiterWall(wallCtx, cam, limiterPoints, W, H)
          wallCacheRef.current = { canvas: wallCanvas, w: canvas.width, h: canvas.height, key: wallKey }
        }
      }
      if (wallCacheRef.current) {
        ctx.drawImage(wallCacheRef.current.canvas, 0, 0, canvas.width, canvas.height, 0, 0, W, H)
      }
    }

    if (!snapshot || snapshot.separatrix.points.length < 4) {
      ctx.fillStyle = '#4b556366'
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No plasma', W * 0.55, H * 0.52)
      return
    }

    const lcfs = subsample(snapshot.separatrix.points, 35)
    const elmActive = snapshot.elm_active
    const disrupted = snapshot.disrupted

    // ── Step 1: Build projection grid ──
    const phis: number[] = []
    for (let i = 0; i < N_SLICES; i++) {
      phis.push(PHI_MIN + (PHI_MAX - PHI_MIN) * (i / (N_SLICES - 1)))
    }

    const grid: (ScreenPt | null)[][] = []
    const sliceDepths: number[] = []

    for (let s = 0; s < N_SLICES; s++) {
      const phi = phis[s]
      const row: (ScreenPt | null)[] = []
      let depthSum = 0
      let depthCount = 0
      for (const [R, Z] of lcfs) {
        const p3d = toroidal(R, Z, phi)
        const p2d = cam.project(p3d)
        if (p2d) {
          row.push({ sx: p2d.sx, sy: p2d.sy, depth: p2d.depth })
          depthSum += p2d.depth
          depthCount++
        } else {
          row.push(null)
        }
      }
      grid.push(row)
      sliceDepths.push(depthCount > 0 ? depthSum / depthCount : 100)
    }

    // Depth range for normalization
    let minDepth = Infinity, maxDepth = -Infinity
    for (const d of sliceDepths) {
      if (d < minDepth) minDepth = d
      if (d > maxDepth) maxDepth = d
    }
    const depthRange = maxDepth - minDepth + 0.01

    // ── Toroidal path-length factor ──
    // For optically thin emission from a toroidal shell, the brightness at
    // each screen pixel depends on the accumulated path through the shell
    // along the sight line.  Face-on slices (nearest to camera) → short
    // path → dim.  Tangential slices (toroidal limbs) → long path → bright.
    //
    // path ∝ |d| / |R₀ - R_cam·cos(φ)|  where d = camera-to-point distance.
    let rLcfsMin = Infinity, rLcfsMax = -Infinity
    for (const [R] of lcfs) {
      if (R < rLcfsMin) rLcfsMin = R
      if (R > rLcfsMax) rLcfsMax = R
    }
    const rGeo = (rLcfsMin + rLcfsMax) / 2

    const pathFactor: number[] = []
    let pathMin = Infinity
    for (let s = 0; s < N_SLICES; s++) {
      const phi = phis[s]
      const dx = rGeo * Math.cos(phi) - CAM_R
      const dy = rGeo * Math.sin(phi)
      const dist = Math.sqrt(dx * dx + dy * dy)
      const faceOn = Math.abs(rGeo - CAM_R * Math.cos(phi))
      const pf = faceOn > 0.01 ? dist / faceOn : 10.0
      pathFactor.push(pf)
      if (pf < pathMin) pathMin = pf
    }
    // Normalize: face-on slice = 1.0, tangential slices > 1.0
    for (let s = 0; s < N_SLICES; s++) {
      pathFactor[s] /= pathMin
    }

    // ── Step 2: Draw filled surface to offscreen canvas ──
    const oCtx = offscreen.getContext('2d')
    if (!oCtx) return
    oCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    oCtx.clearRect(0, 0, W, H)

    // Surface color — slightly brighter cyan-blue
    const sr = disrupted ? 200 : 100
    const sg = disrupted ? 90 : 175
    const sb = disrupted ? 50 : 230

    // Per-machine opacity: look up scale factor from device ID
    const opacityScale = (deviceId && DEVICE_OPACITY_SCALE[deviceId]) ?? DEFAULT_OPACITY_SCALE
    const baseAlpha = (elmActive && !disrupted ? SURFACE_ELM_ALPHA : SURFACE_BASE_ALPHA) * opacityScale

    // Sort slices by depth: back-to-front (painter's algorithm)
    const sliceOrder = Array.from({ length: N_SLICES }, (_, i) => i)
    sliceOrder.sort((a, b) => sliceDepths[b] - sliceDepths[a])

    oCtx.globalCompositeOperation = 'source-over'

    // For each slice, compute the screen-space centroid of the LCFS contour
    // so we can scale outward/inward for edge diffusion rings.
    for (const s of sliceOrder) {
      const depthFrac = 1 - (sliceDepths[s] - minDepth) / depthRange // 0=far, 1=near
      // Mild depth cue (atmospheric perspective) + toroidal path-length factor.
      // For optically thin emission, path length dominates over proximity.
      const sliceAlpha = baseAlpha * (0.7 + depthFrac * 0.3) * pathFactor[s]

      const slicePts = grid[s]

      // Compute screen-space centroid of visible points
      let cxSum = 0, cySum = 0, visCount = 0
      for (let j = 0; j < lcfs.length; j++) {
        const p = slicePts[j]
        if (!p) continue
        cxSum += p.sx
        cySum += p.sy
        visCount++
      }
      if (visCount < 3) continue
      const centX = cxSum / visCount
      const centY = cySum / visCount

      // Draw concentric emission shells — peaked at the separatrix
      for (const shell of EMISSION_SHELLS) {
        const shellAlpha = sliceAlpha * shell.weight
        if (shellAlpha < 0.0003) continue

        oCtx.beginPath()
        let started = false
        for (let j = 0; j < lcfs.length; j++) {
          const p = slicePts[j]
          if (!p) continue
          // Scale point relative to centroid
          const sx = centX + (p.sx - centX) * shell.scale
          const sy = centY + (p.sy - centY) * shell.scale
          if (!started) { oCtx.moveTo(sx, sy); started = true }
          else oCtx.lineTo(sx, sy)
        }
        oCtx.closePath()
        oCtx.fillStyle = `rgba(${sr},${sg},${sb},${shellAlpha.toFixed(4)})`
        oCtx.fill()
      }
    }

    // ── Step 2a: Limb-brightened separatrix glow ──
    // Draw the LCFS outline as per-sector strokes whose brightness depends on:
    //  1. Toroidal path factor (dominant) — tangential sight lines through the
    //     toroidal shell accumulate more emission than face-on views.
    //  2. Poloidal R-weighting (secondary) — within each slice, inboard
    //     segments (small R, tighter curvature) have slightly longer paths.
    {
      const limbAlpha = LIMB_BASE_ALPHA * opacityScale
        * (elmActive && !disrupted ? 1.8 : 1.0)

      // Pre-compute sector boundaries and mild R-based poloidal weighting
      const sectorSize = Math.ceil(lcfs.length / LIMB_N_SECTORS)
      const sectorLimb: number[] = []
      for (let sec = 0; sec < LIMB_N_SECTORS; sec++) {
        const j0 = sec * sectorSize
        const j1 = Math.min((sec + 1) * sectorSize, lcfs.length)
        let rSum = 0, cnt = 0
        for (let j = j0; j < j1; j++) {
          rSum += lcfs[j][0]
          cnt++
        }
        const rAvg = cnt > 0 ? rSum / cnt : rGeo
        // Mild poloidal factor — sqrt of the full exponent for subtlety
        sectorLimb.push(Math.pow(rGeo / rAvg, LIMB_EXPONENT * 0.5))
      }

      for (const s of sliceOrder) {
        const depthFrac = 1 - (sliceDepths[s] - minDepth) / depthRange
        // Toroidal path factor is the primary driver; mild depth cue secondary
        const sliceLimbAlpha = limbAlpha * (0.7 + depthFrac * 0.3) * pathFactor[s]

        const slicePts = grid[s]

        // Draw glow passes per sector (8 arc segments, each with its own alpha)
        for (const pass of LIMB_GLOW_PASSES) {
          oCtx.lineWidth = pass.lineWidth
          oCtx.lineCap = 'round'
          oCtx.lineJoin = 'round'

          for (let sec = 0; sec < LIMB_N_SECTORS; sec++) {
            const segAlpha = sliceLimbAlpha * pass.alphaScale * sectorLimb[sec]
            if (segAlpha < 0.0003) continue

            const j0 = sec * sectorSize
            const j1 = Math.min((sec + 1) * sectorSize + 1, lcfs.length)

            oCtx.beginPath()
            let started = false
            for (let j = j0; j < j1; j++) {
              const p = slicePts[j]
              if (!p) continue
              if (!started) { oCtx.moveTo(p.sx, p.sy); started = true }
              else oCtx.lineTo(p.sx, p.sy)
            }
            if (!started) continue
            oCtx.strokeStyle = `rgba(${sr},${sg},${sb},${segAlpha.toFixed(4)})`
            oCtx.stroke()
          }
        }
      }
    }

    // ── Step 2b: Draw divertor legs as toroidally-swept ribbons ──
    let strikePointRZ: [number, number][] = []
    if (snapshot.xpoint_r > 0) {
      const [innerLeg, outerLeg] = buildDivertorLegs(snapshot.xpoint_r, snapshot.xpoint_z)
      const innerRibbon = buildLegRibbon(innerLeg, LEG_HALF_WIDTH)
      const outerRibbon = buildLegRibbon(outerLeg, LEG_HALF_WIDTH)

      // Leg color: slightly brighter/whiter than bulk plasma
      const lr = disrupted ? 220 : 140
      const lg = disrupted ? 110 : 210
      const lb = disrupted ? 70 : 255
      const legAlphaBase = baseAlpha * 5.0 // legs need high per-slice alpha to accumulate visibility

      for (const s of sliceOrder) {
        const depthFrac = 1 - (sliceDepths[s] - minDepth) / depthRange
        const legAlpha = legAlphaBase * (0.5 + depthFrac * 0.5) * pathFactor[s]
        if (legAlpha < 0.0002) continue
        const phi = phis[s]

        for (const ribbon of [innerRibbon, outerRibbon]) {
          if (ribbon.length < 3) continue
          oCtx.beginPath()
          let started = false
          for (const [R, Z] of ribbon) {
            const p3d = toroidal(R, Z, phi)
            const p2d = cam.project(p3d)
            if (!p2d) continue
            if (!started) { oCtx.moveTo(p2d.sx, p2d.sy); started = true }
            else oCtx.lineTo(p2d.sx, p2d.sy)
          }
          oCtx.closePath()
          oCtx.fillStyle = `rgba(${lr},${lg},${lb},${legAlpha.toFixed(4)})`
          oCtx.fill()
        }
      }

      // Save strike point positions for main-canvas glow rendering
      // (drawn after composite so warm glow isn't swamped by cyan plasma)
      strikePointRZ = [
        innerLeg[innerLeg.length - 1],
        outerLeg[outerLeg.length - 1],
      ]
    }

    // ── Step 3: Composite blurred surface onto main canvas ──
    // With many overlapping polygons, the surface is already quite smooth.
    // A moderate blur gives a soft glow; the sharp pass adds plasma definition.
    ctx.save()
    ctx.filter = `blur(${SURFACE_BLUR_PX}px)`
    ctx.globalAlpha = 0.9
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height, 0, 0, W, H)
    ctx.restore()

    // Second, sharper pass for plasma core definition
    ctx.save()
    ctx.globalAlpha = 0.7
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height, 0, 0, W, H)
    ctx.restore()

    // ── Step 4: Strike point glow on divertor plates ──
    // Drawn on the main canvas AFTER compositing so warm glow isn't
    // swamped by the cyan plasma emission on the offscreen buffer.
    // Where the divertor legs contact the limiter, intense heat creates
    // visible glowing hotspots.  Brightness scales with device power.
    //
    // Fade logic: the glow ramps in/out over STRIKE_FADE_RATE seconds,
    // driven by in_hmode.  This avoids abrupt on/off and prevents
    // floating glow rings during ramp-up / ramp-down when the strike
    // points haven't yet settled on the divertor plates.
    const wantStrikeGlow = snapshot.in_hmode && !disrupted
    const dt = Math.abs(snapshot.time - prevTimeRef.current)
    prevTimeRef.current = snapshot.time
    const fadeStep = STRIKE_FADE_RATE > 0 ? Math.min(dt / STRIKE_FADE_RATE, 1) : 1
    if (wantStrikeGlow) {
      strikeGlowRef.current = Math.min(strikeGlowRef.current + fadeStep, 1)
    } else {
      strikeGlowRef.current = Math.max(strikeGlowRef.current - fadeStep, 0)
    }
    const strikeFade = strikeGlowRef.current
    if (strikePointRZ.length > 0 && strikeFade > 0.001) {
      const powerScale = (deviceId && DEVICE_POWER_SCALE[deviceId]) ?? DEFAULT_POWER_SCALE
      const strikeAlpha = 0.12 * powerScale * opacityScale * strikeFade

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const [spR, spZ] of strikePointRZ) {
        for (const s of sliceOrder) {
          const phi = phis[s]
          const p3d = toroidal(spR, spZ, phi)
          const p2d = cam.project(p3d)
          if (!p2d) continue

          const depthFrac = 1 - (sliceDepths[s] - minDepth) / depthRange
          const gAlpha = strikeAlpha * (0.5 + depthFrac * 0.5) * pathFactor[s]
          if (gAlpha < 0.001) continue

          const glowR = 12 + depthFrac * 18
          const grad = ctx.createRadialGradient(
            p2d.sx, p2d.sy, 0,
            p2d.sx, p2d.sy, glowR,
          )
          grad.addColorStop(0, `rgba(255,210,150,${(gAlpha * 1.5).toFixed(4)})`)
          grad.addColorStop(0.25, `rgba(255,150,80,${gAlpha.toFixed(4)})`)
          grad.addColorStop(0.55, `rgba(220,90,30,${(gAlpha * 0.4).toFixed(4)})`)
          grad.addColorStop(1, 'rgba(150,40,10,0)')
          ctx.fillStyle = grad
          ctx.fillRect(p2d.sx - glowR, p2d.sy - glowR, glowR * 2, glowR * 2)
        }
      }
      ctx.restore()
    }

    // ── Step 5: ELM flash overlay ──
    if (elmActive && !disrupted) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const grad = ctx.createRadialGradient(W * 0.5, H * 0.48, 0, W * 0.5, H * 0.48, W * 0.45)
      grad.addColorStop(0, 'rgba(200, 240, 255, 0.10)')
      grad.addColorStop(0.5, 'rgba(150, 220, 255, 0.05)')
      grad.addColorStop(1, 'rgba(100, 180, 255, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }

    // ── Step 7: Disrupted flash ──
    if (disrupted) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = 'rgba(255, 60, 30, 0.08)'
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
  }, [snapshot, limiterPoints, deviceId])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(container)
    return () => ro.disconnect()
  }, [draw])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute bottom-0.5 left-0 right-0 text-center text-[10px] text-gray-600 font-mono pointer-events-none">
        Port view
      </div>
    </div>
  )
}

// ── Drawing helpers ────────────────────────────────────────────────────────

// drawXpointGlow removed — divertor legs now use smooth toroidal ribbon rendering

/**
 * Draw the limiter wall as a smooth toroidally-swept surface.
 * Uses individual quad faces with backface culling and depth sorting
 * to create the appearance of a hollow torus interior.
 * The full closed contour is swept — backface culling naturally hides
 * the outboard-facing exterior, creating the "looking through the port" effect.
 */
function drawLimiterWall(
  ctx: CanvasRenderingContext2D,
  cam: ReturnType<typeof buildCamera>,
  limiter: [number, number][],
  _W: number,
  _H: number,
) {
  // Densify contour — interpolate large gaps (inboard wall segments)
  // and treat the contour as a closed loop
  const pts = densifyContour(limiter, 0.08)
  const nPts = pts.length
  if (nPts < 3) return

  const nSlices = 32 // wall doesn't need as many slices as plasma
  const phis: number[] = []
  for (let i = 0; i < nSlices; i++) {
    phis.push(PHI_MIN + (PHI_MAX - PHI_MIN) * (i / (nSlices - 1)))
  }

  // Approximate plasma axis R for backface culling
  const AXIS_R = 1.7

  // Build 3D grid: grid3D[slice][pointIdx] = Vec3
  const grid3D: Vec3[][] = []
  for (let s = 0; s < nSlices; s++) {
    const phi = phis[s]
    const row: Vec3[] = []
    for (const [R, Z] of pts) {
      row.push(toroidal(R, Z, phi))
    }
    grid3D.push(row)
  }

  // Build screen projection grid: gridScr[slice][pointIdx] = ScreenPt | null
  const gridScr: (ScreenPt | null)[][] = []
  for (let s = 0; s < nSlices; s++) {
    const row: (ScreenPt | null)[] = []
    for (const p3d of grid3D[s]) {
      const p2d = cam.project(p3d)
      row.push(p2d ? { sx: p2d.sx, sy: p2d.sy, depth: p2d.depth } : null)
    }
    gridScr.push(row)
  }

  // Build individual quad faces with backface culling
  const quadDepths: number[] = []
  const quadCorners: (ScreenPt | null)[][] = []

  for (let s = 0; s < nSlices - 1; s++) {
    const phiMid = (phis[s] + phis[s + 1]) * 0.5
    const axisPt = toroidal(AXIS_R, 0, phiMid)

    for (let j = 0; j < nPts; j++) {
      const jn = (j + 1) % nPts // closed contour

      // 3D corners: [s,j] [s,jn] [s+1,jn] [s+1,j]
      const a = grid3D[s][j]
      const b = grid3D[s][jn]
      const c = grid3D[s + 1][jn]
      const d = grid3D[s + 1][j]

      // Quad center in 3D
      const qcx = (a.x + b.x + c.x + d.x) * 0.25
      const qcy = (a.y + b.y + c.y + d.y) * 0.25
      const qcz = (a.z + b.z + c.z + d.z) * 0.25

      // Backface culling: only show interior-facing surface
      // "Inward" direction = from limiter surface toward plasma axis
      const inward: Vec3 = {
        x: axisPt.x - qcx,
        y: axisPt.y - qcy,
        z: -qcz, // axis is at Z=0
      }
      const viewDir: Vec3 = {
        x: cam.pos.x - qcx,
        y: cam.pos.y - qcy,
        z: cam.pos.z - qcz,
      }

      // If inward direction aligns with view direction, the interior face
      // is visible to the camera — draw it
      if (dot(inward, viewDir) <= 0) continue

      // Screen projections
      const sa = gridScr[s][j]
      const sb = gridScr[s][jn]
      const sc = gridScr[s + 1][jn]
      const sd = gridScr[s + 1][j]

      // Need at least 3 visible corners for a meaningful polygon
      let visCount = 0
      let depthSum = 0
      for (const p of [sa, sb, sc, sd]) {
        if (p) { visCount++; depthSum += p.depth }
      }
      if (visCount < 3) continue

      quadCorners.push([sa, sb, sc, sd])
      quadDepths.push(depthSum / visCount)
    }
  }

  if (quadCorners.length === 0) return

  // Build sort indices (back-to-front)
  const indices = Array.from({ length: quadCorners.length }, (_, i) => i)
  indices.sort((a, b) => quadDepths[b] - quadDepths[a])

  // Depth range for shading
  let minD = Infinity, maxD = -Infinity
  for (const d of quadDepths) {
    if (d < minD) minD = d
    if (d > maxD) maxD = d
  }
  const dRange = maxD - minD + 0.01

  // Draw all quads back-to-front
  ctx.save()
  for (const qi of indices) {
    const df = 1 - (quadDepths[qi] - minD) / dRange // 0=far, 1=near
    const brightness = Math.round(14 + df * 34)
    const alpha = 0.75 + df * 0.20

    const corners = quadCorners[qi]
    ctx.beginPath()
    let started = false
    for (const p of corners) {
      if (!p) continue
      if (!started) { ctx.moveTo(p.sx, p.sy); started = true }
      else ctx.lineTo(p.sx, p.sy)
    }
    ctx.closePath()
    ctx.fillStyle = `rgba(${brightness},${brightness + 2},${brightness + 6},${alpha.toFixed(2)})`
    ctx.fill()
  }
  ctx.restore()
}
