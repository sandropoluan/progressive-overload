/**
 * Backup and restore tests. Run with `npm test`.
 *
 * These exercise the same code the app uses to write a backup file and to read one back
 * (src/lib/backupFormat.ts), against the real exercise library.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PRESET_EXERCISES } from '../src/data/presets.ts'
import {
  applyBackup,
  BackupError,
  buildBackup,
  compareBackup,
  countChanges,
  countData,
  mergeData,
  parseBackup,
  reconcileExercises,
  sameJson,
  serializeBackup,
  snapshotOf,
  type AppData,
} from '../src/lib/backupFormat.ts'
import type { Exercise, Session } from '../src/types.ts'

/** What actually lands on disk and comes back: undefined fields dropped, like JSON does. */
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const custom = (id: string, patch: Partial<Exercise> = {}): Exercise => ({
  id,
  name: `Custom ${id}`,
  muscle: 'Back',
  equipment: 'Cable',
  repMin: 10,
  repMax: 15,
  sets: 3,
  custom: true,
  image: false,
  primary: ['upper-back'],
  secondary: ['biceps', 'forearm'],
  unilateral: false,
  ...patch,
})

const session = (id: string, exerciseId: string, day: number, sets: [number, number][], note?: string): Session => ({
  id,
  exerciseId,
  date: new Date(Date.UTC(2026, 10, day, 17, 30, id.length)).toISOString(),
  sets: sets.map(([weight, reps]) => ({ weight, reps })),
  ...(note ? { note } : {}),
})

/** A device with every kind of data the app can produce. */
const richState = (): AppData => {
  const exercises: Exercise[] = PRESET_EXERCISES.map((e) => ({ ...e }))
  // A built-in exercise the user edited, and one the user deleted (hidden).
  Object.assign(exercises[0], { name: 'My Bench', repMin: 3, repMax: 5, sets: 5, unilateral: true, edited: true })
  Object.assign(exercises[1], { archived: true })
  exercises.push(
    custom('c-1'),
    custom('c-2', { name: 'Câble « row » 日本語 🏋️ "quoted" \\ back\nslash', unilateral: true, primary: [], secondary: [] }),
    custom('c-3', { muscle: 'Full body', equipment: 'Kettlebell', timed: true }),
  )
  const sessions: Session[] = [
    session('s-1', exercises[0].id, 11, [[60, 5], [62.5, 5], [62.5, 4]]),
    session('s-2', exercises[2].id, 11, [[0, 12], [0, 10]], 'bodyweight only'),
    session('s-3', 'c-1', 12, [[27.5, 15], [27.5, 14], [27.5, 12], [25, 12]], 'felt "easy" — add 2.5kg\nnext time 💪'),
    session('s-4', 'c-2', 12, [[12.25, 8]]),
    session('s-5', 'c-3', 13, [[16, 45], [16, 40]]),
    session('s-6', exercises[0].id, 13, [[65, 5], [65, 5], [65, 5], [65, 5], [65, 5]]),
    session('s-7', exercises[5].id, 13, [[-10, 8]], 'assisted'),
  ]
  return { unit: 'kg', exercises, sessions }
}

const fresh = (): AppData => ({ unit: 'kg', exercises: PRESET_EXERCISES.map((e) => ({ ...e })), sessions: [] })
const fileOf = (state: AppData) => serializeBackup(buildBackup(state, new Date('2026-11-13T10:00:00Z')))
const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]))

// ------------------------------------------------------------ what is exported

test('1. every exercise is exported: all built-in ones and all custom ones', () => {
  const state = richState()
  const { data, problems } = parseBackup(fileOf(state).json)
  assert.deepEqual(problems, [])
  const ids = new Set(data.exercises.map((e) => e.id))
  for (const p of PRESET_EXERCISES) assert.ok(ids.has(p.id), `built-in exercise ${p.id} missing from backup`)
  for (const id of ['c-1', 'c-2', 'c-3']) assert.ok(ids.has(id), `custom exercise ${id} missing from backup`)
  assert.equal(data.exercises.length, PRESET_EXERCISES.length + 3)
})

