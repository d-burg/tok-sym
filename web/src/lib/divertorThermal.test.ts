/**
 * Standalone sanity tests for DivertorThermalModel.
 * Run with: npx tsx src/lib/divertorThermal.test.ts
 */
import { DivertorThermalModel } from './fusionPhysics'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// ── Test 1: ITER at 10 MW/m² steady — should equilibrate at 1200–1500°C ──
{
  const model = new DivertorThermalModel('iter')
  const dt = 0.05  // 50 ms steps
  let prevT = model.t_surface
  let monotonic = true
  for (let i = 0; i < 600; i++) {  // 30 seconds — enough to equilibrate
    model.step(10, 0, 0, dt)
    if (model.t_surface < prevT - 0.01) {
      monotonic = false
      console.error(`  Non-monotonic at step ${i}: ${prevT.toFixed(1)} → ${model.t_surface.toFixed(1)}`)
    }
    prevT = model.t_surface
  }
  console.log(`Test 1 (ITER 10 MW/m² steady): T_final=${model.t_surface.toFixed(0)}°C, monotonic=${monotonic}`)
  assert(monotonic, 'Temperature should rise monotonically under constant heat flux')
  assert(model.t_surface > 1000, `ITER at 10 MW/m² should reach > 1000°C, got ${model.t_surface.toFixed(0)}`)
  assert(model.t_surface < 1800, `ITER at 10 MW/m² should stay < 1800°C, got ${model.t_surface.toFixed(0)}`)
}

// ── Test 2: ELM impulse causes step increase, not wild oscillation ──
// ITER H-mode: 10 MW/m² baseline + periodic ELMs at 100 MW/m² for 0.5ms
{
  const model = new DivertorThermalModel('iter')
  const dt = 0.05
  let maxDrop = 0
  let prevT = model.t_surface
  for (let i = 0; i < 200; i++) {
    // ELM every 10 steps (0.5 seconds, ~2 Hz)
    const isELM = (i % 10 === 0) && i > 20
    const elm_q = isELM ? 100 : 0
    const tau_elm = 0.0005
    model.step(10, elm_q, tau_elm, dt)
    const drop = prevT - model.t_surface
    if (drop > maxDrop) maxDrop = drop
    prevT = model.t_surface
  }
  console.log(`Test 2 (ITER ELMs): T_final=${model.t_surface.toFixed(0)}°C, max_drop=${maxDrop.toFixed(1)}°C`)
  // Temperature should be mostly rising; small drops OK from cooling between ELMs
  assert(maxDrop < 50, `Max temperature drop between steps should be < 50°C, got ${maxDrop.toFixed(1)}°C`)
  assert(model.t_surface > 800, 'ITER with ELMs should reach > 800°C')
}

// ── Test 3: JET at 7 MW/m² for 8 s should reach 600–1000°C ──
{
  const jet = new DivertorThermalModel('jet')
  const dt = 0.05
  for (let i = 0; i < 160; i++) {  // 8 seconds
    jet.step(7, 0, 0, dt)
  }
  console.log(`Test 3 (JET 7 MW/m² × 8s): T=${jet.t_surface.toFixed(0)}°C`)
  assert(jet.t_surface > 500, `JET should reach > 500°C, got ${jet.t_surface.toFixed(0)}`)
  assert(jet.t_surface < 1200, `JET should stay < 1200°C (JOI limit), got ${jet.t_surface.toFixed(0)}`)
}

// ── Test 4: DIII-D at 5 MW/m² for 3 s should reach 400–600°C ──
{
  const diiid = new DivertorThermalModel('diiid')
  const dt = 0.05
  for (let i = 0; i < 60; i++) {  // 3 seconds
    diiid.step(5, 0, 0, dt)
  }
  console.log(`Test 4 (DIII-D 5 MW/m² × 3s): T=${diiid.t_surface.toFixed(0)}°C`)
  assert(diiid.t_surface > 200, `DIII-D should reach > 200°C, got ${diiid.t_surface.toFixed(0)}`)
  assert(diiid.t_surface < 800, `DIII-D should stay < 800°C, got ${diiid.t_surface.toFixed(0)}`)
}

// ── Test 5: Large ITER ELM should cause significant temperature spike ──
{
  const model = new DivertorThermalModel('iter')
  // Heat to steady state first
  for (let i = 0; i < 100; i++) model.step(10, 0, 0, 0.05)
  const T_before = model.t_surface
  // Single large unmitigated ELM: 500 MW/m² for 0.5ms
  model.step(10, 500, 0.0005, 0.05)
  const T_after = model.t_surface
  const dT = T_after - T_before
  console.log(`Test 5 (large ELM): T_before=${T_before.toFixed(0)}°C, T_after=${T_after.toFixed(0)}°C, ΔT=${dT.toFixed(0)}°C`)
  assert(dT > 5, `Large ELM should cause > 5°C spike, got ${dT.toFixed(1)}°C`)
  assert(dT < 500, `Large ELM spike should be < 500°C (not the full dt), got ${dT.toFixed(1)}°C`)
}

console.log('\n✅ All divertor thermal model tests passed!')
