import { useMemo } from 'react'
import { navigate } from '../lib/router'
import { fmtSets, fmtWeight, isUnweighted, prSessionIds, sessionVolume, sortByDateDesc, totalReps } from '../lib/utils'
import { useStore } from '../store'
import type { Session, Unit } from '../types'
import { ChevronRight, Trophy } from './Icons'
import { Sheet } from './Sheet'
import { StatTile } from './StatTile'

export interface Week {
  start: Date
  volume: number
  sets: number
  reps: number
  sessions: number
  days: number[]
  items: Session[]
}

interface Props {
  /** The week to show; null keeps the sheet closed. */
  week: Week | null
  /** The week before it, for the comparison deltas. */
  prev?: Week
  /** Narrow the sheet to one day of the week (0 = Monday); omit for the whole week. */
  day?: number
  unit: Unit
  onClose: () => void
}

const dayMonth = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** Bottom sheet listing everything logged in one week of the home chart, or in one day of it. */
export function WeekDetail({ week, prev, day, unit, onClose }: Props) {
  const exercises = useStore((s) => s.exercises)
  const allSessions = useStore((s) => s.sessions)

  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])

  const items = useMemo(() => {
    if (!week) return []
    if (day === undefined) return week.items
    return week.items.filter((s) => (new Date(s.date).getDay() + 6) % 7 === day)
  }, [week, day])

  // PRs are judged against each exercise's full history, not just this period.
  const prIds = useMemo(() => {
    const ids = new Set<string>()
    if (items.length === 0) return ids
    const inWeek = new Set(items.map((s) => s.exerciseId))
    const byExercise = new Map<string, Session[]>()
    for (const s of allSessions) {
      if (!inWeek.has(s.exerciseId)) continue
      const arr = byExercise.get(s.exerciseId) ?? []
      arr.push(s)
      byExercise.set(s.exerciseId, arr)
    }
    for (const list of byExercise.values()) for (const id of prSessionIds(list)) ids.add(id)
    return ids
  }, [items, allSessions])

  const days = useMemo(() => {
    const groups: { key: string; date: Date; items: Session[] }[] = []
    for (const s of [...items].sort(sortByDateDesc)) {
      const date = new Date(s.date)
      const key = date.toDateString()
      const last = groups[groups.length - 1]
      if (last?.key === key) last.items.push(s)
      else groups.push({ key, date, items: [s] })
    }
    return groups
  }, [items])

  if (!week) return null

  const single = day !== undefined
  const end = new Date(week.start)
  end.setDate(end.getDate() + (single ? day : 6))
  const title = single
    ? end.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    : `${dayMonth(week.start)} – ${dayMonth(end)}`
  const volume = Math.round(items.reduce((n, s) => n + sessionVolume(s.sets), 0))
  const sets = items.reduce((n, s) => n + s.sets.length, 0)
  const reps = items.reduce((n, s) => n + totalReps(s.sets), 0)
  const prCount = items.filter((s) => prIds.has(s.id)).length
  // Week-over-week deltas only make sense for the whole-week view.
  const delta = (cur: number, before?: number) => (!single && prev && prev.sessions > 0 && before !== undefined ? cur - before : undefined)

  const open = (s: Session) => {
    onClose()
    navigate({ name: 'exercise', id: s.exerciseId })
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="stats">
        <StatTile label="Volume" value={fmtWeight(volume)} unit={unit} delta={delta(volume, prev && Math.round(prev.volume))} deltaUnit="vs prev" />
        <StatTile label="Sets" value={String(sets)} delta={delta(sets, prev?.sets)} deltaUnit="vs prev" />
        <StatTile label="Reps" value={String(reps)} delta={delta(reps, prev?.reps)} deltaUnit="vs prev" />
      </div>
      <div className="week-summary">
        {items.length} session{items.length === 1 ? '' : 's'}
        {!single && <> · {days.length} training day{days.length === 1 ? '' : 's'}</>}
        {prCount > 0 && <> · {prCount} PR{prCount === 1 ? '' : 's'}</>}
      </div>

      {days.length === 0 && (
        <div className="empty" style={{ padding: '24px 16px' }}>
          <strong>{single ? 'Rest day' : 'Rest week'}</strong>
          Nothing was logged {single ? 'on this day' : 'in this week'}.
        </div>
      )}

      {days.map((d) => (
        <div key={d.key} style={single ? { marginTop: 14 } : undefined}>
          {!single && (
            <div className="week-day">
              <span>{d.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
              <span className="num">{d.items.reduce((n, s) => n + s.sets.length, 0)} sets</span>
            </div>
          )}
          <div className="hist">
            {d.items.map((s) => (
              <button className="hist-row week-row" key={s.id} onClick={() => open(s)}>
                <div className="sets">
                  <div className="line">
                    {names.get(s.exerciseId) ?? 'Deleted exercise'}
                    {prIds.has(s.id) && <span className="pr-tag"><Trophy /> PR</span>}
                  </div>
                  <div className="vol num">
                    {fmtSets(s.sets, unit)} · {isUnweighted(s.sets) ? `${totalReps(s.sets)} reps` : `${fmtWeight(sessionVolume(s.sets))} ${unit}`}
                  </div>
                  {s.note && <div className="note">{s.note}</div>}
                </div>
                <ChevronRight className="chev" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  )
}
