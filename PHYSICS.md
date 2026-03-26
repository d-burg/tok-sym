# fusionsimulator.io — Physics Model Documentation

This document describes the physics models, assumptions, and known limitations
of the fusionsimulator.io tokamak simulator.

---

## 1. Transport Model

### 1.1 Energy Confinement (IPB98(y,2))

The global energy confinement time uses the ITER Physics Basis 1998 H-mode
scaling (IPB98(y,2)):

    tau_E = 0.0562 * Ip^0.93 * Bt^0.15 * ne19^0.41 * P^(-0.69)
            * R0^1.97 * eps^0.58 * kappa^0.78 * M^0.19

where Ip is in MA, Bt in T, ne19 in 10^19 m^-3, P in MW, R0 in m,
eps = a/R0, kappa is elongation, and M is the average ion mass in AMU.

**References:**
- ITER Physics Basis, Chapter 2: Nucl. Fusion 39 (1999) 2175

### 1.2 Confinement Mode Multipliers

| Mode | H-factor | Notes |
|------|----------|-------|
| L-mode | 0.5 | IPB98 is calibrated to H-mode; L-mode is ~0.5x |
| H-mode | 1.0 | Standard Type I ELMy H-mode |
| NT-edge (CENTAUR) | ~0.82 | Between L-mode and H-mode; ELM-free |

### 1.3 D-T Isotope Enhancement

D-T plasmas receive a 1.35x confinement enhancement beyond the IPB98 M^0.19
scaling, representing the improved core confinement observed experimentally
in JET DTE2 and TFTR D-T campaigns. This is attributed to alpha heating
profile peaking and reduced turbulent transport.

**References:**
- Cordey et al., Nucl. Fusion 39 (1999) 301
- Maggi et al., Plasma Phys. Control. Fusion 60 (2018) 014045

### 1.4 Negative Triangularity Enhancement

For negative-triangularity devices (CENTAUR), a 1.05x confinement boost is
applied on top of the base H-factor. This represents the improved core
confinement observed in NT plasmas due to modified turbulence characteristics.

**References:**
- Marinoni et al., Nucl. Fusion 61 (2021) 116010
- Austin et al., Phys. Rev. Lett. 122 (2019) 115001

---

## 2. Fusion Power

### 2.1 Reactivity

The D-T and D-D fusion reactivities use the Bosch-Hale parameterization,
which is accurate to within 1% over the range 0.2-100 keV.

**D-T reaction:** D + T -> He-4 (3.52 MeV) + n (14.07 MeV)
**D-D reactions:** Two branches with roughly equal probability, producing
~3.65 MeV per reaction on average.

The effective ion temperature for the volume-averaged reactivity is estimated
as Ti_eff = 0.65 * Te0, accounting for profile peaking and the Ti/Te ratio.

**References:**
- Bosch and Hale, Nucl. Fusion 32 (1992) 611

### 2.2 Profile Correction Factor

The 0D fusion power uses a profile peaking correction f_profile = 0.45,
representing the ratio of the volume-averaged <n^2 * sigma_v(T)> to the
product of volume-averaged quantities n_bar^2 * sigma_v(T_bar). This factor
accounts for the fact that both density and temperature peak on axis.

### 2.3 Q_plasma

    Q_plasma = P_fusion / P_external

where P_external = P_input - P_alpha (i.e., the externally supplied heating
power excluding self-heating from alpha particles).

---

## 3. ELM Model

### 3.1 ELM Types

| Type | Frequency | Energy Loss | Character |
|------|-----------|-------------|-----------|
| Type I | 5-25 Hz (DIII-D scale) | 5-13% W_th | Large, distinct crashes |
| Type II | 80-200 Hz (DIII-D scale) | 0.5-1.5% W_th | Small "grassy" ELMs |
| Suppressed (QCE) | N/A | Continuous small losses | No discrete ELMs |

ELM frequency scales inversely with energy confinement time (tau_E) to
account for machine size: larger machines with longer tau_E have lower ELM
frequency because the pedestal pressure gradient rebuilds more slowly.

### 3.2 ELM Heat Flux to Divertor

The ELM energy to the divertor is calculated from the Loarte scaling:

    Delta_W_ELM = elm_fraction * W_th  (5-13% for Type I)

The resulting transient heat flux spike is:

    q_ELM = Delta_W_ELM / (A_wet * tau_ELM)

where tau_ELM ~ 0.5-1.0 ms is the ELM crash duration and A_wet is the
divertor wetted area (including flux expansion).

**References:**
- Loarte et al., Plasma Phys. Control. Fusion 45 (2003) 1549
- Eich et al., Nucl. Mater. Energy 12 (2017) 84

---

## 4. Divertor Heat Flux

### 4.1 Scrape-Off Layer Width (Eich Scaling)

The SOL power decay length uses the Eich multi-machine scaling:

    lambda_q = 1.35 / B_pol^0.9  (mm)

with a minimum of 0.5 mm. For negative-triangularity configurations, lambda_q
is broadened by a factor of 1.0-2.0 depending on the triangularity magnitude.

**References:**
- Eich et al., Nucl. Fusion 53 (2013) 093031

### 4.2 Detachment Model

A simplified sigmoid model for divertor detachment:

    f_detach = min(1 - 1/(1 + (f_GW/0.7)^6), 0.97)

