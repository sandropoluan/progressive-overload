/**
 * The backup file format: building it, reading it back, and merging it into the app.
 *
 * Everything here is pure (no DOM, no store) so it can be tested directly with
 * `npm test`. Relative imports carry the .ts extension for the same reason.
 */
import { EQUIPMENT, MUSCLE_GROUPS } from '../types.ts'
import type { Equipment, Exercise, Muscle, MuscleGroup, Session, SetEntry, Unit } from '../types.ts'

export interface BackupCounts {
  exercises: number
  customExercises: number
  sessions: number
  sets: number
}

export interface ExportData {
  version: 1
  exportedAt: string
  unit: Unit
  exercises: Exercise[]
  sessions: Session[]
  /** Written since 2026-11; lets a reader notice a file that lost entries. */
  counts?: BackupCounts
}

/** The part of the app state a backup carries. */
export interface AppData {
  unit: Unit
  exercises: Exercise[]
  sessions: Session[]
}

/** The file cannot be used at all (not JSON, cut off, not a backup). */
export class BackupError extends Error {}

export const countData = (d: Pick<AppData, 'exercises' | 'sessions'>): BackupCounts => ({
  exercises: d.exercises.length,
  customExercises: d.exercises.filter((e) => e.custom).length,
  sessions: d.sessions.length,
  sets: d.sessions.reduce((n, s) => n + s.sets.length, 0),
})

export const buildBackup = (state: AppData, now: Date = new Date()): ExportData => ({
  version: 1,
  exportedAt: now.toISOString(),
  unit: state.unit,
  counts: countData(state),
  exercises: state.exercises,
  sessions: state.sessions,
})

// ---------------------------------------------------------------- reading

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined)
const BOOL_FLAGS = ['image', 'single', 'wide', 'unilateral', 'timed', 'archived', 'edited'] as const

/** Returns the exercise with only known, well-formed fields, or null when it cannot be identified. */
const readExercise = (raw: unknown, note: (repaired: boolean) => void): Exercise | null => {
  if (!isObj(raw)) return null
  const id = text(raw.id)
  const name = text(raw.name)
  if (!id || !name) return null
  let repaired = false
  const int = (v: unknown, lo: number, hi: number, fallback: number): number => {
    if (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi) return v
    repaired = true
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback
  }
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
    if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T
    repaired = true
    return fallback
  }
  const ex: Exercise = {
    id,
    name,
    muscle: oneOf<MuscleGroup>(raw.muscle, MUSCLE_GROUPS, 'Full body'),
    equipment: oneOf<Equipment>(raw.equipment, EQUIPMENT, 'Machine'),
    repMin: int(raw.repMin, 1, 100, 8),
    repMax: int(raw.repMax, 1, 100, 12),
    sets: int(raw.sets, 1, 10, 3),
    custom: raw.custom === true,
  }
  for (const k of BOOL_FLAGS) if (typeof raw[k] === 'boolean') ex[k] = raw[k]
  if (typeof raw.caption === 'string') ex.caption = raw.caption
  for (const k of ['primary', 'secondary'] as const) {
    const v = raw[k]
    if (Array.isArray(v)) ex[k] = v.filter((m): m is Muscle => typeof m === 'string')
  }
  note(repaired)
  return ex
}

/** Returns the session with valid sets only, or null when it is unusable. */
const readSession = (raw: unknown, note: (repaired: boolean) => void): Session | null => {
  if (!isObj(raw)) return null
  const id = text(raw.id)
  const exerciseId = text(raw.exerciseId)
  const date = text(raw.date)
  if (!id || !exerciseId || !date || !Number.isFinite(Date.parse(date)) || !Array.isArray(raw.sets)) return null
  const sets: SetEntry[] = []
  for (const s of raw.sets) {
    if (!isObj(s)) continue
    const { weight, reps } = s
    if (typeof weight !== 'number' || !Number.isFinite(weight)) continue
    if (typeof reps !== 'number' || !Number.isFinite(reps) || Math.round(reps) <= 0) continue
    sets.push({ weight, reps: Math.round(reps) })
  }
  if (sets.length === 0) return null
  const session: Session = { id, exerciseId, date, sets }
  const n = text(raw.note)
  if (n) session.note = n
  note(sets.length !== raw.sets.length)
  return session
}