test('1b. every built-in exercise comes back from the file exactly as written', () => {
  const { data } = parseBackup(fileOf(fresh()).json)
  const back = byId(data.exercises)
  for (const p of PRESET_EXERCISES) assert.deepEqual(back.get(p.id), json(p), `built-in exercise ${p.id} changed in the file`)
})

test('2. custom and edited exercises come back with every field intact', () => {
  const state = richState()
  const back = byId(parseBackup(fileOf(state).json).data.exercises)
  for (const e of state.exercises.filter((x) => x.custom || x.edited || x.archived)) {
    assert.deepEqual(back.get(e.id), json(e), `exercise ${e.id} changed in the file`)
  }
  assert.equal(back.get(PRESET_EXERCISES[0].id)?.name, 'My Bench')
  assert.equal(back.get(PRESET_EXERCISES[1].id)?.archived, true)
})

test('3. every session comes back: same sets, weights, reps, dates and notes', () => {
  const state = richState()
  const { data, counts } = parseBackup(fileOf(state).json)
  assert.deepEqual(data.sessions, json(state.sessions))
  assert.equal(counts.sessions, 7)
  assert.equal(counts.sets, state.sessions.reduce((n, s) => n + s.sets.length, 0))
  assert.equal(data.unit, 'kg')
})

test('3b. pounds are kept as pounds', () => {
  const state = { ...richState(), unit: 'lb' as const }
  assert.equal(parseBackup(fileOf(state).json).data.unit, 'lb')
})

// ------------------------------------------------------------ file structure

test('4. the file has the documented structure and counts that match its contents', () => {
  const state = richState()
  const raw = JSON.parse(fileOf(state).json)
  assert.deepEqual(Object.keys(raw).sort(), ['counts', 'exercises', 'exportedAt', 'sessions', 'unit', 'version'])
  assert.equal(raw.version, 1)
  assert.equal(raw.exportedAt, '2026-11-13T10:00:00.000Z')
  assert.deepEqual(raw.counts, countData(state))
  assert.deepEqual(raw.counts, { exercises: PRESET_EXERCISES.length + 3, customExercises: 3, sessions: 7, sets: 18 })
  for (const s of raw.sessions) {
    assert.equal(typeof s.id, 'string')
    assert.equal(typeof s.exerciseId, 'string')
    assert.ok(Number.isFinite(Date.parse(s.date)))
    assert.ok(Array.isArray(s.sets) && s.sets.length > 0)
    for (const set of s.sets) assert.ok(Number.isFinite(set.weight) && Number.isInteger(set.reps) && set.reps > 0)
  }
})

test('4b. writing a backup proves itself: the text is read back and matches the data', () => {
  const state = richState()
  const out = fileOf(state)
  assert.deepEqual(out.problems, [])
  assert.deepEqual(out.counts, countData(state))
  // Writing twice gives byte-identical text.
  assert.equal(out.json, fileOf(state).json)
})

test('4c. a backup written from data with a broken entry says so instead of looking healthy', () => {
  const state = richState()
  state.sessions.push({ id: 'bad', exerciseId: 'c-1', date: 'not a date', sets: [{ weight: 10, reps: 5 }] })
  const out = fileOf(state)
  assert.equal(out.problems.length > 0, true)
  assert.match(out.problems.join(' '), /1 session could not be read/)
})

// ------------------------------------------------------------ damaged files

test('5. a cut-off file is always rejected, never read as a smaller backup', () => {
  const text = fileOf(richState()).json
  // Cut at many points across the file, including inside the sessions at the end.
  const cuts = new Set<number>()
  for (let i = 1; i < 400; i++) cuts.add(Math.floor((text.length * i) / 400))
  for (let i = 1; i <= 600; i++) cuts.add(text.length - i)
  for (const at of cuts) {
    assert.throws(() => parseBackup(text.slice(0, at)), BackupError, `a file cut at ${at} of ${text.length} was accepted`)
  }
})

