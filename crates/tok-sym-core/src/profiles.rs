//! Parameterized plasma profiles for temperature and density.
//!
//! H-mode uses an OMFIT-derived tanh-pedestal parameterization (Hmode_profiles)
//! with smooth pedestal evolution. L-mode retains a simple parabolic model.

use serde::{Deserialize, Serialize};

/// Number of radial points in profile arrays (ρ = 0.00, 0.02, ..., 1.00).
pub const PROFILE_NPTS: usize = 51;

/// OMFIT-style tanh-pedestal profile parameters.
///
/// Parameterizes a profile shape with a steep tanh pedestal and independently
/// shaped core region, as used in OMFIT's `Hmode_profiles` module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileParams {
    /// Separatrix (edge) value
    pub edge: f64,
    /// Pedestal top value
    pub ped: f64,
    /// Core (axis) value
    pub core: f64,
    /// Core inner exponent (controls peaking shape)
    pub expin: f64,
    /// Core outer exponent (controls shoulder shape)
    pub expout: f64,
    /// Pedestal width in ρ
    pub widthp: f64,
    /// Pedestal half-height location in ρ
    pub xphalf: f64,
}

/// Plasma profile state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profiles {
    /// H-mode Te profile parameters (tanh-pedestal)
    pub te_params: ProfileParams,
    /// H-mode ne profile parameters (tanh-pedestal)
    pub ne_params: ProfileParams,
    /// Whether in H-mode (pedestal active)
    pub h_mode: bool,
    /// Previous timestep's h_mode flag, for detecting L↔H transitions
    prev_h_mode: bool,
    /// Pedestal electron temperature (keV) — derived from te_params for 0D coupling
    pub te_ped: f64,
    /// Pedestal electron density (10²⁰ m⁻³) — derived from ne_params for 0D coupling
    pub ne_ped: f64,
    /// L-mode temperature peaking exponent
    pub alpha_t: f64,
    /// L-mode density peaking exponent
    pub alpha_n: f64,
    /// Core Te for L-mode (keV)
    te0_lmode: f64,
    /// Core ne for L-mode (10²⁰ m⁻³)
    ne0_lmode: f64,
}

/// Evaluate tanh-pedestal profile at normalized radius ρ.
///
/// Direct port of OMFIT `Hmode_profiles` parameterization:
///   - tanh pedestal region centered at `xphalf` with half-width `widthp/2`
///   - core peaking above the tanh baseline via `(1 - (ρ/ρ_ped)^expin)^expout`
fn tanh_profile(rho: f64, p: &ProfileParams) -> f64 {
    let w_e1 = 0.5 * p.widthp;
    let xphalf = p.xphalf;
    let xped = xphalf - w_e1;

    // Normalization constant for the tanh
    let pconst = 1.0 - ((1.0 - xphalf) / w_e1).tanh();
    let a_t = 2.0 * (p.ped - p.edge) / (1.0 + 1.0_f64.tanh() - pconst);

    // Value of the tanh function at the axis (baseline for core peaking)
    let coretanh = 0.5 * a_t * (1.0 - (-xphalf / w_e1).tanh() - pconst) + p.edge;

    // Tanh pedestal shape
    let val = 0.5 * a_t * (1.0 - ((rho - xphalf) / w_e1).tanh() - pconst) + p.edge;

    // Core peaking above the tanh baseline
    let xtoped = rho / xped.max(0.01);
    if xtoped.powf(p.expin) < 1.0 {
        val + (p.core - coretanh) * (1.0 - xtoped.powf(p.expin)).powf(p.expout)
    } else {
        val
    }
}

/// Default DIII-D H-mode Te profile parameters.
fn default_te_params() -> ProfileParams {
    ProfileParams {
        edge: 0.07,
        ped: 0.83,
        core: 2.5,
        expin: 1.1,
        expout: 0.9,
        widthp: 0.048,
        xphalf: 0.975,
    }
}

/// Default DIII-D H-mode ne profile parameters (10²⁰ m⁻³).
fn default_ne_params() -> ProfileParams {
    ProfileParams {
        edge: 0.009,
        ped: 0.30,
        core: 0.55,
        expin: 1.0,
        expout: 1.5,
        widthp: 0.06,
        xphalf: 0.975,
    }
}