export interface ParsedBackup {
  data: ExportData
  counts: BackupCounts
  /** Human-readable findings about damaged or missing entries; empty for a healthy file. */
  problems: string[]
  /** ISO dates of the oldest and newest session, when there are any. */
  firstSession?: string
  lastSession?: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Reads a backup file. Throws BackupError when the file is unusable; otherwise returns
 * every entry that could be read plus a list of anything that was damaged, so a
 * partly damaged file is never silently treated as complete.
 */
export const parseBackup = (fileText: string): ParsedBackup => {
  if (fileText.trim() === '') throw new BackupError('The file is empty.')
  let raw: unknown
  try {
    raw = JSON.parse(fileText)
  } catch {
    throw new BackupError('The file is damaged or cut off (it is not complete JSON).')
  }
  if (!isObj(raw) || !Array.isArray(raw.exercises) || !Array.isArray(raw.sessions)) {
    throw new BackupError('This file is not an Overload backup.')
  }
  if (typeof raw.version === 'number' && raw.version > 1) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app first.')
  }

  const problems: string[] = []
  const tally = { exBad: 0, exFixed: 0, exDup: 0, sesBad: 0, sesFixed: 0, sesDup: 0 }

  const exercises: Exercise[] = []
  const exIds = new Set<string>()
  for (const item of raw.exercises) {
    const ex = readExercise(item, (repaired) => { if (repaired) tally.exFixed += 1 })
    if (!ex) { tally.exBad += 1; continue }
    if (exIds.has(ex.id)) { tally.exDup += 1; continue }
    exIds.add(ex.id)
    exercises.push(ex)
  }

  const sessions: Session[] = []
  const sesIds = new Set<string>()
  for (const item of raw.sessions) {
    const s = readSession(item, (repaired) => { if (repaired) tally.sesFixed += 1 })
    if (!s) { tally.sesBad += 1; continue }
    if (sesIds.has(s.id)) { tally.sesDup += 1; continue }
    sesIds.add(s.id)
    sessions.push(s)
  }

  if (tally.sesBad) problems.push(`${plural(tally.sesBad, 'session')} could not be read and will be skipped.`)
  if (tally.sesFixed) problems.push(`${plural(tally.sesFixed, 'session')} had damaged sets; only the readable sets are kept.`)
  if (tally.sesDup) problems.push(`${plural(tally.sesDup, 'duplicate session')} ignored.`)
  if (tally.exBad) problems.push(`${plural(tally.exBad, 'exercise')} could not be read and will be skipped.`)
  if (tally.exFixed) problems.push(`${plural(tally.exFixed, 'exercise')} had damaged settings that were reset to defaults.`)
  if (tally.exDup) problems.push(`${plural(tally.exDup, 'duplicate exercise')} ignored.`)

  const orphans = sessions.filter((s) => !exIds.has(s.exerciseId)).length
  if (orphans) problems.push(`${plural(orphans, 'session')} belong${orphans === 1 ? 's' : ''} to an exercise that is not in this file.`)

  let unit: Unit = 'kg'
  if (raw.unit === 'kg' || raw.unit === 'lb') unit = raw.unit
  else problems.push('The weight unit was missing; kilograms assumed.')

  const counts = countData({ exercises, sessions })
  if (isObj(raw.counts)) {
    const said = raw.counts
    if (typeof said.sessions === 'number' && said.sessions !== counts.sessions) {
      problems.push(`The file says it holds ${plural(said.sessions, 'session')} but ${counts.sessions} could be read.`)
    }
    if (typeof said.exercises === 'number' && said.exercises !== counts.exercises) {
      problems.push(`The file says it holds ${plural(said.exercises, 'exercise')} but ${counts.exercises} could be read.`)
    }
    if (typeof said.sets === 'number' && said.sets !== counts.sets) {
      problems.push(`The file says it holds ${plural(said.sets, 'set')} but ${counts.sets} could be read.`)
    }
  }

  const exportedAt = text(raw.exportedAt)
  const dates = sessions.map((s) => s.date).sort((a, b) => Date.parse(a) - Date.parse(b))
  return {
    data: {
      version: 1,
      exportedAt: exportedAt && Number.isFinite(Date.parse(exportedAt)) ? exportedAt : new Date(0).toISOString(),
      unit,
      counts,
      exercises,
      sessions,
    },
    counts,
    problems,
    firstSession: dates[0],
    lastSession: dates[dates.length - 1],
  }
}

