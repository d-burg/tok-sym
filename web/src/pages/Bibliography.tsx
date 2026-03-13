import { Link } from 'react-router-dom'

/* ─────────────────────────────────────────────
 * Bibliography & Physics Reference
 *
 * Comprehensive list of every equation, scaling law,
 * approximation, and formalism used in the simulator.
 * ───────────────────────────────────────────── */

interface Ref {
  id: string
  authors: string
  title: string
  journal: string
  year: number
  doi?: string
}

const REFERENCES: Ref[] = [
  {
    id: 'cerfon2010',
    authors: 'A. J. Cerfon and J. P. Freidberg',
    title: '"One size fits all" analytic solutions to the Grad-Shafranov equation',
    journal: 'Phys. Plasmas 17, 032502',
    year: 2010,
    doi: '10.1063/1.3328818',
  },
  {
    id: 'iter1999',
    authors: 'ITER Physics Basis Editors et al.',
    title: 'Chapter 2: Plasma confinement and transport',
    journal: 'Nucl. Fusion 39, 2175',
    year: 1999,
    doi: '10.1088/0029-5515/39/12/301',
  },
  {
    id: 'bosch1992',
    authors: 'H.-S. Bosch and G. M. Hale',
    title: 'Improved formulas for fusion cross-sections and thermal reactivities',
    journal: 'Nucl. Fusion 32, 611',
    year: 1992,
    doi: '10.1088/0029-5515/32/4/I07',
  },
  {
    id: 'troyon1984',
    authors: 'F. Troyon, R. Gruber, H. Saurenmann, S. Semenzato, and S. Succi',
    title: 'MHD limits to plasma confinement',
    journal: 'Plasma Phys. Control. Fusion 26, 209',
    year: 1984,
    doi: '10.1088/0741-3335/26/1A/319',
  },
  {
    id: 'greenwald2002',
    authors: 'M. Greenwald',
    title: 'Density limits in toroidal plasmas',
    journal: 'Plasma Phys. Control. Fusion 44, R27',
    year: 2002,
    doi: '10.1088/0741-3335/44/8/201',
  },
  {
    id: 'eich2013',
    authors: 'T. Eich et al.',
    title: 'Scaling of the tokamak near the scrape-off layer H-mode power width and implications for ITER',
    journal: 'Nucl. Fusion 53, 093031',
    year: 2013,
    doi: '10.1088/0029-5515/53/9/093031',
  },
  {
    id: 'martin2008',
    authors: 'Y. R. Martin, T. Takizuka, and the ITPA CDBM H-mode Threshold Database Working Group',
    title: 'Power requirement for accessing the H-mode in ITER',
    journal: 'J. Phys.: Conf. Ser. 123, 012033',
    year: 2008,
    doi: '10.1088/1742-6596/123/1/012033',
  },
  {
    id: 'wagner1982',
    authors: 'F. Wagner et al.',
    title: 'Regime of improved confinement and high beta in neutral-beam-heated divertor discharges of the ASDEX tokamak',
    journal: 'Phys. Rev. Lett. 49, 1408',
    year: 1982,
    doi: '10.1103/PhysRevLett.49.1408',
  },
  {
    id: 'pitts2017',
    authors: 'R. A. Pitts et al.',
    title: 'Physics conclusions in support of ITER W divertor monoblock shaping',
    journal: 'Nucl. Mater. Energy 12, 60',
    year: 2017,
    doi: '10.1016/j.nme.2017.03.005',
  },
  {
    id: 'wesson2011',
    authors: 'J. Wesson',
    title: 'Tokamaks',
    journal: '4th edition, Oxford University Press',
    year: 2011,
  },
  {
    id: 'freidberg2014',
    authors: 'J. P. Freidberg',
    title: 'Ideal MHD',
    journal: 'Cambridge University Press',
    year: 2014,
  },
  {
    id: 'spitzer1953',
    authors: 'L. Spitzer and R. Harm',
    title: 'Transport phenomena in a completely ionized gas',
    journal: 'Phys. Rev. 89, 977',
    year: 1953,
    doi: '10.1103/PhysRev.89.977',
  },
]

