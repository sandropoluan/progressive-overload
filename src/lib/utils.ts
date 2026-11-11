import type { Exercise, Session, SetEntry, Unit } from '../types'

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Epley estimated one-rep max. */
export const estimate1RM = (weight: number, reps: number): number =>
  reps <= 1 ? weight : weight * (1 + reps / 30)

export const sessionVolume = (sets: SetEntry[]): number =>
  sets.reduce((sum, s) => sum + s.weight * s.reps, 0)

/** The heaviest set; ties broken by reps. */
export const topSet = (sets: SetEntry[]): SetEntry | undefined =>
  sets.reduce<SetEntry | undefined>((best, s) => {
    if (!best) return s
    if (s.weight > best.weight) return s
    if (s.weight === best.weight && s.reps > best.reps) return s
    return best
  }, undefined)

export const bestE1RM = (sets: SetEntry[]): number =>
  sets.reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps)), 0)

export const totalReps = (sets: SetEntry[]): number => sets.reduce((sum, s) => sum + s.reps, 0)

export const bestReps = (sets: SetEntry[]): number => sets.reduce((m, s) => Math.max(m, s.reps), 0)

/** True when no set in the list carries external load (pure bodyweight / timed work). */
export const isUnweighted = (sets: SetEntry[]): boolean => sets.length > 0 && sets.every((s) => s.weight <= 0)

export const fmtWeight = (w: number): string =>
  Number.isInteger(w) ? String(w) : w.toFixed(1).replace(/\.0$/, '')

export const fmtSets = (sets: SetEntry[], unit: Unit): string => {
  if (sets.length === 0) return '—'
  const allSame = sets.every((s) => s.weight === sets[0].weight)
  if (allSame) {
    const load = sets[0].weight > 0 ? `${fmtWeight(sets[0].weight)} ${unit}` : 'BW'
    return `${load} × ${sets.map((s) => s.reps).join(', ')}`
  }
  return sets.map((s) => `${s.weight > 0 ? fmtWeight(s.weight) : 'BW'}×${s.reps}`).join('  ')
}

export const sortByDateDesc = (a: Session, b: Session): number =>
  b.date.localeCompare(a.date)

export const sortByDateAsc = (a: Session, b: Session): number =>
  a.date.localeCompare(b.date)

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export const relativeDay = (iso: string): string => {
  const d = new Date(iso)
  const now = new Date()
  if (isSameDay(d, now)) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, yesterday)) return 'Yesterday'
  const days = Math.round((now.getTime() - d.getTime()) / 86_400_000)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export const startOfWeek = (d: Date): Date => {
  const out = new Date(d)
  const day = (out.getDay() + 6) % 7 // Monday = 0
  out.setDate(out.getDate() - day)
  out.setHours(0, 0, 0, 0)
  return out
}

/** Smallest sensible plate jump for the unit. */
export const weightStep = (unit: Unit): number => (unit === 'kg' ? 2.5 : 5)

export interface Suggestion {
  kind: 'first' | 'reps' | 'weight' | 'repeat'
  title: string
  detail: string
  sets: SetEntry[]
}

/**
 * Double-progression suggestion: add reps until the top set hits the ceiling,
 * then add weight and drop reps back to the floor.
 */