// ---------------------------------------------------------------- writing

/** Structural equality on plain JSON values, ignoring key order and undefined fields. */
export const sameJson = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameJson(v, b[i]))
  }
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) if (!sameJson(a[k], b[k])) return false
    return true
  }
  return false
}

export interface SerializedBackup {
  json: string
  counts: BackupCounts
  /** Entries in the app's own data that would not survive a restore (should always be empty). */
  problems: string[]
}

/**
 * Turns a backup into file text and proves the text is good before anyone relies on it:
 * the text is read back with the same reader a restore uses, and must contain every
 * exercise and session. Throws BackupError if the written text does not match the data.
 */
export const serializeBackup = (data: ExportData): SerializedBackup => {
  const json = JSON.stringify(data, null, 2)
  const back = parseBackup(json)
  const expected = countData(data)
  const complete =
    back.counts.sessions === expected.sessions &&
    back.counts.exercises === expected.exercises &&
    back.counts.sets === expected.sets &&
    sameJson(back.data.sessions, data.sessions) &&
    sameJson(back.data.exercises, data.exercises)
  if (!complete && back.problems.length === 0) {
    throw new BackupError('The backup did not match your data when it was read back, so it was not saved.')
  }
  return { json, counts: expected, problems: back.problems }
}

// ---------------------------------------------------------------- restoring

/** Preset fields the user can change in the edit form; kept across library updates once edited. */
const USER_FIELDS = ['name', 'muscle', 'equipment', 'repMin', 'repMax', 'sets', 'unilateral'] as const

/**
 * Presets are owned by the code: their definition is refreshed from the library so
 * updates reach existing installs. What the user did to them is kept: an archived
 * (deleted) preset stays hidden, and an edited one keeps the edited fields.
 * Custom exercises are always kept. Presets retired from the library are kept only
 * while sessions are logged against them, and lose their image and muscle map.
 */
export const reconcileExercises = (stored: Exercise[], sessions: Session[], presets: Exercise[]): Exercise[] => {
  const byId = new Map(stored.map((e) => [e.id, e]))
  const refreshed = presets.map((preset) => {
    const old = byId.get(preset.id)
    if (!old) return preset
    const out: Exercise = { ...preset }
    if (old.edited) {
      const o = old as unknown as Obj
      const target = out as unknown as Obj
      for (const k of USER_FIELDS) if (o[k] !== undefined) target[k] = o[k]
      out.edited = true
    }
    if (old.archived !== undefined) out.archived = old.archived
    return out
  })
  const presetIds = new Set(presets.map((e) => e.id))
  const logged = new Set(sessions.map((x) => x.exerciseId))
  const extras = stored
    .filter((e) => !presetIds.has(e.id) && (e.custom || logged.has(e.id)))
    .map((e) => ({
      ...e,
      repMin: e.repMin ?? 8,
      repMax: e.repMax ?? 12,
      sets: e.sets ?? 3,
      image: false,
      ...(e.custom ? {} : { primary: undefined, secondary: undefined }),
    }))
  return [...refreshed, ...extras]
}

/** True when the user has done nothing to this exercise on this device. */
const untouched = (e: Exercise): boolean => !e.custom && !e.edited && !e.archived

/**
 * Adds a backup to what is already on the device without losing anything from either side.
 * Sessions and exercises are matched by id; when both sides have one, the device's copy
 * wins, except that an untouched preset takes the backup's edits.
 */
export const mergeData = (current: AppData, file: AppData): AppData => {
  const fileEx = new Map(file.exercises.map((e) => [e.id, e]))
  const haveEx = new Set(current.exercises.map((e) => e.id))
  const exercises = current.exercises.map((e) => {
    const f = fileEx.get(e.id)
    return f && untouched(e) && !untouched(f) ? f : e
  })
  for (const e of file.exercises) if (!haveEx.has(e.id)) exercises.push(e)

  const haveSes = new Set(current.sessions.map((s) => s.id))
  const sessions = [...current.sessions, ...file.sessions.filter((s) => !haveSes.has(s.id))]
  return { unit: current.unit, exercises, sessions }
}