function RefTag({ id }: { id: string }) {
  return (
    <a
      href={`#ref-${id}`}
      className="text-cyan-400 hover:text-cyan-300 text-[10px] align-super ml-0.5 no-underline"
    >
      [{REFERENCES.findIndex((r) => r.id === id) + 1}]
    </a>
  )
}

/* ── Section wrapper ── */
function Section({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-white mb-3 flex items-baseline gap-2">
        <span className="text-cyan-500 font-mono text-sm">{number}.</span>
        {title}
      </h2>
      <div className="text-gray-300 text-sm leading-relaxed space-y-3 pl-1">{children}</div>
    </section>
  )
}

/* ── Equation block ── */
function Eq({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 px-4 py-2.5 bg-gray-900/80 border border-gray-700/50 rounded font-mono text-sm text-cyan-200 overflow-x-auto">
      {children}
    </div>
  )
}

export default function Bibliography() {
  return (
    <div className="min-h-screen bg-black text-gray-200">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1.5"
        >
          ← Back to Simulator
        </Link>
        <span className="text-gray-600 text-xs font-mono">fusionsimulator.io</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Physics Bibliography</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Complete reference of every equation, scaling law, approximation, and formalism
            implemented in the simulator. This page is intended as a companion for students
            and researchers who want to understand the physics behind each panel.
          </p>
          <div className="mt-4 px-4 py-3 bg-amber-900/20 border border-amber-700/30 rounded-lg text-amber-200/80 text-xs leading-relaxed">
            <strong className="text-amber-300">Note:</strong> This simulator uses a zero-dimensional (0D)
            global power-balance transport model with analytic equilibrium solutions. Results are
            approximate and intended for qualitative educational use. They should not be used for
            engineering design or quantitative predictions.
          </div>
        </div>

        {/* ─── 1. MHD Equilibrium ─── */}
        <Section number={1} title="MHD Equilibrium: Grad-Shafranov Equation">
          <p>
            The magnetic equilibrium is computed using the analytic Cerfon-Freidberg solution to the
            Grad-Shafranov (GS) equation under the Solov'ev ansatz (constant p' and FF').<RefTag id="cerfon2010" />
          </p>
          <p>
            The GS equation describes the balance between the plasma pressure gradient and the
            magnetic (Lorentz) force in an axisymmetric toroidal configuration. The Cerfon-Freidberg
            method decomposes the poloidal flux into a particular solution plus a linear combination
            of 12 homogeneous basis functions:
          </p>
          <Eq>
            {'ψ(x, y) = ψ_p(x, A) + Σ c_i · ψ_i(x, y),  i = 1..12'}
          </Eq>
          <p>The particular solution is:</p>
          <Eq>{'ψ_p(x, A) = x⁴/8 + A · (x² ln x / 2 − x⁴/8)'}</Eq>
          <p>
            where <em>x = R/R₀</em> is the normalized major radius and <em>A</em> is a free parameter
            related to the pressure/current profile. The 12 coefficients <em>c_i</em> are determined
            by imposing boundary conditions at the plasma boundary (e.g. lower single-null X-point
            geometry), yielding a 12 &times; 12 linear system solved by Gaussian elimination with partial
            pivoting.
          </p>
          <p>
            Curvature constraints at the outer equatorial, inner equatorial, and X-point/top boundary are:
          </p>
          <Eq>
            {'N₁ = −(1 + ε²κ²) / (ε κ²)  [outer midplane]'}<br />
            {'N₂ =  (1 − ε²κ²) / (ε κ²)  [inner midplane]'}<br />
            {'N₃ = −κ / (ε cos²α)          [X-point], α = arcsin(δ)'}
          </Eq>
          <p>
            Flux surface contours are extracted using the <strong>Marching Squares</strong> algorithm,
            and the magnetic axis is located via gradient ascent on ψ.
          </p>
        </Section>

        {/* ─── 2. Energy Confinement ─── */}
        <Section number={2} title="Energy Confinement: IPB98(y,2) Scaling">
          <p>
            The energy confinement time in H-mode is computed from the ITER Physics Basis
            IPB98(y,2) ELMy H-mode scaling law:<RefTag id="iter1999" />
          </p>
          <Eq>
            {'τ_E = 0.0562 · I_p^0.93 · B_t^0.15 · n̄_e19^0.41 · P^(−0.69) · R₀^1.97 · ε^0.58 · κ^0.78 · M^0.19'}
          </Eq>
          <p>
            where <em>I_p</em> is in MA, <em>B_t</em> in T, <em>n̄_e19</em> in 10¹⁹ m⁻³,
            <em> P</em> = total heating power in MW, <em>R₀</em> in m,
            <em> ε = a/R₀</em> (inverse aspect ratio), <em>κ</em> = elongation,
            and <em>M</em> = main ion mass in AMU. An H-factor multiplier is applied:
            τ<sub>E</sub> → H · τ<sub>E</sub>.
          </p>
          <p>
            This empirical scaling is a multi-machine regression fit to a database of tokamak
            experiments. The negative exponent on power reflects the degradation of confinement
            with increasing heating — a fundamental feature of turbulent plasma transport.
          </p>
        </Section>

        {/* ─── 3. L-H Transition ─── */}
        <Section number={3} title="L-H Transition Power Threshold">
          <p>
            The minimum power required to access H-mode is estimated from the Martin 2008 scaling:<RefTag id="martin2008" /><RefTag id="wagner1982" />
          </p>
          <Eq>
            {'P_LH = 0.0488 · n̄_e20^0.717 · B_t^0.803 · S^0.941  [MW]'}
          </Eq>
          <p>
            where <em>n̄_e20</em> is the line-averaged density in 10²⁰ m⁻³, <em>B_t</em> in T,
            and <em>S</em> is the plasma surface area in m². A device-specific correction
            factor is applied (DIII-D: 1.0, JET: 0.9, ITER: 0.35).
          </p>
        </Section>

        {/* ─── 4. Safety Factor ─── */}
        <Section number={4} title="Safety Factor q₉₅">
          <p>
            The edge safety factor at the 95% flux surface is estimated from the cylindrical
            approximation with a shape correction:<RefTag id="wesson2011" />
          </p>
          <Eq>
            {'f_shape = [1 + κ²(1 + 2δ² − 1.2δ³)] / 2'}<br />
            {'q₉₅ = 5 a² B_t f_shape / (R₀ I_p)'}
          </Eq>
          <p>
            where <em>a</em> in m, <em>B_t</em> in T, <em>R₀</em> in m, <em>I_p</em> in MA,
            <em> κ</em> = elongation, <em>δ</em> = triangularity. Values below q₉₅ ≈ 2
            indicate proximity to the external kink stability boundary.
          </p>
        </Section>

        {/* ─── 5. Greenwald Density Limit ─── */}
        <Section number={5} title="Greenwald Density Limit">
          <p>
            The empirical density limit is given by the Greenwald formula:<RefTag id="greenwald2002" />
          </p>
          <Eq>
            {'n_GW = I_p / (π a²)  [10²⁰ m⁻³, with I_p in MA, a in m]'}
          </Eq>
          <p>
            The Greenwald fraction <em>f_GW = n̄_e / n_GW</em> is a key operational parameter.
            Approaching f_GW &gt; 1 greatly increases disruption risk, while f_GW ≈ 0.7
            promotes divertor detachment, which is beneficial for heat exhaust.
          </p>
        </Section>

        {/* ─── 6. Troyon Beta Limit ─── */}
        <Section number={6} title="Troyon Beta Limit">
          <p>
            The normalized beta and the MHD stability boundary are given by the Troyon
            parameterization:<RefTag id="troyon1984" />
          </p>
          <Eq>
            {'β_t = ⟨p⟩ / (B² / 2μ₀) × 100  [%]'}<br />
            {'β_N = β_t · a B_t / I_p'}
          </Eq>
          <p>
            The no-wall ideal MHD stability limit is at β_N ≈ 2.8 (the Troyon limit).
            Exceeding this value risks triggering a disruption through resistive wall modes
            or other MHD instabilities. The simulator enforces a hard clamp at β_N = 4.0.
          </p>
          <p>
            The volume-averaged pressure is computed as <em>{'⟨p⟩ = 2 n_e T_e × 1.602 × 10⁴'}</em> Pa,
            assuming a single-fluid model with T<sub>i</sub> = T<sub>e</sub>.
          </p>
        </Section>

        {/* ─── 7. Spitzer Resistivity ─── */}
        <Section number={7} title="Spitzer Resistivity and Ohmic Heating">
          <p>
            Plasma resistivity is computed from the classical Spitzer formula:<RefTag id="spitzer1953" /><RefTag id="wesson2011" />
          </p>
          <Eq>
            {'η = 2.8 × 10⁻⁸ · Z_eff / T_e^(3/2)  [Ω·m]'}<br />
            {'R_plasma = η · 2πR₀ / (πa²κ)  [Ω]'}<br />
            {'P_ohmic = R_plasma · I_p²  [MW]'}
          </Eq>
          <p>
            This gives the resistive power dissipated in the plasma by the driven toroidal current,
            where <em>Z_eff</em> is the effective charge state including impurities and T<sub>e</sub> is
            in keV.
          </p>
        </Section>

        {/* ─── 8. Radiation ─── */}
        <Section number={8} title="Radiation Losses">
          <p>
            Three radiation channels are modeled:<RefTag id="wesson2011" />
          </p>
          <p><strong>Bremsstrahlung</strong> (electron-ion free-free radiation):</p>
          <Eq>
            {'P_brem = 5.35 × 10⁻³⁷ · n_e² · Z_eff · T_e^(1/2) · V  [MW]'}
          </Eq>
          <p><strong>Line radiation</strong> (simplified impurity model):</p>
          <Eq>
            {'P_line = P_brem × 0.3 × max(Z_eff − 1, 0)'}
          </Eq>
          <p><strong>Impurity radiation</strong> (effective radiative loss coefficient):</p>
          <Eq>
            {'L_z = 3 × 10⁻³¹ · Z_eff^(3/2)  [W·m³]'}<br />
            {'P_imp = n_e² · L_z · V  [MW]'}
          </Eq>
          <p>
            Total radiated power: P<sub>rad</sub> = P<sub>brem</sub> + P<sub>line</sub> + P<sub>imp</sub>.
            Radiation fractions above ~80% of total input power pose a risk of radiative collapse and disruption.
          </p>
        </Section>

        {/* ─── 9. Power Balance ─── */}
        <Section number={9} title="0D Power Balance Transport Model">
          <p>
            The core of the simulator is a global (0D) power balance equation for the
            stored thermal energy:
          </p>
          <Eq>
            {'dW_th/dt = P_input − W_th/τ_E − P_rad'}
          </Eq>
          <p>
            where <em>P_input = P_ohmic + P_aux</em> (auxiliary heating from NBI, ECRH, ICRH),
            <em> W_th/τ_E</em> is the transport loss, and <em>P_rad</em> is the total radiated power.
            This ODE is integrated in time using a forward Euler step.
          </p>
          <p>The stored energy is related to the average temperature by:</p>
          <Eq>
            {'W_th = 3 · n_e · T_e · V · 1.602 × 10⁻²  [MJ]'}
          </Eq>
          <p>
            This assumes a single-fluid model (T<sub>i</sub> = T<sub>e</sub>) where
            <em> W = (3/2)(n_e T_e + n_i T_i) V ≈ 3 n_e T_e V</em>, with the factor of 3
            coming from equal ion and electron contributions.
          </p>
        </Section>

        {/* ─── 10. Fusion Reactivity ─── */}
        <Section number={10} title="Fusion Reactivity (Bosch-Hale)">
          <p>
            Thermonuclear fusion reactivities for D-T and D-D reactions use the Bosch-Hale
            parameterization:<RefTag id="bosch1992" />
          </p>
          <Eq>
            {'θ = T / (1 − T(C₂ + T(C₄ + TC₆)) / (1 + T(C₃ + T(C₅ + TC₇))))'}<br />
            {'ξ = (B_G² / 4θ)^(1/3)'}<br />
            {'⟨σv⟩ = C₁ · θ · √(ξ / (m_rc² T³)) · exp(−3ξ)  [cm³/s]'}
          </Eq>
          <p>
            with <em>B_G</em> = 34.3827 (the Gamow constant for D-T) and the C-coefficients from
            Bosch-Hale Table IV. D-T reaction products: 14.07 MeV neutron + 3.52 MeV alpha particle
            (17.59 MeV total). D-D reactions are modeled as the sum of the D(d,n)He-3 and D(d,p)T branches.
          </p>
        </Section>

        {/* ─── 11. Fusion Power ─── */}
        <Section number={11} title="Fusion Power and Q">
          <p>Fusion power is computed by volume integration over the plasma:</p>
          <Eq>
            {'P_fus = ∫ (n_e² / 4) · ⟨σv⟩(T(ρ)) · E_fus · dV'}
          </Eq>
          <p>
            using cylindrical shells with dV = 2πR₀ · 2πa²κ · ρ dρ and temperature/density
            radial profiles (see Sections 15-16). The fusion gain factor is:
          </p>
          <Eq>{'Q_plasma = P_fusion / P_heating'}</Eq>
          <p>
            where P<sub>heating</sub> = P<sub>ohmic</sub> + P<sub>aux</sub>. A burning plasma
            regime is Q &gt; 5, and ignition corresponds to Q → ∞ (self-sustaining).
          </p>
        </Section>

        {/* ─── 12. SOL & Divertor ─── */}
        <Section number={12} title="Scrape-Off Layer and Divertor Heat Flux">
          <p>
            The SOL power decay width uses the Eich scaling:<RefTag id="eich2013" />
          </p>
          <Eq>
            {'B_pol = μ₀ I_p / (2π a √κ)  [T]'}<br />
            {'λ_q = max(1.35 × 10⁻³ / B_pol^0.9, 0.5 mm)  [m]'}
          </Eq>
          <p>
            The divertor target heat flux is:<RefTag id="pitts2017" />
          </p>
          <Eq>
            {'A_wet = 2π(R₀ − a) · λ_q · 4 · f_x  [m²]'}<br />
            {'q_div = P_SOL / A_wet  [MW/m²]'}
          </Eq>
          <p>
            where <em>f_x</em> is the poloidal flux expansion factor (~5-10 in typical divertors).
            P<sub>SOL</sub> = P<sub>input</sub> + P<sub>alpha</sub> − P<sub>rad</sub> is the power
            crossing the separatrix.
          </p>
        </Section>

        {/* ─── 13. Detachment ─── */}
        <Section number={13} title="Divertor Detachment Model">
          <p>
            The divertor detachment fraction is modeled as a sigmoid function of the
            Greenwald fraction:
          </p>
          <Eq>
            {'f_detach = min(1 − 1/(1 + (f_GW / 0.7)⁶), 0.97)'}
          </Eq>
          <p>
            Detachment is a regime where the divertor plasma cools and recombines before reaching
            the target plates, dramatically reducing the heat flux. It typically occurs at high
            Greenwald fraction due to increased edge radiation and volumetric power dissipation.
          </p>
        </Section>

        {/* ─── 14. Divertor Surface Temperature ─── */}
        <Section number={14} title="Divertor Surface Temperature (1D Thermal Model)">
          <p>
            The divertor surface temperature is computed from a 1D steady-state heat conduction
            model through the tungsten armor:
          </p>
          <Eq>
            {'T_surface = T_coolant + q_surface · (t_armor / k_W + 1 / h_coolant)'}
          </Eq>
          <p>
            where <em>k_W</em> ≈ 130 W/m/K is the tungsten thermal conductivity (temperature-dependent),
            <em> t_armor</em> is the armor thickness, and <em>h_coolant</em> is the coolant heat transfer
            coefficient. Recrystallization of tungsten occurs above ~1200°C, which degrades its
            mechanical integrity — a key constraint on divertor lifetime.
          </p>
        </Section>

        {/* ─── 15. Profiles: H-mode ─── */}
        <Section number={15} title="Radial Profiles: H-Mode Pedestal (OMFIT/Tanh)">
          <p>
            Temperature and density profiles in H-mode use the standard modified hyperbolic
            tangent (mtanh) pedestal parameterization:
          </p>
          <Eq>
            {'f(ρ) = h_ped · [tanh((ρ_ped − ρ)/w) + 1] / 2 + f_peak · (1 − (ρ/ρ_ped)^α_in)^α_out'}
          </Eq>
          <p>
            where <em>h_ped</em> is the pedestal height, <em>ρ_ped</em> is the pedestal location,
            <em> w</em> is the pedestal width, and the second term represents core peaking.
            This is the same form used in the OMFIT and EFIT profile fitting frameworks.
          </p>
        </Section>

        {/* ─── 16. Profiles: L-mode ─── */}
        <Section number={16} title="Radial Profiles: L-Mode (Parabolic)">
          <p>In L-mode, simpler parabolic profiles are used:</p>
          <Eq>
            {'T_e(ρ) = T_edge + (T_core − T_edge) · (1 − ρ²)^α_T'}<br />
            {'n_e(ρ) = n_edge + (n_core − n_edge) · (1 − ρ²)^α_n'}
          </Eq>
          <p>
            where <em>α_T</em> and <em>α_n</em> are peaking exponents (typically 1.5-2.5).
            These profiles lack the sharp edge pedestal characteristic of H-mode.
          </p>
        </Section>

        {/* ─── 17. Internal Inductance ─── */}
        <Section number={17} title="Internal Inductance">
          <p>
            The internal inductance l<sub>i</sub> is computed from the current density profile,
            assuming Spitzer conductivity (j ∝ T<sub>e</sub><sup>3/2</sup>):
          </p>
          <Eq>
            {'l_i = ⟨B_pol²⟩ / B_pol(a)²'}
          </Eq>
          <p>
            where the numerator is the volume-averaged poloidal field squared and the denominator
            is the poloidal field at the plasma edge. l<sub>i</sub> characterizes the peakedness
            of the current profile — a higher l<sub>i</sub> indicates a more peaked current
            distribution.
          </p>
        </Section>

        {/* ─── 18. Density Evolution ─── */}
        <Section number={18} title="Density Evolution">
          <p>
            The line-averaged density relaxes toward a target with a particle confinement time:
          </p>
          <Eq>
            {'τ_p ≈ 5 τ_E'}<br />
            {'dn̄_e/dt = (n_target − n̄_e) / τ_p'}
          </Eq>
          <p>
            This simplified model captures the timescale separation between energy and particle
            confinement, with the particle confinement time typically ~5 times longer.
          </p>
        </Section>

        {/* ─── 19. ELMs ─── */}
        <Section number={19} title="Edge-Localized Modes (ELMs)">
          <p>
            Three ELM regimes are modeled depending on edge collisionality, shaping, and
            proximity to operational limits:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Type I ELMs:</strong> Large periodic crashes at 5-25 Hz, each ejecting 5-13% of stored energy</li>
            <li><strong>Type II (grassy) ELMs:</strong> Small frequent crashes at 80-200 Hz, each ejecting 0.5-1.5% of W<sub>th</sub></li>
            <li><strong>QCE (Quasi-Continuous Exhaust):</strong> Continuous enhanced transport, no discrete crashes</li>
          </ul>
          <p>
            Each ELM crash is modeled as a rapid pedestal collapse followed by profile recovery on a
            characteristic rebuilding timescale. Type I ELMs are the most damaging to divertor components
            due to their large transient heat pulses.
          </p>
        </Section>

        {/* ─── 20. Disruption Model ─── */}
        <Section number={20} title="Disruption Risk Model">
          <p>
            Disruption risk is computed from multiple operational limit proximities using
            sigmoid activation functions:
          </p>
          <Eq>
            {'σ(x, c, w) = 1 / (1 + exp(−(x − c) / w))'}
          </Eq>
          <p>Individual risk contributions:</p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs font-mono">
            <li>Greenwald: σ(f<sub>GW</sub>, 1.0, 0.08)</li>
            <li>Troyon: σ(β<sub>N</sub>/2.8, 0.85, 0.06)</li>
            <li>Kink: σ(2.2/q<sub>95</sub>, 0.90, 0.05)</li>
            <li>Radiation: σ(P<sub>rad</sub>/P<sub>total</sub>, 0.80, 0.08)</li>
          </ul>
          <p>Combined disruption probability per timestep (Poisson process):</p>
          <Eq>
            {'risk = 1 − (1−r_GW³)(1−r_β³)(1−r_q³)(1−r_rad³)(1−r_LM)'}<br />
            {'P(disruption in dt) = 1 − exp(−risk · dt)'}
          </Eq>
        </Section>

        {/* ─── 21. Disruption Sequence ─── */}
        <Section number={21} title="Disruption Sequence (4-Phase)">
          <p>When a disruption is triggered, it proceeds through four phases:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li><strong>Precursor</strong> (50-100 ms): Growing locked mode oscillation with exponential growth rate ~20 s⁻¹</li>
            <li><strong>Thermal Quench</strong> (1-2 ms): Exponential T<sub>e</sub> collapse to ~1% of pre-disruption value</li>
            <li><strong>Current Quench</strong> (5-50 ms): L/R decay with transient I<sub>p</sub> overshoot spike</li>
            <li><strong>Termination</strong>: Plasma current reaches zero, discharge ended</li>
          </ol>
        </Section>

        {/* ─── 22. Synthetic Diagnostics ─── */}
        <Section number={22} title="Synthetic Diagnostic Signals">
          <p>Simulated diagnostic signals include noise based on realistic measurement uncertainties:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li><strong>Soft X-ray:</strong> SXR ∝ n<sub>e</sub>² T<sub>e</sub><sup>0.5</sup></li>
            <li><strong>Neutron rate:</strong> Γ<sub>n</sub> ∝ n<sub>e</sub>² T<sub>i</sub>²</li>
            <li><strong>Loop voltage:</strong> V<sub>loop</sub> ∝ I<sub>p</sub> / T<sub>e</sub><sup>3/2</sup></li>
          </ul>
          <p>
            Gaussian noise is generated via the Box-Muller transform. Typical diagnostic noise
            levels: I<sub>p</sub> 0.2%, n<sub>e</sub> 1%, T<sub>e</sub> 2%, P<sub>rad</sub> 5%.
          </p>
        </Section>

        {/* ─── 23. Geometry ─── */}
        <Section number={23} title="Device Geometry">
          <p>
            Plasma geometry is characterized by the following standard tokamak parameters:
          </p>
          <Eq>
            {'ε = a / R₀  [inverse aspect ratio]'}<br />
            {'S = 4π² R₀ a κ × f_corr  [plasma surface area, m²]'}<br />
            {'V = 2π² R₀ a² κ  [plasma volume, m³]'}
          </Eq>
          <p>
            Wall/limiter outlines for DIII-D, JET, and ITER are parameterized from published machine
            geometries and used for both the equilibrium cross-section display and the 3D port view
            rendering.
          </p>
        </Section>

        {/* ─── References ─── */}
        <section className="mt-16 pt-8 border-t border-gray-800">
          <h2 className="text-xl font-bold text-white mb-6">References</h2>
          <ol className="space-y-3">
            {REFERENCES.map((ref, i) => (
              <li
                key={ref.id}
                id={`ref-${ref.id}`}
                className="text-sm text-gray-400 leading-relaxed flex gap-3"
              >
                <span className="text-cyan-500 font-mono text-xs mt-0.5 shrink-0">[{i + 1}]</span>
                <div>
                  <span className="text-gray-300">{ref.authors}</span>,{' '}
                  <em>{ref.title}</em>,{' '}
                  {ref.journal} ({ref.year}).
                  {ref.doi && (
                    <>
                      {' '}
                      <a
                        href={`https://doi.org/${ref.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-500 hover:text-cyan-400 transition-colors"
                      >
                        doi:{ref.doi}
                      </a>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── Page footer ─── */}
        <footer className="mt-16 pt-6 border-t border-gray-800 text-center text-gray-600 text-xs space-y-1 pb-12">
          <p>&copy; 2026 Daniel Burgess and the Columbia Fusion Research Center</p>
          <p>
            <Link to="/" className="text-gray-500 hover:text-gray-300 transition-colors">
              fusionsimulator.io
            </Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
