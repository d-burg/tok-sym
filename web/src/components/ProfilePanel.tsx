import { useEffect, useRef } from 'react'
import type { ProcessedProfile } from '../lib/types'

interface Props {
  profiles: ProcessedProfile[] | null
  currentIndex: number
  teMax: number
  neMax: number
  pMax: number
  showThomson: boolean
  showPressure: boolean
}

const MARGIN = { top: 12, right: 8, bottom: 24, left: 48 }

export default function ProfilePanel({
  profiles,
  currentIndex,
  teMax,
  neMax,
  pMax,
  showThomson,
  showPressure,
}: Props) {
  const teCanvasRef = useRef<HTMLCanvasElement>(null)
  const neCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const teCanvas = teCanvasRef.current
    const neCanvas = neCanvasRef.current
    if (!container || !teCanvas || !neCanvas || !profiles || profiles.length === 0) return

    const profile = profiles[Math.min(currentIndex, profiles.length - 1)]
    if (!profile) return

    const te = profile.te_profile
    const ne = profile.ne_profile
    const nRho = te.length

    // Size canvases to container (each gets half height)
    const rect = container.getBoundingClientRect()
    const W = Math.floor(rect.width)
    const halfH = Math.floor(rect.height / 2)
    const dpr = window.devicePixelRatio || 1

    for (const canvas of [teCanvas, neCanvas]) {
      canvas.width = W * dpr
      canvas.height = halfH * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${halfH}px`
    }

    // Pressure right-axis margin (wider when pressure shown)
    const rightMargin = showPressure ? 40 : MARGIN.right

    // Draw Te canvas
    drawProfileCanvas(teCanvas, {
      W,
      H: halfH,
      dpr,
      rhoData: te,
      nRho,
      yMax: teMax,
      lineColor: '#ef4444',
      label: 'Te (keV)',
      labelColor: '#ef4444',
      thomsonPoints: showThomson ? profile.te_thomson : null,
      scatterColor: '#fca5a5',
      showXAxis: false,
      rightMargin,
      // Pressure overlay
      pressure: showPressure ? te.map((t, i) => 2 * ne[i] * t) : null,
      pMax: showPressure ? pMax : 0,
      hmodeLabel: profile.in_hmode ? 'H' : 'L',
    })

    // Draw ne canvas
    drawProfileCanvas(neCanvas, {
      W,
      H: halfH,
      dpr,
      rhoData: ne,
      nRho,
      yMax: neMax,
      lineColor: '#3b82f6',
      label: 'ne (10²⁰/m³)',
      labelColor: '#3b82f6',
      thomsonPoints: showThomson ? profile.ne_thomson : null,
      scatterColor: '#93c5fd',
      showXAxis: true,
      rightMargin: MARGIN.right,
      pressure: null,
      pMax: 0,
      hmodeLabel: null,
    })
  }, [profiles, currentIndex, teMax, neMax, pMax, showThomson, showPressure])

  if (!profiles || profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-xs font-mono">
        Profile data available after discharge
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <canvas ref={teCanvasRef} className="block w-full flex-1" />
      <canvas ref={neCanvasRef} className="block w-full flex-1" />
    </div>
  )
}

interface DrawOpts {
  W: number
  H: number
  dpr: number
  rhoData: number[]
  nRho: number
  yMax: number
  lineColor: string
  label: string
  labelColor: string
  thomsonPoints: { rho: number; val: number }[] | null
  scatterColor: string
  showXAxis: boolean
  rightMargin: number
  pressure: number[] | null
  pMax: number
  hmodeLabel: string | null
}

function drawProfileCanvas(canvas: HTMLCanvasElement, opts: DrawOpts) {
  const {
    W,
    H,
    dpr,
    rhoData,
    nRho,
    yMax,
    lineColor,
    label,
    labelColor,
    thomsonPoints,
    scatterColor,
    showXAxis,
    rightMargin,
    pressure,
    pMax,
    hmodeLabel,
  } = opts

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // Clear
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, W, H)

  const bottomMargin = showXAxis ? MARGIN.bottom : 8
  const plotW = W - MARGIN.left - rightMargin
  const plotH = H - MARGIN.top - bottomMargin
  if (plotW < 20 || plotH < 20) return

  // Helpers
  const xOf = (rho: number) => MARGIN.left + rho * plotW
  const yOf = (v: number) => MARGIN.top + plotH - (v / yMax) * plotH

  // Grid
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 4; i++) {
    const y = MARGIN.top + (plotH * i) / 4
    ctx.beginPath()
    ctx.moveTo(MARGIN.left, y)
    ctx.lineTo(MARGIN.left + plotW, y)
    ctx.stroke()
  }
  for (let i = 0; i <= 5; i++) {
    const x = MARGIN.left + (plotW * i) / 5
    ctx.beginPath()
    ctx.moveTo(x, MARGIN.top)
    ctx.lineTo(x, MARGIN.top + plotH)
    ctx.stroke()
  }

  // Left Y-axis ticks
  ctx.font = '9px monospace'
  ctx.textAlign = 'right'
  ctx.fillStyle = labelColor
  for (let i = 0; i <= 4; i++) {
    const v = (yMax * i) / 4
    ctx.fillText(v.toFixed(yMax < 1 ? 2 : 1), MARGIN.left - 4, yOf(v) + 3)
  }

  // Left axis label
  ctx.save()
  ctx.translate(8, MARGIN.top + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = labelColor
  ctx.fillText(label, 0, 0)
  ctx.restore()

  // X-axis labels (only on bottom canvas)
  if (showXAxis) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#6b7280'
    ctx.fillText('ρ (normalized radius)', MARGIN.left + plotW / 2, H - 2)
    for (let i = 0; i <= 5; i++) {
      const rho = i / 5
      ctx.fillText(rho.toFixed(1), xOf(rho), H - 10)
    }
  }

  // Profile line
  ctx.beginPath()
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5
  for (let i = 0; i < nRho; i++) {
    const rho = i / (nRho - 1)
    const x = xOf(rho)
    const y = yOf(rhoData[i])
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Pressure overlay (dashed green, right Y-axis)
  if (pressure && pMax > 0) {
    const yP = (v: number) => MARGIN.top + plotH - (v / pMax) * plotH

    ctx.beginPath()
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    for (let i = 0; i < nRho; i++) {
      const rho = i / (nRho - 1)
      const x = xOf(rho)
      const y = yP(pressure[i])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Right Y-axis for pressure
    ctx.textAlign = 'left'
    ctx.fillStyle = '#22c55e'
    for (let i = 0; i <= 4; i++) {
      const v = (pMax * i) / 4
      ctx.fillText(v.toFixed(1), MARGIN.left + plotW + 4, yP(v) + 3)
    }
    // Right axis label
    ctx.save()
    ctx.translate(W - 4, MARGIN.top + plotH / 2)
    ctx.rotate(Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#22c55e'
    ctx.fillText('P (keV·10²⁰/m³)', 0, 0)
    ctx.restore()
  }

  // Thomson scatter points
  if (thomsonPoints) {
    ctx.strokeStyle = scatterColor
    ctx.lineWidth = 1
    for (const pt of thomsonPoints) {
      ctx.beginPath()
      ctx.arc(xOf(pt.rho), yOf(Math.max(pt.val, 0)), 2.5, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }

  // Legend
  const legendX = MARGIN.left + 6
  let legendY = MARGIN.top + 10
  ctx.font = '9px monospace'
  ctx.textAlign = 'left'

  ctx.fillStyle = lineColor
  ctx.fillText(`\u2014 ${label.split(' ')[0]}`, legendX, legendY)

  if (thomsonPoints) {
    legendY += 11
    ctx.fillStyle = scatterColor
    ctx.fillText('\u25cb Thomson', legendX, legendY)
  }

  if (pressure) {
    legendY += 11
    ctx.fillStyle = '#22c55e'
    ctx.fillText('-- P=2neTe', legendX, legendY)
  }

  // H-mode / L-mode badge
  if (hmodeLabel) {
    const badgeX = MARGIN.left + plotW - 16
    const badgeY = MARGIN.top + 10
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = hmodeLabel === 'H' ? '#06b6d4' : '#9ca3af'
    ctx.fillText(`${hmodeLabel}-mode`, badgeX, badgeY)
  }
}
