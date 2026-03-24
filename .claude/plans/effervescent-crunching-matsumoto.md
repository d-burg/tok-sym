# Double Null Support for DIII-D — Implementation Plan

## Overview

Add support for three magnetic configurations to DIII-D: **Lower Single Null** (current default), **Upper Single Null**, and **Double Null**. ITER remains locked to LSN. Configuration is selectable in the Shot Planner (discharge editing menu). The rendering pipeline in PortView must be generalized to handle X-points at any location (above, below, or both).

---

## Key Insight: Cerfon-Freidberg Symmetry

The 12 basis functions split neatly:
- **ψ₁–ψ₇** are **even** in y (contain y², y⁴, y⁶ — no odd powers)
- **ψ₈–ψ₁₂** are **odd** in y (contain y, y³, y⁵)

For **double null** (up-down symmetric): c₈ = c₉ = c₁₀ = c₁₁ = c₁₂ = 0, reducing to a **7×7 system**. Midplane ∂ψ/∂y = 0 conditions are automatic by symmetry, so we have exactly 7 BCs:
1. ψ = 0 at outboard midplane
2. ψ = 0 at inboard midplane
3. ψ = 0 at lower X-point (upper is automatic by symmetry)
4. ∂ψ/∂x = 0 at lower X-point
5. ∂ψ/∂y = 0 at lower X-point
6. Curvature N1 at outboard midplane
7. Curvature N2 at inboard midplane

For **upper single null**: mirror the LSN system by placing X-point at positive y, and the crown (curvature constraint) at negative y.

---

## Design Decision: Config in DischargeProgram

**Approach A — add `config` field to `DischargeProgram`** (recommended)
- DischargeProgram already serializes as JSON between JS↔WASM
- Config is naturally a property of a specific discharge/shot
- ShotPlanner can include it in the modified program JSON
- No API changes to SimHandle needed
- The `config` field is `Option<String>` — when `None`, falls back to `device.config`

---

## Phase 1 — Rust: Equilibrium Solver & Data Plumbing

### 1A. Add `config` to `DischargeProgram` (simulation.rs)

```rust
pub struct DischargeProgram {
    // ... existing fields ...
    /// Magnetic configuration override (e.g. "LowerSingleNull", "DoubleNull")
    /// When None, uses the device default.
    #[serde(default)]
    pub config_override: Option<String>,
}
```

In `Simulation::step()` (line ~595), change config resolution:
```rust
let config = if prog.delta < 0.1 {
    MagneticConfig::Limited
} else if let Some(ref cfg_str) = self.program.config_override {
    match cfg_str.as_str() {
        "DoubleNull" => MagneticConfig::DoubleNull,
        "UpperSingleNull" => MagneticConfig::UpperSingleNull,
        _ => self.device.config,
    }
} else {
    self.device.config
};
```

### 1B. Implement `assemble_dn_system()` (equilibrium.rs)

New function: 7×7 system using only even basis functions (ψ₁–ψ₇).

```rust
fn assemble_dn_system(shape: &ShapeParams) -> ([f64; 144], [f64; 12]) {
    // Use same 12×12 matrix but force c8..c12 = 0
    // Set rows 0-6 for the 7 BCs, rows 7-11 enforce c_i = 0
    // ...7 BCs: outboard ψ=0, inboard ψ=0, xpt ψ=0, xpt ∂ψ/∂x=0,
    //           xpt ∂ψ/∂y=0, curvature N1, curvature N2
    // Rows 7-11: identity rows for c8-c12 = 0
}
```

X-point locations: same formula as LSN for lower, mirrored for upper:
- Lower: `(1.0 - 1.05*ε*δ, -1.05*ε*κ)`
- Upper: `(1.0 - 1.05*ε*δ, +1.05*ε*κ)` — automatic from symmetry

### 1C. Implement `assemble_usn_system()` (equilibrium.rs)

