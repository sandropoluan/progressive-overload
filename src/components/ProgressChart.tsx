import { useMemo, useRef, useState } from 'react'
import { bestE1RM, bestReps, fmtWeight, isUnweighted, sessionVolume, shortDate, sortByDateAsc, topSet, totalReps } from '../lib/utils'
import type { Session, Unit } from '../types'

type Metric = 'top' | 'e1rm' | 'volume' | 'reps' | 'total'

interface Props {
  sessions: Session[]
  unit: Unit
}

const W = 520
const H = 200
const PAD = { top: 18, right: 16, bottom: 28, left: 40 }

const metricLabel: Record<Metric, string> = { top: 'Top set', e1rm: 'Est. 1RM', volume: 'Volume', reps: 'Best reps', total: 'Total reps' }

export function ProgressChart({ sessions, unit }: Props) {
  // Bodyweight-only history is charted by reps; weighted history by load.
  const unweighted = sessions.length > 0 && sessions.every((s) => isUnweighted(s.sets))
  const metrics: Metric[] = unweighted ? ['reps', 'total'] : ['top', 'e1rm', 'volume', 'reps']
  const [chosen, setMetric] = useState<Metric | null>(null)
  const metric: Metric = chosen && metrics.includes(chosen) ? chosen : metrics[0]
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const valueUnit = metric === 'reps' || metric === 'total' ? 'reps' : unit

  const points = useMemo(() => {
    const sorted = [...sessions].sort(sortByDateAsc)
    return sorted.map((s) => {
      const t = topSet(s.sets)
      const value =
        metric === 'top' ? (t?.weight ?? 0)
        : metric === 'e1rm' ? bestE1RM(s.sets)
        : metric === 'volume' ? sessionVolume(s.sets)
        : metric === 'reps' ? bestReps(s.sets)
        : totalReps(s.sets)
      return { date: s.date, value, reps: t?.reps ?? 0, weight: t?.weight ?? 0 }
    })
  }, [sessions, metric])

  if (points.length < 2) {
    return (
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Progress</div>
        <div className="empty" style={{ padding: '18px 0 6px' }}>
          Log {points.length === 0 ? 'two sessions' : 'one more session'} to see your trend.
        </div>
      </div>
    )
  }

  const values = points.map((p) => p.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const span = maxV - minV || Math.max(maxV * 0.1, 1)
  const lo = Math.max(0, minV - span * 0.25)
  const hi = maxV + span * 0.25
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(points.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`

  // 3 recessive gridlines with rounded tick values
  const ticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * t)
  const fmt = (v: number) => (metric === 'volume' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toString()) : fmtWeight(Math.round(v * 2) / 2))

  // x labels: first, last, and middle if room
  const labelIdx = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]))

  const onMove = (clientX: number) => {
    const el = svgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * W
    let best = 0
    let bestD = Infinity
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - px)
      if (d < bestD) { bestD = d; best = i }
    })
    setHover(best)
  }

  const active = hover !== null ? points[hover] : points[points.length - 1]
  const activeIdx = hover ?? points.length - 1
  const first = points[0].value
  const change = active.value - first
  const pct = first > 0 ? (change / first) * 100 : 0

  return (
    <div className="card">
      <div className="section-title" style={{ marginTop: 0 }}>
        <span>Progress</span>
        <div className="chart-tabs">
          {metrics.map((m) => (
            <button key={m} className={m === metric ? 'active' : ''} onClick={() => setMetric(m)}>
              {metricLabel[m]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span className="num" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {fmt(active.value)} <small style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>{valueUnit}</small>
        </span>
        <span className={`trend num ${change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}`} style={{ fontSize: 12.5 }}>
          {change > 0 ? '+' : ''}{fmt(change)} ({pct > 0 ? '+' : ''}{pct.toFixed(0)}%) since first
        </span>
      </div>
      <div className="chart-wrap">
        <svg
          ref={svgRef}
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          onMouseMove={(e) => onMove(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX)}
          onTouchMove={(e) => onMove(e.touches[0].clientX)}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border-strong)" strokeDasharray="2 4" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" className="num">{fmt(t)}</text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--muted)">
              {shortDate(points[i].date)}
            </text>
          ))}
          <path d={area} fill="url(#areaFill)" />
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--border-strong)" />
          )}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r={i === activeIdx ? 5 : 3.5}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="chart-tip"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              top: Math.max(0, (y(points[hover].value) / H) * 100 - 30) + '%',
            }}
          >
            <b className="num">{fmt(points[hover].value)} {valueUnit}{metric !== 'volume' && metric !== 'total' && ` · ${points[hover].weight > 0 ? fmtWeight(points[hover].weight) : 'BW'}×${points[hover].reps}`}</b>
            <span>{new Date(points[hover].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        )}
      </div>
    </div>
  )
}