export const suggestNext = (
  last: Session | undefined,
  unit: Unit,
  exercise: Pick<Exercise, 'repMin' | 'repMax' | 'sets' | 'equipment' | 'timed' | 'unilateral'>,
): Suggestion => {
  const floor = exercise.repMin
  const ceiling = exercise.repMax
  const u = exercise.timed ? 's' : 'reps'
  const side = exercise.unilateral ? ' per side' : ''
  const bodyweight = exercise.equipment === 'Bodyweight'
  if (!last || last.sets.length === 0) {
    return {
      kind: 'first',
      title: 'First session',
      detail: exercise.timed
        ? `Recommended ${exercise.sets} × ${floor}–${ceiling} s${side}. Log the seconds held as reps; add weight later for more challenge.`
        : bodyweight
          ? `Recommended ${exercise.sets} × ${floor}–${ceiling} reps${side}. Leave weight at 0, or enter any added weight (belt, vest).`
          : `Recommended ${exercise.sets} × ${floor}–${ceiling} reps${side}. Pick a weight where the last rep of each set is hard but clean.`,
      sets: Array.from({ length: exercise.sets }, () => ({ weight: 0, reps: floor })),
    }
  }
  const top = topSet(last.sets)!
  const step = weightStep(unit)
  const minReps = Math.min(...last.sets.map((s) => s.reps))

  if (minReps >= ceiling) {
    if (top.weight === 0) {
      // Unloaded bodyweight / timed work: keep extending instead of forcing a weight jump.
      const bump = exercise.timed ? 10 : 2
      return {
        kind: 'reps',
        title: exercise.timed ? `Hold ${bump} s longer` : `Add ${bump} ${u} to each set`,
        detail: `You hit ${ceiling}+ ${u} on every set. Keep building, or add weight (belt, vest, plate) and drop back to ${floor} ${u}.`,
        sets: last.sets.map((s) => ({ weight: s.weight, reps: s.reps + bump })),
      }
    }
    const w = top.weight + step
    return {
      kind: 'weight',
      title: `Go up to ${fmtWeight(w)} ${unit}`,
      detail: `You hit ${ceiling}+ ${u} on every set. Add weight and aim for ${floor}+ ${u}${side}.`,
      sets: last.sets.map(() => ({ weight: w, reps: floor })),
    }
  }
  if (minReps < floor) {
    return {
      kind: 'repeat',
      title: top.weight === 0 ? 'Same as last time' : `Stay at ${fmtWeight(top.weight)} ${unit}`,
      detail: `Build up to ${floor}+ ${u} on every set before adding ${top.weight === 0 ? 'load' : 'weight'}.`,
      sets: last.sets.map((s) => ({ weight: s.weight, reps: Math.max(s.reps, floor) })),
    }
  }
  return {
    kind: 'reps',
    title: exercise.timed ? 'Hold a little longer' : 'Add a rep to each set',
    detail: exercise.timed
      ? `Same load, a few more seconds per set. At ${ceiling} s everywhere, add weight.`
      : `Same weight, one more rep per set${side}. At ${ceiling} reps everywhere, add ${fmtWeight(step)} ${unit}.`,
    sets: last.sets.map((s) => ({ weight: s.weight, reps: s.reps + (exercise.timed ? 5 : 1) })),
  }
}

export const compareProgress = (a: SetEntry[], b: SetEntry[]): number => {
  const ta = topSet(a); const tb = topSet(b)
  if (!ta || !tb) return 0
  if (ta.weight !== tb.weight) return Math.sign(ta.weight - tb.weight)
  if (ta.reps !== tb.reps) return Math.sign(ta.reps - tb.reps)
  const d = bestE1RM(a) - bestE1RM(b)
  return Math.abs(d) < 0.01 ? 0 : Math.sign(d)
}

/**
 * IDs of sessions that set a personal record: a heavier top set, or a better
 * estimated 1RM, than every earlier session. The first session never counts.
 */
export const prSessionIds = (sessions: Session[]): Set<string> => {
  const asc = [...sessions].sort(sortByDateAsc)
  const ids = new Set<string>()
  let bestW = -1; let bestE = -1; let bestR0 = -1
  asc.forEach((s, i) => {
    const w = topSet(s.sets)?.weight ?? 0
    const e = bestE1RM(s.sets)
    const r0 = isUnweighted(s.sets) ? bestReps(s.sets) : -1 // bodyweight sessions compete on reps
    if (i > 0 && (w > bestW || (w > 0 && e > bestE + 0.01) || (r0 >= 0 && r0 > bestR0))) ids.add(s.id)
    bestW = Math.max(bestW, w); bestE = Math.max(bestE, e); bestR0 = Math.max(bestR0, r0)
  })
  return ids
}

export const exerciseImage = (id: string, frame: 'start' | 'end'): string =>
  `${import.meta.env.BASE_URL}exercises/${id}/${frame}.webp`
