import { useMemo, useState } from 'react'
import { navigate } from '../lib/router'
import { compareProgress, exerciseImage, fmtWeight, prSessionIds, relativeDay, sortByDateDesc, startOfWeek, topSet } from '../lib/utils'
import { useStore, type HomeFilter } from '../store'
import { MUSCLE_GROUPS, type Exercise, type Session } from '../types'
import { ExerciseForm } from './ExerciseForm'
import { HomeOverview } from './HomeOverview'
import { ArrowDown, ArrowUp, ChevronRight, Dash, Plus, Search, Settings } from './Icons'
import { StatTile } from './StatTile'

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')
    .split(/[\s/-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

export function Home() {
  const exercises = useStore((s) => s.exercises)
  const sessions = useStore((s) => s.sessions)
  const unit = useStore((s) => s.unit)
  const addExercise = useStore((s) => s.addExercise)

  const { query, filter } = useStore((s) => s.home)
  const setHome = useStore((s) => s.setHome)
  const setQuery = (query: string) => setHome({ query })
  const setFilter = (filter: HomeFilter) => setHome({ filter })
  const [adding, setAdding] = useState(false)

  const byExercise = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const s of sessions) {
      const arr = map.get(s.exerciseId) ?? []
      arr.push(s)
      map.set(s.exerciseId, arr)
    }
    for (const arr of map.values()) arr.sort(sortByDateDesc)
    return map
  }, [sessions])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = exercises.filter((e) => !e.archived)
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q))
    if (filter === 'Recent') list = list.filter((e) => byExercise.has(e.id))
    else if (filter !== 'All') list = list.filter((e) => e.muscle === filter)
    // Recently trained first, then alphabetical.
    return [...list].sort((a, b) => {
      const la = byExercise.get(a.id)?.[0]?.date ?? ''
      const lb = byExercise.get(b.id)?.[0]?.date ?? ''
      if (la !== lb) return lb.localeCompare(la)
      return a.name.localeCompare(b.name)
    })
  }, [exercises, query, filter, byExercise])

  // Captured once per mount so render stays pure; the list is short-lived anyway.
  const [now] = useState(() => new Date())
  const { daysThisWeek, daysLastWeek, prsThisWeek } = useMemo(() => {
    const weekStart = startOfWeek(now)
    const lastWeekStart = new Date(weekStart)
    lastWeekStart.setDate(weekStart.getDate() - 7)
    const dayKeys = (list: Session[]) => new Set(list.map((s) => new Date(s.date).toDateString())).size
    const thisWeek = sessions.filter((s) => new Date(s.date) >= weekStart)
    const lastWeek = sessions.filter((s) => { const d = new Date(s.date); return d >= lastWeekStart && d < weekStart })
    let prs = 0
    for (const list of byExercise.values()) {
      const ids = prSessionIds(list)
      prs += list.filter((s) => ids.has(s.id) && new Date(s.date) >= weekStart).length
    }
    return { daysThisWeek: dayKeys(thisWeek), daysLastWeek: dayKeys(lastWeek), prsThisWeek: prs }
  }, [sessions, byExercise, now])

  const hasCustom = exercises.some((e) => e.custom)

  return (
    <>
      <header className="topbar">
        <div className="brand grow">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <div>
            <h1>Overload</h1>
            <div className="sub">Progressive overload tracker</div>
          </div>
        </div>
        <button className="icon-btn" aria-label="Settings" onClick={() => navigate({ name: 'settings' })}><Settings /></button>
      </header>

      <div className="stats">
        <StatTile label="Training days" value={String(daysThisWeek)} unit="this week" delta={daysThisWeek - daysLastWeek} deltaUnit="vs last" />
        <StatTile label="Sessions" value={String(sessions.length)} unit="total" />
        <StatTile label="Weekly PRs" value={String(prsThisWeek)} />
      </div>

      <div style={{ height: 12 }} />
      <HomeOverview sessions={sessions} unit={unit} />

      <div className="search">
        <Search />
        <input placeholder="Search exercise or machine…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button className="btn ghost sm" onClick={() => setQuery('')}>Clear</button>}
      </div>

      <div className="chips">
        {(['All', 'Recent', ...MUSCLE_GROUPS] as HomeFilter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="ex-list">
        {visible.length === 0 && (
          <div className="empty">
            <strong>Nothing here</strong>
            {filter === 'Recent' && !hasCustom && sessions.length === 0
              ? 'Pick an exercise and log a set to see it under Recent.'
              : 'Try another filter, or add your own exercise with the button below.'}
          </div>
        )}
        {visible.map((e) => (
          <ExerciseRow key={e.id} exercise={e} sessions={byExercise.get(e.id) ?? []} unit={unit} />
        ))}
      </div>

      <button className="fab" onClick={() => setAdding(true)}><Plus /> Exercise</button>

      <ExerciseForm
        open={adding}
        onClose={() => setAdding(false)}
        onSubmit={(v) => { const ex = addExercise(v); setAdding(false); navigate({ name: 'exercise', id: ex.id }) }}
      />
    </>
  )
}

function ExerciseRow({ exercise, sessions, unit }: { exercise: Exercise; sessions: Session[]; unit: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const last = sessions[0]
  const prev = sessions[1]
  const lastTop = last ? topSet(last.sets) : undefined
  const prevTop = prev ? topSet(prev.sets) : undefined
  let trend: 'up' | 'down' | 'flat' | undefined
  if (lastTop && prevTop) {
    const c = compareProgress(last!.sets, prev!.sets)
    trend = c > 0 ? 'up' : c < 0 ? 'down' : 'flat'
  }
  return (
    <button className="ex-row" onClick={() => navigate({ name: 'exercise', id: exercise.id })}>
      {exercise.image && !imgFailed ? (
        <img className="ex-thumb" src={exerciseImage(exercise.id, 'end')} alt="" loading="lazy" onError={() => setImgFailed(true)} />
      ) : (
        <div className={`ex-badge m-${exercise.muscle}`}>{initials(exercise.name)}</div>
      )}
      <div className="main">
        <div className="name">{exercise.name}</div>
        <div className="meta">{exercise.muscle} · {exercise.equipment}{exercise.custom ? ' · Custom' : ''}</div>
      </div>
      {lastTop ? (
        <div className="last">
          <div className="w num">
            {fmtWeight(lastTop.weight)}<small>{unit}</small> × {lastTop.reps}
            {trend && (
              <span className={`trend ${trend}`} style={{ marginLeft: 6 }}>
                {trend === 'up' ? <ArrowUp /> : trend === 'down' ? <ArrowDown /> : <Dash />}
              </span>
            )}
          </div>
          <div className="d">{relativeDay(last!.date)}</div>
        </div>
      ) : (
        <div className="last">
          <div className="w num" style={{ color: 'var(--text-2)' }}>{exercise.sets} × {exercise.repMin}–{exercise.repMax}{exercise.timed ? ' s' : ''}</div>
          <div className="d">{exercise.unilateral ? 'per side' : 'target'}</div>
        </div>
      )}
      <ChevronRight className="chev" />
    </button>
  )
}