impl Default for Profiles {
    fn default() -> Self {
        let te = default_te_params();
        let ne = default_ne_params();
        Profiles {
            te_ped: te.ped,
            ne_ped: ne.ped,
            te_params: te,
            ne_params: ne,
            h_mode: false,
            prev_h_mode: false,
            alpha_t: 1.5,
            alpha_n: 1.0,
            te0_lmode: 2.0,
            ne0_lmode: 0.5,
        }
    }
}

impl Profiles {
    /// Electron temperature at normalized radius ρ (0=axis, 1=edge), in keV.
    pub fn te(&self, rho: f64) -> f64 {
        let rho = rho.clamp(0.0, 1.0);
        if self.h_mode {
            tanh_profile(rho, &self.te_params).max(0.01)
        } else {
            // L-mode: simple parabolic from te0 to edge
            let edge_te = 0.05;
            (edge_te + (self.te0_lmode - edge_te) * (1.0 - rho.powi(2)).powf(self.alpha_t))
                .max(0.01)
        }
    }

    /// Electron density at normalized radius ρ (10²⁰ m⁻³).
    pub fn ne(&self, rho: f64) -> f64 {
        let rho = rho.clamp(0.0, 1.0);
        if self.h_mode {
            tanh_profile(rho, &self.ne_params).max(0.001)
        } else {
            let edge_ne = 0.05;
            (edge_ne + (self.ne0_lmode - edge_ne) * (1.0 - rho.powi(2)).powf(self.alpha_n))
                .max(0.001)
        }
    }

    /// Te profile as a fixed-size array for snapshot serialization.
    pub fn te_profile_array(&self) -> Vec<f64> {
        (0..PROFILE_NPTS)
            .map(|i| {
                let rho = i as f64 / (PROFILE_NPTS - 1) as f64;
                self.te(rho)
            })
            .collect()
    }

    /// ne profile as a fixed-size array for snapshot serialization.
    pub fn ne_profile_array(&self) -> Vec<f64> {
        (0..PROFILE_NPTS)
            .map(|i| {
                let rho = i as f64 / (PROFILE_NPTS - 1) as f64;
                self.ne(rho)
            })
            .collect()
    }

    /// Line-averaged electron density (10²⁰ m⁻³).
    /// Simple numerical integration across the midplane.
    pub fn ne_line_avg(&self) -> f64 {
        let n = 50;
        let mut sum = 0.0;
        for i in 0..n {
            let rho = (i as f64 + 0.5) / n as f64;
            sum += self.ne(rho);
        }
        sum / n as f64
    }

    /// Volume-averaged electron temperature (keV).
    pub fn te_vol_avg(&self) -> f64 {
        let n = 50;
        let mut sum = 0.0;
        let mut vol = 0.0;
        for i in 0..n {
            let rho = (i as f64 + 0.5) / n as f64;
            let dv = 2.0 * rho;
            sum += self.te(rho) * dv;
            vol += dv;
        }
        sum / vol
    }

    /// Volume-averaged electron density (10²⁰ m⁻³).
    pub fn ne_vol_avg(&self) -> f64 {
        let n = 50;
        let mut sum = 0.0;
        let mut vol = 0.0;
        for i in 0..n {
            let rho = (i as f64 + 0.5) / n as f64;
            let dv = 2.0 * rho;
            sum += self.ne(rho) * dv;
            vol += dv;
        }
        sum / vol
    }

    /// Volume-averaged pressure (keV * 10²⁰ m⁻³ = 1.602 kPa).
    pub fn pressure_vol_avg(&self) -> f64 {
        let n = 50;
        let mut sum = 0.0;
        let mut vol = 0.0;
        for i in 0..n {
            let rho = (i as f64 + 0.5) / n as f64;
            let dv = 2.0 * rho;
            sum += self.ne(rho) * self.te(rho) * 2.0 * dv;
            vol += dv;
        }
        sum / vol
    }

