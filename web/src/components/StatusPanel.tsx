import type { Snapshot } from '../lib/types'

interface Props {
  snapshot: Snapshot | null
}

export default function StatusPanel({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <div className="p-3 font-mono text-sm text-gray-600 flex items-center justify-center h-full">
        Awaiting discharge…
      </div>
    )
  }

  const s = snapshot

  return (
    <div className="px-3 py-1.5 font-mono text-xs h-full overflow-y-auto">
      {/* Top row: mode badge + disruption risk */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
            s.disrupted
              ? 'bg-red-900 text-red-300'
              : s.in_hmode
                ? 'bg-cyan-900 text-cyan-300'
                : 'bg-gray-800 text-gray-300'
          }`}
        >
          {s.disrupted ? 'DISRUPTED' : s.in_hmode ? 'H-MODE' : 'L-MODE'}
        </span>
        {/* Disruption risk bar */}
        <DisruptionRisk risk={s.disruption_risk} snapshot={s} />

        <span className="text-[10px] text-gray-500 ml-auto shrink-0">
          {s.status}
        </span>
      </div>

      {/* Params & Stability side by side */}
      <div className="grid grid-cols-2 gap-x-4 mb-1">
        {/* Column 1: Key parameters */}
        <div>
          <div className="text-[10px] text-gray-500 mb-0.5">Plasma parameters</div>
          <Param label="Iₚ" value={s.ip} unit="MA" />
          <Param label="Bₜ" value={s.bt} unit="T" />
          <Param label="Tₑ₀" value={s.te0} unit="keV" />
          <Param label="n̄ₑ" value={s.ne_bar} unit="10²⁰" />
          <Param label="Wₜₕ" value={s.w_th} unit="MJ" precision={2} />
          <Param label="τE" value={s.tau_e} unit="s" precision={3} />
        </div>

        {/* Column 2: Stability & confinement */}
        <div>
          <div className="text-[10px] text-gray-500 mb-0.5">Stability</div>
          <Param label="q₉₅" value={s.q95} unit="" warn={s.q95 < 2.5} danger={s.q95 < 2.0} />
          <Param label="βN" value={s.beta_n} unit="" warn={s.beta_n > 2.5} danger={s.beta_n > 2.8} />
          <Param label="fGW" value={s.f_greenwald} unit="" warn={s.f_greenwald > 0.8} danger={s.f_greenwald > 0.9} />
          <Param label="H₉₈" value={s.h_factor} unit="" />
          <Param label="li" value={s.li} unit="" />
          <Param label="Vₗₒₒₚ" value={s.diagnostics.v_loop} unit="V" precision={3} />
        </div>
      </div>

      {/* Power balance: compact 2×2 grid below params/stability */}
      <div className="border-t border-gray-800 pt-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-gray-500">Power balance</span>
          <span className="text-[10px] text-gray-500">
            Pin={s.p_input.toFixed(1)} Ploss={s.p_loss.toFixed(1)} MW
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <PowerBar label="Pₒₕ" value={s.p_ohmic} total={s.p_input} color="#6b7280" />
          <PowerBar label="Pₙᵦᵢ" value={s.prog_p_nbi} total={s.p_input} color="#3b82f6" />
          <PowerBar label="Pₑcₕ" value={s.prog_p_ech} total={s.p_input} color="#8b5cf6" />
          <PowerBar label="Pᵣₐd" value={s.p_rad} total={s.p_input} color="#ef4444" />
        </div>
      </div>
    </div>
  )
}

/** Compact disruption risk indicator with risk factor breakdown. */
function DisruptionRisk({ risk, snapshot }: { risk: number; snapshot: Snapshot }) {
  const pct = Math.min(risk * 100, 100)
  const barColor =
    pct > 80 ? '#ef4444' : pct > 60 ? '#f97316' : pct > 30 ? '#eab308' : '#22c55e'

  // Risk factor values (same metrics used by the disruption model)
  const factors = [
    { label: 'fGW', value: snapshot.f_greenwald, warn: 0.8, danger: 0.9 },
    { label: 'βN', value: snapshot.beta_n, warn: 2.5, danger: 2.8 },
    { label: 'q95', value: snapshot.q95, warn: 2.5, danger: 2.0, invert: true },
    { label: 'Prad/Pin', value: snapshot.p_input > 0 ? snapshot.p_rad / snapshot.p_input : 0, warn: 0.7, danger: 0.85 },
  ]

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {/* Risk bar */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-gray-500">Disruption risk</span>
        <div className="w-24 h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
        <span
          className="text-[10px] font-bold tabular-nums w-8"
          style={{ color: barColor }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>

      {/* Risk factors inline */}
      <div className="flex items-center gap-2 text-[10px] min-w-0">
        {factors.map((f) => {
          const isDanger = f.invert ? f.value < f.danger : f.value > f.danger
          const isWarn = f.invert ? f.value < f.warn : f.value > f.warn
          const color = isDanger ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-gray-500'
          return (
            <span key={f.label} className={`${color} whitespace-nowrap`}>
              {f.label}={f.value.toFixed(2)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Param({
  label,
  value,
  unit,
  precision = 2,
  warn = false,
  danger = false,
}: {
  label: string
  value: number
  unit: string
  precision?: number
  warn?: boolean
  danger?: boolean
}) {
  const color = danger ? 'text-red-400' : warn ? 'text-yellow-400' : 'text-gray-200'
  return (
    <div className="flex justify-between leading-snug">
      <span className="text-gray-500">{label}</span>
      <span className={color}>
        {value.toFixed(precision)}
        {unit && <span className="text-gray-600 ml-0.5 text-[10px]">{unit}</span>}
      </span>
    </div>
  )
}

function PowerBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const frac = total > 0 ? Math.min(value / total, 1) : 0
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500 w-7 text-right shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${frac * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-gray-400 w-8 text-right shrink-0">
        {value.toFixed(1)}
      </span>
    </div>
  )
}