/** The app data after restoring a backup, either added to the device's data or replacing it. */
export const applyBackup = (current: AppData, file: AppData, mode: 'merge' | 'replace', presets: Exercise[]): AppData => {
  const next = mode === 'replace' ? { unit: file.unit, exercises: file.exercises, sessions: file.sessions } : mergeData(current, file)
  return { ...next, exercises: reconcileExercises(next.exercises, next.sessions, presets) }
}

export interface BackupComparison {
  /** Sessions in the file that the device does not have. */
  newSessions: number
  /** Sessions on the device that the file does not have (lost by "replace"). */
  deviceOnlySessions: number
  /** Sessions both have, but with different contents. */
  changedSessions: number
  /** Custom exercises in the file that the device does not have. */
  newCustomExercises: number
  /** Custom exercises on the device that the file does not have (lost by "replace"). */
  deviceOnlyCustomExercises: number
}

export const compareBackup = (current: AppData, file: AppData): BackupComparison => {
  const mine = new Map(current.sessions.map((s) => [s.id, s]))
  const theirs = new Set(file.sessions.map((s) => s.id))
  let newSessions = 0
  let changedSessions = 0
  for (const s of file.sessions) {
    const m = mine.get(s.id)
    if (!m) newSessions += 1
    else if (!sameJson(m, s)) changedSessions += 1
  }
  const myCustom = new Set(current.exercises.filter((e) => e.custom).map((e) => e.id))
  const fileCustom = new Set(file.exercises.filter((e) => e.custom).map((e) => e.id))
  return {
    newSessions,
    changedSessions,
    deviceOnlySessions: current.sessions.filter((s) => !theirs.has(s.id)).length,
    newCustomExercises: [...fileCustom].filter((id) => !myCustom.has(id)).length,
    deviceOnlyCustomExercises: [...myCustom].filter((id) => !fileCustom.has(id)).length,
  }
}

// ---------------------------------------------------------------- what has changed since a backup

/**
 * A fingerprint of everything a backup file contained: one short hash per session and
 * per exercise the user created or changed. Comparing the current data with it gives the
 * real difference from the last backup, so adding a session and deleting it again counts
 * as no change.
 */
export interface BackupSnapshot {
  /** session id -> content hash */
  s: Record<string, string>
  /** exercise id -> content hash, only for custom, edited or deleted (archived) exercises */
  e: Record<string, string>
}

/** cyrb53: a small, well-distributed 53-bit string hash. */
const hash = (str: string): string => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const sessionHash = (x: Session): string =>
  hash(JSON.stringify([x.exerciseId, x.date, x.note ?? '', x.sets.map((set) => [set.weight, set.reps])]))

/** Only what the user controls: library-owned fields of built-in exercises may change with app updates. */
const exerciseHash = (x: Exercise): string =>
  hash(
    JSON.stringify([
      x.name, x.muscle, x.equipment, x.repMin, x.repMax, x.sets,
      !!x.unilateral, !!x.timed, !!x.archived, !!x.edited, !!x.custom,
      x.custom ? [x.primary ?? [], x.secondary ?? []] : 0,
    ]),
  )

export const snapshotOf = (d: Pick<AppData, 'exercises' | 'sessions'>): BackupSnapshot => ({
  s: Object.fromEntries(d.sessions.map((x) => [x.id, sessionHash(x)])),
  e: Object.fromEntries(d.exercises.filter((x) => !untouched(x)).map((x) => [x.id, exerciseHash(x)])),
})

/**
 * How many sessions and exercises differ from the last backup: added, edited or deleted,
 * each counted once. With no snapshot (never backed up) everything counts.
 */
export const countChanges = (d: Pick<AppData, 'exercises' | 'sessions'>, last: BackupSnapshot | undefined): number => {
  const now = snapshotOf(d)
  const diff = (a: Record<string, string>, b: Record<string, string>): number => {
    let n = 0
    for (const id in a) if (b[id] !== a[id]) n += 1 // new or edited
    for (const id in b) if (!(id in a)) n += 1 // deleted
    return n
  }
  return diff(now.s, last?.s ?? {}) + diff(now.e, last?.e ?? {})
}
