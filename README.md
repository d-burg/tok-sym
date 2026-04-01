# fusionsimulator.io

A real-time tokamak plasma simulator that runs entirely in your browser.
fusionsimulator.io combines a Rust physics engine (compiled to WebAssembly) with a
React/TypeScript frontend to provide an interactive control room experience
for exploring tokamak plasma behavior.

## Features

- **Four tokamak devices:** DIII-D, JET, ITER, and CENTAUR (conceptual
  negative-triangularity) with device-specific geometry, heating systems,
  and engineering limits
- **Three discharge presets per device:** H-mode, L-mode, and Density Limit
  scenarios with realistic waveform programming
- **Real-time physics:** 0D power balance transport, analytic Grad-Shafranov
  equilibrium, tanh-pedestal profiles, ELM dynamics, and disruption modeling
- **Interactive control room:** 2D equilibrium cross-section, 19-channel time
  trace viewer, plasma parameter dashboard, and 3D tokamak port view
- **Shot Planner:** Edit discharge parameters (Ip, heating power, density,
  shaping) and run custom scenarios
- **Fusion diagnostics:** Computed fusion power/Q, neutron rate, divertor heat
  flux with surface temperature modeling
- **Post-discharge analysis:** Time scrubbing, radial profile viewer with
  synthetic Thomson scattering

## Physics Models

The simulator implements peer-reviewed physics models from the fusion literature:

| Model | Reference |
|-------|-----------|
| MHD equilibrium | Cerfon-Freidberg analytic Grad-Shafranov (PoP 2010) |
| Energy confinement | IPB98(y,2) scaling (ITER Physics Basis, NF 1999) |
| L-H transition | Martin power threshold scaling (JPCS 2008) |
| Beta limit | Troyon normalized beta limit (PPCF 1984) |
| Density limit | Greenwald limit (PPCF 2002) |
| Fusion reactivity | Bosch-Hale parameterization (NF 1992) |
| Divertor heat flux | Eich SOL width scaling (NF 2013) |
| Radial profiles | OMFIT tanh-pedestal parameterization |

For complete citations and equations, see the in-app Bibliography page.

> **Disclaimer:** fusionsimulator.io uses 0D scaling laws and analytic approximations.
> It is an educational and visualization tool, not a predictive transport code.

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) (`cargo install wasm-pack`)
- [Node.js](https://nodejs.org/) 18+ with npm

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd fusion-sim

# Full build (WASM engine + frontend)
./build.sh

# Serve the built app
cd web && npx vite preview
```

### Development

```bash
# Build WASM module
wasm-pack build crates/tok-sym-core \
  --target web \
  --out-dir ../../web/src/wasm \
  --features wasm \
  -- --no-default-features

# Start frontend dev server (with hot reload)
cd web
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` by default.

### Running Tests

```bash
# Rust physics engine tests
cargo test -p tok-sym-core

# TypeScript type checking
cd web && npx tsc -b

# Lint
cd web && npm run lint
```

### Generating Rust API Docs

```bash
cargo doc -p tok-sym-core --no-deps --open
```

This opens the auto-generated API documentation for the physics engine in
your browser. All public types and functions are documented with rustdoc
comments.

## Project Structure

```
fusion-sim/
├── crates/tok-sym-core/   Rust physics engine (~5,500 lines)
│   └── src/
│       ├── equilibrium.rs   Cerfon-Freidberg Grad-Shafranov solver
│       ├── transport.rs     0D power balance (IPB98, L-H, ELMs)
│       ├── profiles.rs      Tanh-pedestal radial profiles
│       ├── devices.rs       DIII-D, JET, ITER, CENTAUR definitions
│       ├── disruption.rs    Disruption risk & dynamics
│       ├── diagnostics.rs   Synthetic diagnostic signals
│       ├── contour.rs       Marching squares contour extraction
│       ├── simulation.rs    Top-level orchestrator
│       └── wasm_api.rs      WASM-bindgen API surface
│
├── web/                   React frontend (~11,600 lines)
│   └── src/
│       ├── lib/             Shared libraries (WASM init, hooks, physics)
│       ├── components/      UI components (canvas, panels, 3D view)
│       ├── pages/           Route pages (DeviceSelect, ControlRoom, etc.)
│       └── wasm/            Generated WASM output
│
├── build.sh               Full build script
└── ARCHITECTURE.md        Comprehensive architecture guide
```

For detailed documentation of every module, function, and component, see
[ARCHITECTURE.md](ARCHITECTURE.md).

## Tech Stack

- **Physics engine:** Rust, compiled to WebAssembly via wasm-pack
- **Frontend:** React 19, TypeScript 5.9, Vite 7.3
- **Styling:** Tailwind CSS 4.2
- **3D rendering:** Three.js with custom GLSL shaders
- **2D rendering:** HTML Canvas API
- **Routing:** React Router v7

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Browser                         │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │  Rust/WASM   │───▶│  React/TypeScript      │  │
│  │  Physics     │JSON│                        │  │
│  │  Engine      │◀───│  useSimulation hook    │  │
│  │              │    │    │                    │  │
│  │ • Equilibrium│    │    ├─ EquilibriumCanvas │  │
│  │ • Transport  │    │    ├─ StatusPanel       │  │
│  │ • Profiles   │    │    ├─ UnifiedTracePanel │  │
│  │ • Disruption │    │    ├─ PortView (3D)     │  │
│  │ • Contours   │    │    └─ ShotPlanner       │  │
│  └──────────────┘    └────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

All physics runs in the WASM module. The TypeScript layer handles rendering,
user interaction, and some display-only derived computations (fusion Q,
divertor heat flux via Bosch-Hale and Eich scaling).

## License

MIT License. See [LICENSE](LICENSE) for details.

## Attribution

Developed by Daniel Burgess and the Columbia Fusion Research Center.

Copyright 2026 Daniel Burgess. All rights reserved.
