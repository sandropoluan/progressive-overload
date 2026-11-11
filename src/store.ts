import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PRESET_EXERCISES } from './data/presets'
import { uid } from './lib/utils'
import type { Exercise, MuscleGroup, Session, SetEntry, Unit } from './types'

export interface ExportData {
  version: 1
  exportedAt: string
  unit: Unit
  exercises: Exercise[]
  sessions: Session[]
}

export type HomeFilter = 'All' | 'Recent' | MuscleGroup

interface State {
  unit: Unit
  exercises: Exercise[]
  sessions: Session[]

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

      home: { query: '', filter: 'All', scrollY: 0 },
      setHome: (patch) => set((s) => ({ home: { ...s.home, ...patch } })),

      setUnit: (unit) => set({ unit }),

      addExercise: (e) => {
        const exercise: Exercise = { ...e, id: uid(), custom: true, image: false }
        set((s) => ({ exercises: [...s.exercises, exercise] }))
        return exercise
      },
      updateExercise: (id, patch) =>
        set((s) => ({ exercises: s.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      deleteExercise: (id) =>
        set((s) => ({
          exercises: s.exercises.filter((e) => e.id !== id),
          sessions: s.sessions.filter((x) => x.exerciseId !== id),
        })),

      addSession: (exerciseId, sets, date, note) => {
        const session: Session = {
          id: uid(),
          exerciseId,
          date: date ?? new Date().toISOString(),
          sets: cleanSets(sets),
          note: note?.trim() || undefined,
        }
        set((s) => ({ sessions: [...s.sessions, session] }))
        return session
      },
      updateSession: (id, patch) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.id === id ? { ...x, ...patch, sets: patch.sets ? cleanSets(patch.sets) : x.sets } : x,
          ),
        })),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),

      importData: (data, mode) => {
        if (mode === 'replace') {
          set({ unit: data.unit ?? 'kg', exercises: data.exercises, sessions: data.sessions })
          return
        }
        const { exercises, sessions } = get()
        const exIds = new Set(exercises.map((e) => e.id))
        const sesIds = new Set(sessions.map((s) => s.id))
        set({
          exercises: [...exercises, ...data.exercises.filter((e) => !exIds.has(e.id))],
          sessions: [...sessions, ...data.sessions.filter((s) => !sesIds.has(s.id))],
        })
      },
      resetAll: () => set({ unit: 'kg', exercises: PRESET_EXERCISES, sessions: [] }),
    }),
    {
      name: 'overload.v1',
      version: 1,
      // Presets are owned by the code: refresh their name/range/image on every load so
      // updates reach existing installs, but keep per-user flags (archived) and any
      // custom or retired exercises the user still has sessions for.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        const stored = p.exercises ?? []
        const byId = new Map(stored.map((e) => [e.id, e]))
        const refreshed = PRESET_EXERCISES.map((preset) => {
          const old = byId.get(preset.id)
          return old ? { ...preset, archived: old.archived } : preset
        })
        const presetIds = new Set(PRESET_EXERCISES.map((e) => e.id))
        const logged = new Set((p.sessions ?? []).map((x) => x.exerciseId))
        // Custom exercises are always kept. Presets that were retired from the library are kept
        // only when the user has logged them (so history survives) and lose their image flag,
        // because the media files for them no longer ship with the app.
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
        return { ...current, ...p, exercises: [...refreshed, ...extras] }
      },
      partialize: (s) => ({ unit: s.unit, exercises: s.exercises, sessions: s.sessions }),
    },
  ),
)

export const exportData = (): ExportData => {
  const { unit, exercises, sessions } = useStore.getState()
  return { version: 1, exportedAt: new Date().toISOString(), unit, exercises, sessions }
}

export const isExportData = (v: unknown): v is ExportData =>
  typeof v === 'object' &&
  v !== null &&
  Array.isArray((v as ExportData).exercises) &&
  Array.isArray((v as ExportData).sessions)
