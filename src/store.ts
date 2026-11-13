import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PRESET_EXERCISES } from './data/presets'
import { applyBackup, buildBackup, reconcileExercises, type ExportData } from './lib/backupFormat'
import { uid } from './lib/utils'
import type { Exercise, MuscleGroup, Session, SetEntry, Unit } from './types'

export type { ExportData }

const PRESET_IDS = new Set(PRESET_EXERCISES.map((e) => e.id))

export type HomeFilter = 'All' | 'Recent' | MuscleGroup

interface State {
  unit: Unit
  exercises: Exercise[]
  sessions: Session[]

  /** When the data was last written to a backup file (ISO timestamp). */
  lastBackupAt?: string
  /** Number of changes (sessions or exercises added, edited, deleted) since that backup. */
  pendingBackup: number
  markBackedUp: () => void

  /** Home screen UI state. Kept in memory only (not persisted) so it survives navigation. */
  home: { query: string; filter: HomeFilter; scrollY: number }
  setHome: (patch: Partial<State['home']>) => void

  setUnit: (unit: Unit) => void
  addExercise: (e: Omit<Exercise, 'id' | 'custom'>) => Exercise
  updateExercise: (id: string, patch: Partial<Omit<Exercise, 'id'>>) => void
  deleteExercise: (id: string) => void

  addSession: (exerciseId: string, sets: SetEntry[], date?: string, note?: string) => Session
  updateSession: (id: string, patch: Partial<Omit<Session, 'id' | 'exerciseId'>>) => void
  deleteSession: (id: string) => void

  importData: (data: ExportData, mode: 'merge' | 'replace') => void
  resetAll: () => void
}

const cleanSets = (sets: SetEntry[]): SetEntry[] =>
  sets
    .map((s) => ({ weight: Number(s.weight) || 0, reps: Math.max(0, Math.round(Number(s.reps) || 0)) }))
    .filter((s) => s.reps > 0)

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      unit: 'kg',
      exercises: PRESET_EXERCISES,
      sessions: [],

      lastBackupAt: undefined,
      pendingBackup: 0,
      markBackedUp: () => set({ lastBackupAt: new Date().toISOString(), pendingBackup: 0 }),

      home: { query: '', filter: 'All', scrollY: 0 },
      setHome: (patch) => set((s) => ({ home: { ...s.home, ...patch } })),

      setUnit: (unit) => set({ unit }),

      addExercise: (e) => {
        const exercise: Exercise = { ...e, id: uid(), custom: true, image: false }
        set((s) => ({ exercises: [...s.exercises, exercise], pendingBackup: s.pendingBackup + 1 }))
        return exercise
      },
      updateExercise: (id, patch) =>
        set((s) => ({
          // Built-in exercises are refreshed from the library on every load; the flag is
          // what makes the user's changes to one survive that (and a backup restore).
          exercises: s.exercises.map((e) => (e.id === id ? { ...e, ...patch, ...(e.custom ? {} : { edited: true }) } : e)),
          pendingBackup: s.pendingBackup + 1,
        })),
      deleteExercise: (id) =>
        set((s) => ({
          // A built-in exercise would come back on the next load if it were simply removed,
          // so it is hidden instead. Custom exercises are removed for real.
          exercises: PRESET_IDS.has(id)
            ? s.exercises.map((e) => (e.id === id ? { ...e, archived: true } : e))
            : s.exercises.filter((e) => e.id !== id),
          sessions: s.sessions.filter((x) => x.exerciseId !== id),
          pendingBackup: s.pendingBackup + 1,
        })),

      addSession: (exerciseId, sets, date, note) => {
        const session: Session = {
          id: uid(),
          exerciseId,
          date: date ?? new Date().toISOString(),
          sets: cleanSets(sets),
          note: note?.trim() || undefined,
        }
        set((s) => ({ sessions: [...s.sessions, session], pendingBackup: s.pendingBackup + 1 }))
        return session
      },
      updateSession: (id, patch) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id ? { ...x, ...patch, sets: patch.sets ? cleanSets(patch.sets) : x.sets } : x,
          ),
          pendingBackup: s.pendingBackup + 1,
        })),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id), pendingBackup: s.pendingBackup + 1 })),

      importData: (data, mode) => {
        const { unit, exercises, sessions, pendingBackup } = get()
        const next = applyBackup({ unit, exercises, sessions }, data, mode, PRESET_EXERCISES)
        // When the device held nothing of its own, it now matches the file exactly, so nothing
        // is waiting for a backup. Otherwise the combined data exists nowhere else yet.
        const matchesFile = mode === 'replace' || (sessions.length === 0 && pendingBackup === 0)
        set({
          ...next,
          ...(matchesFile ? { pendingBackup: 0, lastBackupAt: data.exportedAt } : { pendingBackup: pendingBackup + 1 }),
        })
      },
      resetAll: () => set({ unit: 'kg', exercises: PRESET_EXERCISES, sessions: [], pendingBackup: 0 }),
    }),
    {
      name: 'overload.v1',
      version: 1,
      // Presets are refreshed from the library on every load; see reconcileExercises for what is kept.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        const exercises = reconcileExercises(p.exercises ?? [], p.sessions ?? [], PRESET_EXERCISES)
        // Installs from before backups were tracked: every stored session counts as not backed up.
        const pendingBackup = p.pendingBackup ?? (p.sessions ?? []).length
        return { ...current, ...p, exercises, pendingBackup }
      },
      partialize: (s) => ({ unit: s.unit, exercises: s.exercises, sessions: s.sessions, lastBackupAt: s.lastBackupAt, pendingBackup: s.pendingBackup }),
    },
  ),
)

export const exportData = (): ExportData => {
  const { unit, exercises, sessions } = useStore.getState()
  return buildBackup({ unit, exercises, sessions })
}
