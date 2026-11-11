import type { Muscle } from 'react-body-highlighter'

export type Unit = 'kg' | 'lb'
export type { Muscle }

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Legs'
  | 'Glutes'
  | 'Core'
  | 'Full body'

export type Equipment = 'Machine' | 'Barbell' | 'Dumbbell' | 'Kettlebell' | 'Cable' | 'Bodyweight' | 'Smith'

export interface Exercise {
  id: string
  name: string
  muscle: MuscleGroup
  equipment: Equipment
  /** Recommended working rep range, drives the progression suggestion. */
  repMin: number
  repMax: number
  /** Recommended number of working sets. */
  sets: number
  custom: boolean
  /** True when illustrations exist at public/exercises/<id>/{start,end}.webp */
  image?: boolean
  /** True when the illustration is a single frame (held poses, or where only one correct frame exists). */
  single?: boolean
  /** Caption for a single-frame illustration; defaults to "Hold". */
  caption?: string
  /** True when the render is a wide 3:1 image (lying exercises); shown stacked instead of side by side. */
  wide?: boolean
  /** Reps are counted per side (one arm / one leg at a time). */
  unilateral?: boolean
  /** "Reps" are seconds (planks, carries). */
  timed?: boolean
  /** Target muscles, as react-body-highlighter slugs. */
  primary?: Muscle[]
  secondary?: Muscle[]
  archived?: boolean
}

export interface SetEntry {
  weight: number
  reps: number
}

export interface Session {
  id: string
  exerciseId: string
  /** ISO timestamp */
  date: string
  sets: SetEntry[]
  note?: string
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Legs',
  'Glutes',
  'Core',
  'Full body',
]

export const EQUIPMENT: Equipment[] = ['Machine', 'Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Bodyweight', 'Smith']

/** Quick presets for the rep-range picker. */
export const REP_GOALS: { label: string; hint: string; min: number; max: number; sets: number }[] = [
  { label: 'Strength', hint: 'Heavy compounds', min: 4, max: 6, sets: 4 },
  { label: 'Muscle', hint: 'Most exercises', min: 8, max: 12, sets: 3 },
  { label: 'Isolation', hint: 'Small muscles, cables', min: 10, max: 15, sets: 3 },
  { label: 'Endurance', hint: 'Calves, abs, bodyweight', min: 12, max: 20, sets: 3 },
]

/** Muscle picker options for custom exercises (react-body-highlighter slugs). */
export const MUSCLE_OPTIONS: { slug: Muscle; label: string }[] = [
  { slug: 'chest', label: 'Chest' },
  { slug: 'front-deltoids', label: 'Front delts' },
  { slug: 'back-deltoids', label: 'Rear delts' },
  { slug: 'trapezius', label: 'Traps' },
  { slug: 'upper-back', label: 'Upper back / lats' },
  { slug: 'lower-back', label: 'Lower back' },
  { slug: 'biceps', label: 'Biceps' },
  { slug: 'triceps', label: 'Triceps' },
  { slug: 'forearm', label: 'Forearms' },
  { slug: 'abs', label: 'Abs' },
  { slug: 'obliques', label: 'Obliques' },
  { slug: 'gluteal', label: 'Glutes' },
  { slug: 'quadriceps', label: 'Quads' },
  { slug: 'hamstring', label: 'Hamstrings' },
  { slug: 'adductor', label: 'Adductors' },
  { slug: 'abductors', label: 'Abductors' },
  { slug: 'calves', label: 'Calves' },
  { slug: 'neck', label: 'Neck' },
]