    /// Update profiles from 0D state variables.
    ///
    /// In H-mode, scales the tanh-pedestal parameters to match the 0D transport
    /// solution, with 200ms smoothing on pedestal evolution to prevent jitter.
    /// In L-mode, updates simple parabolic parameters.
    ///
    /// Transitions are handled smoothly:
    /// - L→H: pedestal starts at edge value and ramps up (200ms τ)
    /// - H→L: pedestal ramps down toward edge (100ms τ) before zeroing
    pub fn update_from_0d(&mut self, te0: f64, ne0: f64, h_mode: bool, dt: f64) {
        let l_to_h = h_mode && !self.prev_h_mode;
        self.h_mode = h_mode;
        self.prev_h_mode = h_mode;

        if h_mode {
            // On L→H transition: initialize pedestal at edge values so it
            // ramps up smoothly rather than jumping to the default H-mode ped
            if l_to_h {
                self.te_params.ped = self.te_params.edge;
                self.ne_params.ped = self.ne_params.edge;
            }

            // Scale core to match 0D central Te
            self.te_params.core = te0.max(0.1);

            // Pedestal tracks core with realistic ratio, smoothed
            let target_te_ped = (0.35 * te0).max(0.3).min(te0 * 0.6);
            let tau_ped = 0.2; // 200ms pedestal response time
            let alpha = (dt / tau_ped).min(1.0);
            self.te_params.ped += (target_te_ped - self.te_params.ped) * alpha;
            self.te_ped = self.te_params.ped;

            // Density: scale to match ne_bar from transport
            let ne0_target = ne0 * 1.3; // peaking factor
            self.ne_params.core = ne0_target.max(0.05);
            let target_ne_ped = (0.7 * ne0_target).max(0.1);
            self.ne_params.ped += (target_ne_ped - self.ne_params.ped) * alpha;
            self.ne_ped = self.ne_params.ped;
        } else {
            // L-mode: set core values, edge handled by parabolic model
            self.te0_lmode = te0.max(0.01);
            self.ne0_lmode = ne0.max(0.01);

            // Smooth pedestal ramp-down after H→L transition
            if self.te_params.ped > self.te_params.edge * 1.5 {
                let tau_down = 0.1; // 100ms — back-transition is faster
                let alpha = (dt / tau_down).min(1.0);
                self.te_params.ped += (self.te_params.edge - self.te_params.ped) * alpha;
                self.ne_params.ped += (self.ne_params.edge - self.ne_params.ped) * alpha;
                self.te_ped = self.te_params.ped;
                self.ne_ped = self.ne_params.ped;
            } else {
                self.te_ped = 0.0;
                self.ne_ped = 0.0;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tanh_profile_basic() {
        let p = default_te_params();
        let axis = tanh_profile(0.0, &p);
        let ped = tanh_profile(p.xphalf - 0.5 * p.widthp, &p);
        let edge = tanh_profile(1.0, &p);

        // Core should be near p.core
        assert!(
            (axis - p.core).abs() < 0.5,
            "Axis value {axis} should be near core {}",
            p.core
        );
        // Pedestal top should be near p.ped
        assert!(
            (ped - p.ped).abs() < 0.3,
            "Pedestal value {ped} should be near ped {}",
            p.ped
        );
        // Edge should be near p.edge
        assert!(
            (edge - p.edge).abs() < 0.1,
            "Edge value {edge} should be near edge {}",
            p.edge
        );
        // Monotonically decreasing
        assert!(axis > ped, "Core > pedestal");
        assert!(ped > edge, "Pedestal > edge");
    }

    #[test]
    fn test_lmode_profiles() {
        let p = Profiles::default();
        // L-mode by default
        assert!(!p.h_mode);
        assert!(p.te(0.0) > p.te(0.5));
        assert!(p.te(0.5) > p.te(1.0));
        assert!(p.te(1.0) < 0.1);
    }

    #[test]
    fn test_hmode_profiles() {
        let mut p = Profiles::default();
        p.h_mode = true;

        // Core should be near te_params.core
        let te_core = p.te(0.0);
        assert!(
            (te_core - p.te_params.core).abs() < 0.5,
            "H-mode core Te {te_core} should be near {}",
            p.te_params.core
        );

        // Edge should be very low
        assert!(p.te(1.0) < 0.15);

        // Profile should have a pedestal structure (steep gradient near edge)
        let te_085 = p.te(0.85);
        let te_099 = p.te(0.99);
        let gradient = (te_085 - te_099) / 0.14;
        assert!(gradient > 1.0, "Should have steep pedestal gradient, got {gradient}");
    }

    #[test]
    fn test_update_from_0d_smoothing() {
        let mut p = Profiles::default();

        // Transition to H-mode first (pedestal starts at edge)
        p.update_from_0d(5.0, 0.8, true, 0.005);
        let te_ped_1 = p.te_ped;

        // Large change in core Te — pedestal should be smoothed
        p.update_from_0d(8.0, 0.8, true, 0.005);
        let te_ped_2 = p.te_ped;

        // Pedestal should not jump instantly (smoothed by tau_ped = 0.2s)
        // With dt=5ms, alpha = 0.025, so change should be ~2.5% of target delta
        let target = (0.35 * 8.0_f64).max(0.3).min(8.0 * 0.6);
        assert!(
            (te_ped_2 - te_ped_1).abs() < (target - te_ped_1).abs() * 0.5,
            "Pedestal should be smoothed, not jump instantly"
        );
    }

    #[test]
    fn test_l_to_h_transition_continuous() {
        let mut p = Profiles::default();
        // Run several L-mode steps to fully ramp down the default pedestal
        for _ in 0..200 {
            p.update_from_0d(3.0, 0.6, false, 0.005);
        }
        assert_eq!(p.te_ped, 0.0);

        // Transition to H-mode — pedestal should start near edge, NOT at default 0.83
        p.update_from_0d(3.0, 0.6, true, 0.005);
        assert!(
            p.te_ped < 0.2,
            "On L→H transition, te_ped={} should start near edge (~0.07), not jump to H-mode default",
            p.te_ped
        );
        assert!(
            p.ne_ped < 0.05,
            "On L→H transition, ne_ped={} should start near edge (~0.009)",
            p.ne_ped
        );

        // After many H-mode steps, pedestal should build up toward target
        for _ in 0..200 {
            p.update_from_0d(3.0, 0.6, true, 0.005);
        }
        assert!(
            p.te_ped > 0.5,
            "After 1s of H-mode, te_ped={} should have built up significantly",
            p.te_ped
        );
    }

    #[test]
    fn test_h_to_l_transition_smooth() {
        let mut p = Profiles::default();
        // Establish H-mode with built-up pedestal
        for _ in 0..200 {
            p.update_from_0d(4.0, 0.7, true, 0.005);
        }
        let te_ped_before = p.te_ped;
        assert!(te_ped_before > 0.5, "Pedestal should be well-established");

        // Transition to L-mode — pedestal should NOT zero instantly
        p.update_from_0d(2.0, 0.5, false, 0.005);
        assert!(
            p.te_ped > te_ped_before * 0.5,
            "On H→L transition, te_ped={} should not drop instantly from {}",
            p.te_ped,
            te_ped_before
        );

        // After many L-mode steps, pedestal should decay toward zero
        for _ in 0..100 {
            p.update_from_0d(2.0, 0.5, false, 0.005);
        }
        assert!(
            p.te_ped == 0.0 || p.te_ped < 0.15,
            "After 500ms of L-mode, te_ped={} should be near zero",
            p.te_ped
        );
    }

    #[test]
    fn test_profile_arrays() {
        let mut p = Profiles::default();
        p.h_mode = true;

        let te_arr = p.te_profile_array();
        let ne_arr = p.ne_profile_array();

        assert_eq!(te_arr.len(), PROFILE_NPTS);
        assert_eq!(ne_arr.len(), PROFILE_NPTS);

        // First element should be core, last should be edge
        assert!(te_arr[0] > te_arr[PROFILE_NPTS - 1]);
        assert!(ne_arr[0] > ne_arr[PROFILE_NPTS - 1]);
    }

    #[test]
    fn test_averages_hmode() {
        let mut p = Profiles::default();
        p.h_mode = true;
        p.te_params.core = 5.0;
        p.te_params.ped = 1.5;
        p.ne_params.core = 0.8;
        p.ne_params.ped = 0.4;

        let te_avg = p.te_vol_avg();
        assert!(te_avg > 0.0 && te_avg < p.te_params.core);
        let ne_avg = p.ne_vol_avg();
        assert!(ne_avg > 0.0 && ne_avg < p.ne_params.core);
    }
}