Mirror of LSN — X-point at positive y, crown constraint at negative y:
```rust
fn assemble_usn_system(shape: &ShapeParams) -> ([f64; 144], [f64; 12]) {
    // Same as LSN but:
    // y_xpt = +1.05 * eps * kappa  (above midplane)
    // y_top → y_bottom = -eps * kappa (lower crown)
    // N3 curvature at bottom crown instead of top
}
```

### 1D. Update `CerfonEquilibrium::solve()` match (equilibrium.rs, line ~480)

```rust
let (mat, rhs) = match shape.config {
    MagneticConfig::LowerSingleNull => assemble_lsn_system(shape),
    MagneticConfig::UpperSingleNull => assemble_usn_system(shape),
    MagneticConfig::DoubleNull => assemble_dn_system(shape),
    MagneticConfig::Limited => assemble_lsn_system(shape),
};
```

### 1E. Generalize `x_point_physical()` (equilibrium.rs, line ~650)

Replace single x-point function with config-aware version:

```rust
/// Get X-point location(s) in physical coordinates.
/// Returns (lower_xpoint, upper_xpoint) where each is Option<(f64,f64)>.
pub fn x_points_physical(&self) -> (Option<(f64, f64)>, Option<(f64, f64)>) {
    let eps = self.shape.epsilon;
    let kappa = self.shape.kappa;
    let delta = self.shape.delta;
    let x_xpt = 1.0 - 1.05 * eps * delta;
    let y_lower = -1.05 * eps * kappa;
    let y_upper = 1.05 * eps * kappa;
    match self.shape.config {
        MagneticConfig::LowerSingleNull => {
            (Some((x_xpt * self.r0, y_lower * self.r0)), None)
        }
        MagneticConfig::UpperSingleNull => {
            (None, Some((x_xpt * self.r0, y_upper * self.r0)))
        }
        MagneticConfig::DoubleNull => {
            (Some((x_xpt * self.r0, y_lower * self.r0)),
             Some((x_xpt * self.r0, y_upper * self.r0)))
        }
        MagneticConfig::Limited => (None, None),
    }
}
```

Keep the old `x_point_physical()` for backward compat (returns the primary x-point).

### 1F. Update `SimulationSnapshot` (simulation.rs, line ~274)

Add new fields for dual x-points and config:
```rust
pub xpoint_r: f64,              // Primary X-point R (backward compat)
pub xpoint_z: f64,              // Primary X-point Z (backward compat)
pub xpoint_upper_r: f64,        // Upper X-point R (0 if none)
pub xpoint_upper_z: f64,        // Upper X-point Z (0 if none)
pub magnetic_config: String,    // "LowerSingleNull", "DoubleNull", etc.
```

Update `snapshot()` method (~line 731) to populate both x-points.

### 1G. Update limiter contact check (simulation.rs, line ~639)

Generalize the Z-filtering that skips divertor legs:
```rust
// For LSN: skip Z < z_xpt_lower + 0.05
// For USN: skip Z > z_xpt_upper - 0.05
// For DN: skip both regions
```

### 1H. DN default: smaller plasma

For DN on DIII-D, the plasma must be smaller to fit within both upper and lower divertor shelves. In the DN preset programs, use reduced ε (minor radius):
- Current DIII-D: a = 0.59 m → ε ≈ 0.353
- DN default: a ≈ 0.52 m → ε ≈ 0.311 (about 12% smaller)
- Also slightly lower κ (1.7 vs 1.8) for better fit

This can be achieved by having the DN discharge presets use slightly different shape parameters, OR by adding a device-level `dn_minor_radius` field.

**Simpler approach**: In `Simulation::step()`, when config is DN, apply a minor-radius scale factor:
```rust
let epsilon = if config == MagneticConfig::DoubleNull {
    self.device.epsilon() * 0.88  // ~12% smaller for DN
} else if config == MagneticConfig::Limited {
    self.device.epsilon() * (0.35 + 0.65 * ip_frac)
} else {
    self.device.epsilon()
};
```