test('5b. files that are not backups are rejected', () => {
  for (const bad of ['', '   ', 'hello', '[]', '{}', 'null', '42', '{"exercises":[]}', '{"sessions":[]}', '{"exercises":{},"sessions":[]}']) {
    assert.throws(() => parseBackup(bad), BackupError, `accepted: ${bad}`)
  }
  assert.throws(() => parseBackup(JSON.stringify({ version: 2, exercises: [], sessions: [] })), /newer version/)
})

test('5c. damaged entries are reported and skipped; healthy entries are all kept', () => {
  const state = richState()
  const raw = JSON.parse(fileOf(state).json)
  raw.sessions.push(
    { id: 'x1', exerciseId: 'c-1', date: 'garbage', sets: [{ weight: 10, reps: 5 }] }, // bad date
    { id: 'x2', exerciseId: 'c-1', date: '2026-11-13T10:00:00.000Z' }, // no sets
    { id: 'x3', exerciseId: 'c-1', date: '2026-11-13T10:00:00.000Z', sets: [] }, // empty sets
    { id: 'x4', exerciseId: 'c-1', date: '2026-11-13T10:00:00.000Z', sets: [{ weight: null, reps: 5 }] }, // NaN weight
    { exerciseId: 'c-1', date: '2026-11-13T10:00:00.000Z', sets: [{ weight: 10, reps: 5 }] }, // no id
    'not an object',
    { id: 'x5', exerciseId: 'c-1', date: '2026-11-13T10:00:00.000Z', sets: [{ weight: 10, reps: 5 }, { weight: 'heavy', reps: 5 }] }, // one bad set
    { ...raw.sessions[0] }, // duplicate id
  )
  raw.exercises.push({ name: 'no id' }, { id: 'c-9', name: 'Odd', muscle: 'Wings', equipment: 'Rocket', repMin: 'x', repMax: 12, sets: 3, custom: true })
  const { data, problems } = parseBackup(JSON.stringify(raw))

  // All seven original sessions survive untouched, plus the one with a single bad set.
  assert.deepEqual(data.sessions.slice(0, 7), json(state.sessions))
  assert.deepEqual(data.sessions.map((s) => s.id), ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6', 's-7', 'x5'])
  assert.deepEqual(data.sessions[7].sets, [{ weight: 10, reps: 5 }])
  const all = problems.join(' | ')
  assert.match(all, /6 sessions could not be read/)
  assert.match(all, /1 session had damaged sets/)
  assert.match(all, /1 duplicate session ignored/)
  assert.match(all, /1 exercise could not be read/)
  assert.match(all, /1 exercise had damaged settings/)
  // The file's own counts no longer match, which is reported too.
  assert.match(all, /The file says it holds 7 sessions but 8 could be read/)
  const odd = byId(data.exercises).get('c-9')
  assert.deepEqual([odd?.muscle, odd?.equipment, odd?.repMin], ['Full body', 'Machine', 8])
})

test('5d. entries deleted from a file by hand are noticed through the counts', () => {
  const raw = JSON.parse(fileOf(richState()).json)
  raw.sessions.splice(2, 2)
  const { problems } = parseBackup(JSON.stringify(raw))
  assert.match(problems.join(' | '), /The file says it holds 7 sessions but 5 could be read/)
  assert.match(problems.join(' | '), /The file says it holds 18 sets/)
})

test('5e. backups written before counts existed still open cleanly', () => {
  const state = richState()
  const old = { version: 1, exportedAt: '2026-11-11T10:57:35.777Z', unit: 'kg', exercises: state.exercises, sessions: state.sessions }
  const { data, problems } = parseBackup(JSON.stringify(old, null, 2))
  assert.deepEqual(problems, [])
  assert.deepEqual(data.sessions, json(state.sessions))
})

// ------------------------------------------------------------ restoring

/** What the app holds after the given data has been saved and the app restarted. */
const afterRestart = (state: AppData): AppData => json({ ...state, exercises: reconcileExercises(state.exercises, state.sessions, PRESET_EXERCISES) })

test('6. restore onto an empty device (Add): everything is back exactly', () => {
  const state = richState()
  const file = parseBackup(fileOf(state).json).data
  const restored = json(applyBackup(fresh(), file, 'merge', PRESET_EXERCISES))
  const expected = afterRestart(state)
  assert.deepEqual(restored.sessions, expected.sessions)
  assert.deepEqual(byId(restored.exercises), byId(expected.exercises))
  assert.equal(restored.exercises.length, expected.exercises.length)
  // The edited and deleted built-in exercises are restored as edited and deleted.
  const ex = byId(restored.exercises)
  assert.deepEqual(
    [ex.get(PRESET_EXERCISES[0].id)?.name, ex.get(PRESET_EXERCISES[0].id)?.repMin, ex.get(PRESET_EXERCISES[0].id)?.repMax, ex.get(PRESET_EXERCISES[0].id)?.sets, ex.get(PRESET_EXERCISES[0].id)?.unilateral],
    ['My Bench', 3, 5, 5, true],
  )
  assert.equal(ex.get(PRESET_EXERCISES[1].id)?.archived, true)
  assert.deepEqual(compareBackup(restored, file), { newSessions: 0, deviceOnlySessions: 0, changedSessions: 0, newCustomExercises: 0, deviceOnlyCustomExercises: 0 })
})

test('6b. restore onto an empty device (Replace): everything is back exactly', () => {
  const state = richState()
  const file = parseBackup(fileOf(state).json).data
  const restored = json(applyBackup(fresh(), file, 'replace', PRESET_EXERCISES))
  assert.deepEqual(restored, afterRestart(state))
})

test('6c. a restored device survives an app restart unchanged, and backs up to the same data again', () => {
  const state = richState()
  const file = parseBackup(fileOf(state).json).data
  const restored = json(applyBackup(fresh(), file, 'merge', PRESET_EXERCISES))
  assert.deepEqual(afterRestart(restored), restored)
  const second = parseBackup(fileOf(restored).json)
  assert.deepEqual(second.problems, [])
  assert.deepEqual(second.data.sessions, restored.sessions)
  assert.ok(sameJson(byId(second.data.exercises).get('c-2'), byId(state.exercises).get('c-2')))
})

test('6d. Add never loses or duplicates what is already on the device', () => {
  const state = richState()
  const file = parseBackup(fileOf(state).json).data
  // The device moved on after the backup: a new session, an edited session, a deleted one, a new custom exercise.
  const device = json(state)
  device.sessions = device.sessions.filter((s) => s.id !== 's-4')
  device.sessions.find((s) => s.id === 's-1')!.sets[0].reps = 6
  device.sessions.push(session('s-new', 'c-new', 14, [[30, 10]]))
  device.exercises.push(custom('c-new'))

  assert.deepEqual(compareBackup(device, file), { newSessions: 1, deviceOnlySessions: 1, changedSessions: 1, newCustomExercises: 0, deviceOnlyCustomExercises: 1 })
  const merged = mergeData(device, file)
  assert.equal(merged.sessions.length, 8)
  assert.equal(new Set(merged.sessions.map((s) => s.id)).size, 8)
  assert.equal(merged.sessions.find((s) => s.id === 's-1')?.sets[0].reps, 6, "the device's newer edit must win")
  assert.ok(merged.sessions.some((s) => s.id === 's-new') && merged.sessions.some((s) => s.id === 's-4'))
  assert.equal(merged.exercises.filter((e) => e.custom).length, 4)
  assert.equal(new Set(merged.exercises.map((e) => e.id)).size, merged.exercises.length)
  // Adding the same file a second time changes nothing.
  assert.deepEqual(mergeData(merged, file), merged)
})

test('6e. a session whose exercise is missing from the file is kept and flagged', () => {
  const raw = JSON.parse(fileOf(richState()).json)
  raw.exercises = raw.exercises.filter((e: Exercise) => e.id !== 'c-3')
  raw.counts = undefined
  const { data, problems } = parseBackup(JSON.stringify(raw))
  assert.equal(data.sessions.length, 7)
  assert.match(problems.join(' '), /1 session belongs to an exercise that is not in this file/)
})

// ------------------------------------------------------------ library updates

test('7. app updates refresh built-in exercises without touching the user’s edits or custom exercises', () => {
  const stored = richState()
  // Pretend this data was saved by an older app: built-in definitions were different back then.
  const oldDefinition = stored.exercises[3]
  Object.assign(oldDefinition, { name: 'Old library name', repMin: 99, image: false })
  // ...and one built-in exercise has since been retired from the library, with and without history.
  stored.exercises.push(
    { id: 'retired-logged', name: 'Retired (logged)', muscle: 'Legs', equipment: 'Machine', repMin: 8, repMax: 12, sets: 3, custom: false, image: true, primary: ['quadriceps'] },
    { id: 'retired-unused', name: 'Retired (unused)', muscle: 'Legs', equipment: 'Machine', repMin: 8, repMax: 12, sets: 3, custom: false, image: true },
  )
  stored.sessions.push(session('s-r', 'retired-logged', 12, [[100, 10]]))

  const now = byId(reconcileExercises(stored.exercises, stored.sessions, PRESET_EXERCISES))
  assert.deepEqual(now.get(PRESET_EXERCISES[3].id), PRESET_EXERCISES[3], 'an untouched built-in exercise follows the library')
  const edited = now.get(PRESET_EXERCISES[0].id)!
  assert.deepEqual([edited.name, edited.repMin, edited.repMax, edited.sets, edited.edited], ['My Bench', 3, 5, 5, true])
  assert.equal(edited.image, PRESET_EXERCISES[0].image, 'an edited built-in exercise still gets library media')
  assert.equal(now.get(PRESET_EXERCISES[1].id)?.archived, true)
  assert.deepEqual(json(now.get('c-2')), json(stored.exercises.find((e) => e.id === 'c-2')))
  assert.equal(now.get('retired-logged')?.image, false)
  assert.equal(now.has('retired-unused'), false)
})

// ------------------------------------------------------------ size

test('8. years of training round-trip: 6,000 sessions, nothing lost or reordered', () => {
  const state = fresh()
  state.exercises.push(custom('c-1'))
  const ids = [...PRESET_EXERCISES.map((e) => e.id), 'c-1']
  for (let i = 0; i < 6000; i++) {
    state.sessions.push({
      id: `big-${i}`,
      exerciseId: ids[i % ids.length],
      date: new Date(Date.UTC(2024, 0, 1) + i * 3_600_000 * 5).toISOString(),
      sets: Array.from({ length: 1 + (i % 6) }, (_, k) => ({ weight: ((i * 7 + k) % 400) / 4, reps: 1 + ((i + k) % 30) })),
      ...(i % 9 === 0 ? { note: `note ${i} ✓` } : {}),
    })
  }
  const out = fileOf(state)
  assert.deepEqual(out.problems, [])
  const { data, counts, firstSession, lastSession } = parseBackup(out.json)
  assert.equal(counts.sessions, 6000)
  assert.deepEqual(data.sessions, state.sessions)
  assert.equal(firstSession, state.sessions[0].date)
  assert.equal(lastSession, state.sessions[5999].date)
  const restored = applyBackup(fresh(), data, 'merge', PRESET_EXERCISES)
  assert.deepEqual(restored.sessions, state.sessions)
})

// ------------------------------------------------------------ "N changes not backed up"

test('9. the change count is the real difference from the last backup', () => {
  const state = richState()
  assert.equal(countChanges(state, undefined), 7 + 5, 'never backed up: 7 sessions + 3 custom, 1 edited, 1 deleted exercise')
  const backup = snapshotOf(state)
  assert.equal(countChanges(state, backup), 0)

  // Add a session, delete it again: back to zero, not two.
  const added = session('s-tmp', 'c-1', 14, [[30, 10]])
  state.sessions.push(added)
  assert.equal(countChanges(state, backup), 1)
  state.sessions = state.sessions.filter((s) => s.id !== 's-tmp')
  assert.equal(countChanges(state, backup), 0)

  // The reported case: two real changes, then add/delete, add/delete, add.
  state.sessions.push(session('k-1', 'c-1', 14, [[30, 10]]), session('k-2', 'c-2', 14, [[10, 8]]))
  assert.equal(countChanges(state, backup), 2)
  state.sessions.push(session('t-1', 'c-1', 14, [[30, 10]]))
  assert.equal(countChanges(state, backup), 3)
  state.sessions = state.sessions.filter((s) => s.id !== 't-1')
  assert.equal(countChanges(state, backup), 2)
  state.sessions.push(session('t-2', 'c-3', 14, [[16, 30]]))
  state.sessions = state.sessions.filter((s) => s.id !== 't-2')
  assert.equal(countChanges(state, backup), 2)
  state.sessions.push(session('k-3', 'c-3', 14, [[16, 30]]))
  assert.equal(countChanges(state, backup), 3)
})

test('9b. edits and deletions count once each, and undoing an edit clears it', () => {
  const state = richState()
  const backup = snapshotOf(state)
  const s1 = state.sessions.find((s) => s.id === 's-1')!
  s1.sets[0].reps = 6
  assert.equal(countChanges(state, backup), 1, 'one edited session')
  s1.sets[0].reps = 7
  assert.equal(countChanges(state, backup), 1, 'editing the same session again is still one change')
  s1.sets[0].reps = 5
  assert.equal(countChanges(state, backup), 0, 'edited back to what the backup holds')
  s1.note = 'new note'
  assert.equal(countChanges(state, backup), 1, 'a note counts')
  s1.note = undefined

  state.sessions = state.sessions.filter((s) => s.id !== 's-2')
  assert.equal(countChanges(state, backup), 1, 'a session deleted since the backup is one change')

  const c1 = state.exercises.find((e) => e.id === 'c-1')!
  c1.repMax = 20
  assert.equal(countChanges(state, backup), 2, 'an edited custom exercise')
  state.exercises.push(custom('c-new'))
  assert.equal(countChanges(state, backup), 3, 'a new custom exercise')
  // Editing a built-in exercise for the first time.
  Object.assign(state.exercises[7], { repMin: 4, edited: true })
  assert.equal(countChanges(state, backup), 4)
})

test('9c. app updates to built-in exercises are not counted as your changes', () => {
  const state = richState()
  const backup = snapshotOf(state)
  // The library changes media and muscle maps of built-in exercises, including an edited one.
  Object.assign(state.exercises[0], { image: false, wide: true, primary: ['chest'], caption: 'x' })
  Object.assign(state.exercises[9], { name: 'Renamed by the library', repMin: 5, image: false })
  assert.equal(countChanges(state, backup), 0)
})

test('9d. after backing up, and after restoring on a new device, the count is zero', () => {
  const state = richState()
  const file = parseBackup(fileOf(state).json).data
  // Same device, right after the backup: fingerprint of what went into the file.
  assert.equal(countChanges(state, snapshotOf(buildBackup(state))), 0)
  // New device after restore: the app takes the fingerprint of the restored data.
  const restored = applyBackup(fresh(), file, 'merge', PRESET_EXERCISES)
  assert.equal(countChanges(restored, snapshotOf(restored)), 0)
  // ...and that fingerprint is the same one the original device recorded.
  assert.deepEqual(snapshotOf(json(restored)), snapshotOf(json(afterRestart(state))))
  // It also survives being saved and loaded with the rest of the app data.
  assert.equal(countChanges(json(state), json(snapshotOf(state))), 0)
})
