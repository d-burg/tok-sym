import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useSimulation } from '../lib/useSimulation'
import { getDevices, type PresetId } from '../lib/wasm'
import EquilibriumCanvas from '../components/EquilibriumCanvas'
import UnifiedTracePanel from '../components/UnifiedTracePanel'
import StatusPanel from '../components/StatusPanel'
import ShotPlanner from '../components/ShotPlanner'

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'hmode', label: 'H-mode' },
  { id: 'lmode', label: 'L-mode' },
  { id: 'density_limit', label: 'Density limit' },
]

export default function ControlRoom() {
  const { deviceId: routeDeviceId } = useParams<{ deviceId: string }>()
  const [searchParams] = useSearchParams()
  const routePreset = (searchParams.get('preset') || 'hmode') as PresetId

  // Local state so user can switch without navigating
  const [activeDevice, setActiveDevice] = useState(routeDeviceId ?? 'diiid')
  const [activePreset, setActivePreset] = useState<PresetId>(routePreset)
  const [showPlanner, setShowPlanner] = useState(false)

  const devices = useMemo(() => getDevices(), [])

  const [state, controls] = useSimulation(activeDevice, activePreset)
  const {
    displaySnapshot,
    history,
    running,
    wallJson,
    programJson,
    scrubIndex,
    finished,
  } = state

  const time = displaySnapshot?.time ?? 0
  const duration = displaySnapshot?.duration ?? 10
  const progress = duration > 0 ? (time / duration) * 100 : 0

  const handleDeviceChange = (newDeviceId: string) => {
    setActiveDevice(newDeviceId)
    controls.switchPreset(newDeviceId, activePreset)
  }

  const handlePresetChange = (newPreset: PresetId) => {
    setActivePreset(newPreset)
    controls.switchPreset(activeDevice, newPreset)
  }

  // PlasmaGlow gets null when scrubbing → dark viewport
  const plasmaSnapshot = scrubIndex !== null ? null : displaySnapshot

  const handleRunProgram = (devId: string, json: string) => {
    controls.runProgram(devId, json)
    setShowPlanner(false)
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0e17] overflow-hidden">
      {/* ─── Top bar ─── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 gap-4">
        {/* Device & preset selectors */}
        <div className="flex items-center gap-2">
          {/* Device selector */}
          <select
            value={activeDevice}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-cyan-400 text-sm font-bold
                       rounded px-2 py-1.5 cursor-pointer hover:border-cyan-600
                       focus:outline-none focus:border-cyan-500 transition-colors"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <span className="text-gray-700">|</span>

          {/* Preset selector as button group */}
          <div className="flex rounded overflow-hidden border border-gray-700">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer
                  ${
                    activePreset === p.id
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-2">
          {!running ? (
            <button
              onClick={controls.start}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-sm font-semibold
                         transition-colors cursor-pointer flex items-center gap-1"
            >
              ▶ Start
            </button>
          ) : (
            <button
              onClick={controls.pause}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-sm font-semibold
                         transition-colors cursor-pointer flex items-center gap-1"
            >
              ⏸ Pause
            </button>
          )}
          <button
            onClick={controls.reset}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold
                       transition-colors cursor-pointer"
          >
            ↺ Reset
          </button>

          {/* Edit Program button — visible when discharge is finished */}
          {finished && (
            <button
              onClick={() => setShowPlanner(!showPlanner)}
              className="px-4 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-sm font-semibold
                         transition-colors cursor-pointer flex items-center gap-1"
            >
              {showPlanner ? '✕ Close' : '📋 Edit Program'}
            </button>
          )}
        </div>

        {/* Time readout */}
        <div className="font-mono text-sm text-gray-400 tabular-nums whitespace-nowrap">
          t = {time.toFixed(3)} s / {duration.toFixed(1)} s
          {finished && (
            <span className="ml-2 text-xs text-gray-600">
              {scrubIndex !== null ? '(scrubbing)' : '(complete)'}
            </span>
          )}
        </div>
      </div>

      {/* ─── Main grid ─── */}
      <div className="flex-1 grid grid-cols-[1fr_1.5fr_1fr] grid-rows-[1.1fr_1fr] gap-2 p-2 min-h-0">
        {/* Top-left: Equilibrium cross-section (single cell) */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <EquilibriumCanvas snapshot={displaySnapshot} wallJson={wallJson} />
        </div>

        {/* Top row, cols 2-3: Unified trace panel */}
        <div className="col-span-2 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <UnifiedTracePanel
            history={history}
            programJson={programJson}
            deviceId={activeDevice}
            duration={duration}
            finished={finished}
            scrubIndex={scrubIndex}
            onScrub={controls.setScrubIndex}
          />
        </div>

        {/* Bottom row, cols 1-2: Status panel (extends under equilibrium) */}
        <div className="col-span-2 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <StatusPanel snapshot={displaySnapshot} />
        </div>

        {/* Bottom-right: Plasma viewport */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <PlasmaGlow snapshot={plasmaSnapshot} />
        </div>
      </div>

      {/* ─── Progress bar ─── */}
      <div className="h-1.5 bg-gray-900">
        <div
          className="h-full bg-cyan-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ─── Shot Planner drawer ─── */}
      {showPlanner && (
        <ShotPlanner
          deviceId={activeDevice}
          onRun={handleRunProgram}
          onClose={() => setShowPlanner(false)}
        />
      )}
    </div>
  )
}

/** Simple placeholder plasma glow — will become WebGL later. */
function PlasmaGlow({ snapshot }: { snapshot: import('../lib/types').Snapshot | null }) {
  const hasPlasma = snapshot !== null
  const temp = hasPlasma ? Math.min(snapshot.te0 / 10, 1) : 0
  const dens = hasPlasma ? Math.min(snapshot.ne_bar / 1.5, 1) : 0
  const brightness = temp * dens
  const disrupted = snapshot?.disrupted ?? false

  // Color shifts from red-orange (cold) to blue-white (hot)
  const r = Math.round(255 - temp * 100)
  const g = Math.round(100 + temp * 120)
  const b = Math.round(150 + temp * 105)
  const alpha = !hasPlasma || disrupted ? 0.05 : 0.15 + brightness * 0.6

  return (
    <div className="w-full h-full flex items-center justify-center p-1">
      <div className="h-full max-w-full aspect-square relative">
        {/* Port frame */}
        <div className="absolute inset-1 rounded-full border-4 border-gray-700 overflow-hidden">
          {hasPlasma ? (
            <>
              <div
                className="w-full h-full transition-all duration-200"
                style={{
                  background: `radial-gradient(ellipse 70% 90% at 50% 50%, rgba(${r},${g},${b},${alpha}) 0%, transparent 100%)`,
                }}
              />
              {snapshot.elm_active && (
                <div className="absolute inset-0 bg-amber-300 opacity-30 animate-pulse" />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-gray-600 text-sm font-mono">No plasma</span>
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 text-center text-[10px] text-gray-600 font-mono">
          Port view
        </div>
      </div>
    </div>
  )
}