---

## Phase 2 — Frontend: Snapshot & Types

### 2A. Update `Snapshot` interface (types.ts)

```typescript
// Add new fields
xpoint_upper_r: number
xpoint_upper_z: number
magnetic_config: string  // "LowerSingleNull" | "UpperSingleNull" | "DoubleNull" | "Limited"
```

### 2B. Update `DischargeProgram` interface (wasm.ts)

```typescript
export interface DischargeProgram {
  // ... existing fields ...
  config_override?: string  // Optional config override
}
```

---

## Phase 3 — Frontend: ShotPlanner Config Selector

### 3A. Add config selector to ShotPlanner (ShotPlanner.tsx)

Add a segmented control above the parameter sliders, only for DIII-D:

```tsx
{deviceId === 'diiid' && (
  <div>
    <label>Magnetic configuration</label>
    <div className="flex rounded overflow-hidden border border-gray-700 mt-1">
      {['LowerSingleNull', 'DoubleNull', 'UpperSingleNull'].map(cfg => (
        <button key={cfg} onClick={() => onConfigChange(cfg)} ...>
          {cfg === 'LowerSingleNull' ? 'Lower SN' :
           cfg === 'DoubleNull' ? 'Double Null' : 'Upper SN'}
        </button>
      ))}
    </div>
  </div>
)}
```

### 3B. Thread config through to `handleRun` (ShotPlanner.tsx)

When building the modified program JSON, include `config_override`:
```typescript
const modified: DischargeProgram = { ...baseProgram }
if (configOverride) {
  modified.config_override = configOverride
}
```

### 3C. Lift config state into ControlRoom (ControlRoom.tsx)

Add `configOverride` to the persistent planner state:
```typescript
const [configOverride, setConfigOverride] = useState<string | null>(null)
```

Pass it to ShotPlanner as prop. Reset on device/preset change.

---

## Phase 4 — Frontend: Generalize PortView Rendering

This is the most delicate phase. Every hardcoded LSN assumption must be generalized.

### 4A. X-point detection (PortView.tsx, line ~463)

**Current**: `const hasXpoint = xpR > 0 && xpZ < -0.01`

**New**: Detect any X-point (lower, upper, or both):
```typescript
const config = snapshot.magnetic_config
const hasLowerXpoint = snapshot.xpoint_r > 0 && snapshot.xpoint_z < -0.01
const hasUpperXpoint = snapshot.xpoint_upper_r > 0 && snapshot.xpoint_upper_z > 0.01
const hasXpoint = hasLowerXpoint || hasUpperXpoint
```

### 4B. Emission shell filtering (lines ~511, 520)

**Current**: `pts.filter(([, Z]) => Z > xpZ + 0.02)` — keeps only above X-point

**New**: Filter out ALL divertor regions:
```typescript
const inBulkPlasma = ([, Z]: [number, number]) => {
  if (hasLowerXpoint && Z < snapshot.xpoint_z + 0.02) return false
  if (hasUpperXpoint && Z > snapshot.xpoint_upper_z - 0.02) return false
  return true
}
// ...
const above = hasXpoint ? pts.filter(inBulkPlasma) : pts
```

### 4C. Divertor leg extraction (lines ~543-545)

**Current**: `snapshot.separatrix.points.filter(([, Z]) => Z <= xpZ + 0.01)`

**New**: Extract BOTH lower and upper divertor legs:
```typescript
const lowerDivPts: [number, number][] = hasLowerXpoint
  ? snapshot.separatrix.points.filter(([, Z]) => Z <= snapshot.xpoint_z + 0.01)
  : []
const upperDivPts: [number, number][] = hasUpperXpoint
  ? snapshot.separatrix.points.filter(([, Z]) => Z >= snapshot.xpoint_upper_z - 0.01)
  : []
```

### 4D. Divertor leg splitting and sorting (lines ~827-836)