Higher Greenwald fraction drives stronger divertor radiation and detachment,
reducing the target heat flux. Maximum detachment reduces heat flux by 97%.

---

## 5. Divertor Thermal Model

### 5.1 Approach

The divertor surface temperature is computed using a **0D lumped thermal
capacitance model**:

    C_th * dT/dt = q_total - h_cool * (T - T_coolant)

where:
- C_th = rho * cp * L is the thermal capacitance per unit area (J/m^2/K)
- q_total is the total heat flux including inter-ELM and ELM contributions
- h_cool is the effective heat transfer coefficient to the coolant
- T_coolant is the coolant temperature

### 5.2 Device-Specific Parameters

| Parameter | DIII-D | JET | ITER | CENTAUR |
|-----------|--------|-----|------|---------|
| Wall material | Carbon (C) | Tungsten (W) | Tungsten (W) | Tungsten (W) |
| Armor thickness (mm) | 25 | 22 | 6 | 6 |
| Density (kg/m^3) | 1800 | 19350 | 19350 | 19350 |
| Specific heat (J/kg/K) | 1200 | 150 | 150 | 150 |
| T_coolant (C) | 25 | 200 | 100 | 80 |
| h_cool (W/m^2/K) | 0 | 0 | 8500 | 15000 |
| Cooling type | Inertial | Inertial | Active water | Active water |

### 5.3 Target Steady-State Temperatures

| Device | Condition | Model Prediction | Published/Expected Range |
|--------|-----------|-----------------|-------------------------|
| DIII-D | 5 MW/m^2, 3 s pulse | ~300 C | 200-600 C |
| JET | 7 MW/m^2, 8 s pulse | ~1000 C | 600-1200 C (JOI limit) |
| ITER | 10 MW/m^2, steady-state | ~1300 C | 1200-1500 C (design basis) |

### 5.4 Known Limitations

**Single-layer approximation:** The model treats the divertor armor as a
single thermal lump with uniform temperature. In reality, ELM energy deposits
in a very thin surface skin (~0.1 mm thermal diffusion depth at tau_ELM ~ 1 ms).
This means:

- **ELM temperature spikes are underestimated**: The real surface temperature
  during an unmitigated Type I ELM on ITER can transiently exceed tungsten's
  melting point (3422 C), but our model spreads the energy across the full
  6 mm armor thickness, producing a modest ~100-200 C rise.

- **ELM temperature recovery is too slow**: The real surface cools back to
  near-steady-state within ~10-100 ms as heat diffuses into the cooler bulk.
  Our lumped model shows recovery over seconds because the full thermal mass
  must equilibrate.

- **Qualitative behavior is correct**: The model correctly shows that (1) ITER
  DT H-mode with unmitigated Type I ELMs produces dangerously high divertor
  temperatures, (2) actively cooled devices equilibrate while inertially cooled
  devices heat monotonically, and (3) the inter-ELM steady-state temperatures
  match published design values.

A two-layer model (thin surface skin + bulk substrate) would capture the
fast transient dynamics more accurately but is not currently implemented.

**References:**
- Pitts et al., J. Nucl. Mater. 415 (2011) S957 (ITER divertor design)
- Hirai et al., Fusion Eng. Des. 127 (2018) 66 (ITER W monoblock qualification)
- Matthews et al., J. Nucl. Mater. 438 (2013) S2 (JET ILW divertor performance)

---

## 6. Equilibrium and MHD

### 6.1 Flux Surface Geometry

The equilibrium flux surfaces are computed from a parameterized
Grad-Shafranov-like model using the Miller parameterization (R, Z, kappa,
delta_upper, delta_lower). The poloidal flux function psi is constructed
analytically with Shafranov shift and shaping corrections.

### 6.2 Safety Factor

    q95 = 5 * a^2 * Bt * kappa_eff / (R0 * Ip)

where kappa_eff includes corrections for elongation and triangularity.

### 6.3 Normalized Beta

    beta_N = beta_t * a * Bt / Ip  (in percent-meters-Tesla/MA)

The Troyon stability limit is approximately beta_N ~ 2.8 for standard
H-mode and up to ~3.5 for advanced scenarios.

### 6.4 Internal Inductance

    li = <B_pol^2> / B_pol(a)^2

Evolves based on current profile shape, with the L-H transition causing
a characteristic broadening of the current profile (decreasing li).

---

## 7. Disruption Model

Disruptions are triggered when operational limits are violated:

- **Density limit (Greenwald):** f_GW > 1.0
- **Beta limit (Troyon):** beta_N > beta_N_max
- **Safety factor limit:** q95 < 2.0
- **Locked modes:** Large locked mode amplitude

The disruption probability increases as multiple limits are approached
simultaneously. A thermal quench (rapid loss of stored energy) is followed
by a current quench (rapid loss of plasma current).

---

## 8. Diagnostic Noise Model

All simulated diagnostic signals include realistic measurement noise:

| Signal | Noise Level | Basis |
|--------|-------------|-------|
| Ip | 0.2% | Rogowski coil precision |
| ne_bar | 1% | Interferometer noise |
| Te0 | 2% | ECE radiometer |
| W_th | 0.5% | Diamagnetic loop |
| P_rad | 5% | Bolometer uncertainties |

D-alpha signals include ELM spikes (8x baseline for Type I, 2.5x for Type II)
with appropriate noise to reproduce the irregular appearance of real signals.
