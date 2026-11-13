import { useCallback, useMemo, useRef, useState } from 'react'
import { fmtWeight, sessionVolume, startOfWeek } from '../lib/utils'
import type { Session, Unit } from '../types'
import { WeekDetail, type Week } from './WeekDetail'

type Metric = 'volume' | 'sets' | 'reps'
const WEEKS = 12
const DAY_MS = 86_400_000
const W = 520
const H = 150
const PAD = { top: 10, right: 8, bottom: 22, left: 8 }

const fmtK = (v: number) => (v >= 10_000 ? `${(v / 1000).toFixed(0)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : fmtWeight(v))
const weekLabel = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function HomeOverview({ sessions, unit }: { sessions: Session[]; unit: Unit }) {
  const [metric, setMetric] = useState<Metric>('volume')
  const [hover, setHover] = useState<number | null>(null)
  // What the detail sheet shows: a whole week (bar tap) or one day of it (heatmap tap).
  const [selected, setSelected] = useState<{ week: number; day?: number } | null>(null)
  // Stable identity: the sheet's scroll lock re-runs whenever onClose changes.
  const closeDetail = useCallback(() => setSelected(null), [])
  const svgRef = useRef<SVGSVGElement>(null)
  // Captured once per mount so the render stays pure.
  const [now] = useState(() => new Date())

  const weeks = useMemo<Week[]>(() => {
    const thisWeek = startOfWeek(now)
    const list: Week[] = Array.from({ length: WEEKS }, (_, i) => {
      const start = new Date(thisWeek)
      start.setDate(thisWeek.getDate() - (WEEKS - 1 - i) * 7)
      return { start, volume: 0, sets: 0, reps: 0, sessions: 0, days: [0, 0, 0, 0, 0, 0, 0], items: [] }
    })
    const first = list[0].start.getTime()
    for (const s of sessions) {
      const t = new Date(s.date).getTime()
      if (t < first) continue
      const idx = Math.floor((t - first) / (7 * DAY_MS))
      const w = list[idx]
      if (!w) continue
      const vol = sessionVolume(s.sets)
      w.volume += vol
      w.sets += s.sets.length
      w.reps += s.sets.reduce((n, x) => n + x.reps, 0)
      w.sessions += 1
      w.items.push(s)
      // Heatmap intensity counts sets, so bodyweight days light up too.
      const day = (new Date(s.date).getDay() + 6) % 7
      w.days[day] += s.sets.length
    }
    return list
  }, [sessions, now])

  const hasData = weeks.some((w) => w.sessions > 0)
  const values = weeks.map((w) => (metric === 'volume' ? w.volume : metric === 'sets' ? w.sets : w.reps))
  const max = Math.max(...values, 1)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / WEEKS
  const barW = Math.min(28, slot * 0.58)
  const x = (i: number) => PAD.left + slot * i + (slot - barW) / 2
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH

  const active = hover ?? WEEKS - 1
  const aw = weeks[active]
  const prev = weeks[active - 1]
  const aVal = values[active]
  const pVal = prev ? (metric === 'volume' ? prev.volume : metric === 'sets' ? prev.sets : prev.reps) : undefined
  const delta = pVal !== undefined && pVal > 0 ? ((aVal - pVal) / pVal) * 100 : undefined

  const weekAt = (clientX: number): number | null => {
    const el = svgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * W
    return Math.max(0, Math.min(WEEKS - 1, Math.floor((px - PAD.left) / slot)))
  }
  const onMove = (clientX: number) => {
    const i = weekAt(clientX)
    if (i !== null) setHover(i)
  }

  // Heatmap intensity: quantise each day's volume against the busiest day.
  const dayMax = Math.max(...weeks.flatMap((w) => w.days), 1)
  const level = (v: number) => (v <= 0 ? 0 : v < dayMax * 0.25 ? 1 : v < dayMax * 0.5 ? 2 : v < dayMax * 0.75 ? 3 : 4)
  const todayIdx = { w: WEEKS - 1, d: (now.getDay() + 6) % 7 }

  // Top-rounded bar path (4px radius, flat baseline).
  const bar = (bx: number, by: number, bw: number, bh: number) => {
    const r = Math.min(4, bw / 2, bh)
    return `M${bx},${by + bh} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + bw - r} Q${bx + bw},${by} ${bx + bw},${by + r} V${by + bh} Z`
  }

  return (
    <div className="card overview">
      <div className="section-title" style={{ marginTop: 0 }}>
        <span>Last {WEEKS} weeks</span>
        <div className="chart-tabs">
          {(['volume', 'sets', 'reps'] as Metric[]).map((m) => (
            <button key={m} className={m === metric ? 'active' : ''} onClick={() => setMetric(m)}>
              {m === 'volume' ? 'Volume' : m === 'sets' ? 'Sets' : 'Reps'}
            </button>
          ))}
        </div>
      </div>

      <div className="overview-head">
        <div>
          <div className="overview-value num">
            {hasData ? fmtK(aVal) : '—'}
            <small>{metric === 'volume' ? unit : metric}</small>
          </div>
          <div className="overview-sub">
            {hover === null ? 'This week' : `Week of ${weekLabel(aw.start)}`} · {aw.sessions} session{aw.sessions === 1 ? '' : 's'}
          </div>
        </div>
        {delta !== undefined && hasData && (
          <span className={`trend num ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}`} style={{ fontSize: 12.5 }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(0)}% vs prev. week
          </span>
        )}
      </div>

      <div className="chart-wrap">
        <svg
          ref={svgRef}
          className={`chart-svg ${hasData ? 'tappable' : ''}`}
          viewBox={`0 0 ${W} ${H}`}
          onClick={(e) => { const i = hasData ? weekAt(e.clientX) : null; if (i !== null) setSelected({ week: i }) }}
          onMouseMove={(e) => onMove(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX)}
          onTouchMove={(e) => onMove(e.touches[0].clientX)}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" />
              <stop offset="1" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="var(--border-strong)" />
          {weeks.map((w, i) => {
            const v = values[i]
            const h = hasData ? Math.max(v > 0 ? 3 : 0, (v / max) * innerH) : 0
            const isActive = i === active
            return (
              <g key={i}>
                {/* ghost slot so empty weeks are still readable and hoverable */}
                <rect x={x(i)} y={PAD.top} width={barW} height={innerH} rx={4} fill="var(--surface-2)" opacity={hasData ? 0.5 : 0.35} />
                {h > 0 && (
                  <path d={bar(x(i), y(v), barW, h)} fill="url(#barFill)" opacity={isActive ? 1 : 0.55} />
                )}
                {(i % 4 === 0 || i === WEEKS - 1) && (
                  <text x={x(i) + barW / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--muted)">
                    {i === WEEKS - 1 ? 'Now' : weekLabel(w.start)}
                  </text>
                )}
              </g>
            )
          })}
          {hover !== null && hasData && (
            <text x={x(hover) + barW / 2} y={Math.max(PAD.top + 9, y(values[hover]) - 6)} textAnchor="middle" fontSize="11" fontWeight={700} fill="var(--text)" className="num">
              {fmtK(values[hover])}
            </text>
          )}
        </svg>
        {!hasData && (
          <div className="overview-empty">Log a few sessions and your weekly training volume shows up here.</div>
        )}
      </div>

      <div className="heat">
        <div className="heat-days">{['M', '', 'W', '', 'F', '', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="heat-grid" role="img" aria-label="Training days, last 12 weeks">
          {weeks.map((w, wi) => (
            <div className="heat-col" key={wi}>
              {w.days.map((v, di) => {
                const future = wi === todayIdx.w && di > todayIdx.d
                const isToday = wi === todayIdx.w && di === todayIdx.d
                return (
                  <span
                    key={di}
                    onClick={future ? undefined : () => setSelected({ week: wi, day: di })}
                    className={`heat-cell l${level(v)} ${isToday ? 'today' : ''} ${future ? 'future' : ''}`}
                    title={`${new Date(w.start.getTime() + di * DAY_MS).toLocaleDateString()}${v ? ` · ${v} sets` : ''}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <WeekDetail
        week={selected === null ? null : weeks[selected.week]}
        prev={selected === null ? undefined : weeks[selected.week - 1]}
        day={selected?.day}
        unit={unit}
        onClose={closeDetail}
      />
    </div>
  )
}