**Current**: Splits by R < xpR / R > xpR, sorts Z descending.

**New**: For each divertor region (lower and upper), split into inner/outer legs:
```typescript
// Lower divertor legs (sorted Z descending = x-point at top → strike at bottom)
const lowerInner = lowerDivPts.filter(([R]) => R < snapshot.xpoint_r - 0.01)
const lowerOuter = lowerDivPts.filter(([R]) => R > snapshot.xpoint_r + 0.01)
lowerInner.sort((a, b) => b[1] - a[1])
lowerOuter.sort((a, b) => b[1] - a[1])

// Upper divertor legs (sorted Z ascending = x-point at bottom → strike at top)
const upperInner = upperDivPts.filter(([R]) => R < snapshot.xpoint_upper_r - 0.01)
const upperOuter = upperDivPts.filter(([R]) => R > snapshot.xpoint_upper_r + 0.01)
upperInner.sort((a, b) => a[1] - b[1])
upperOuter.sort((a, b) => a[1] - b[1])
```

### 4E. Strike point extraction (lines ~921-922)

**Current**: Last element of Z-descending sorted legs.

**New**: Last element of each sorted leg (works because sort direction matches divertor direction):
```typescript
// Lower strike points — last = lowest Z in each leg
if (lowerInner.length > 0) strikePointRZ.push(lowerInner[lowerInner.length - 1])
if (lowerOuter.length > 0) strikePointRZ.push(lowerOuter[lowerOuter.length - 1])
// Upper strike points — last = highest Z in each leg
if (upperInner.length > 0) strikePointRZ.push(upperInner[upperInner.length - 1])
if (upperOuter.length > 0) strikePointRZ.push(upperOuter[upperOuter.length - 1])
```

### 4F. Build unified legs array for rendering

Combine all legs into a single array for the existing leg rendering loop:
```typescript
const allLegs: [number, number][][] = []
if (lowerInner.length >= 2) allLegs.push([xpLower!, ...lowerInner])
if (lowerOuter.length >= 2) allLegs.push([xpLower!, ...lowerOuter])
if (upperInner.length >= 2) allLegs.push([xpUpper!, ...upperInner])
if (upperOuter.length >= 2) allLegs.push([xpUpper!, ...upperOuter])
```

The existing pre-projection + multi-pass rendering loop can operate on this array with minimal changes.

---

## Phase 5 — WASM Rebuild & Testing

### 5A. WASM build
```bash
wasm-pack build crates/tok-sym-core --target web --out-dir ../../web/src/wasm --release -- --features wasm
rm -rf web/node_modules/.vite
```

### 5B. Visual verification
- Run DIII-D in LSN → confirm nothing changed
- Switch to DN → verify smaller plasma with symmetric X-points, upper+lower divertor legs
- Switch to USN → verify upper X-point, upper divertor legs
- Switch to ITER → verify only LSN available, selector hidden
- Test during ramp-up, flat-top, ramp-down, and disruption for each config

---

## File Change Summary

| File | Changes |
|------|---------|
| `equilibrium.rs` | Add `assemble_dn_system()`, `assemble_usn_system()`, generalize `x_point_physical()`, update `solve()` match |
| `simulation.rs` | Add `config_override` to DischargeProgram, update config resolution, generalize limiter check, add snapshot fields |
| `devices.rs` | No changes needed (enum already has all variants) |
| `wasm_api.rs` | No changes needed (JSON serialization handles new fields) |
| `types.ts` | Add `xpoint_upper_r/z`, `magnetic_config` to Snapshot |
| `wasm.ts` | Add `config_override` to DischargeProgram |
| `ShotPlanner.tsx` | Add config selector (DIII-D only), include config in program JSON |
| `ControlRoom.tsx` | Add configOverride state, pass to ShotPlanner |
| `PortView.tsx` | Generalize x-point detection, emission shell filtering, divertor leg extraction/splitting/sorting, strike point extraction |
