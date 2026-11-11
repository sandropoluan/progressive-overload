import { MUSCLE_OPTIONS, type Exercise } from '../types'

/** Common gym shorthand; each entry is an extra spelling tried alongside the typed word. */
const ALIASES: Record<string, string> = {
  db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell', bw: 'bodyweight',
  ohp: 'overhead press', rdl: 'romanian deadlift', sldl: 'stiff leg deadlift', gm: 'good morning',
  ghr: 'glute ham raise', ez: 'ez bar', lat: 'lats', pecs: 'chest', pec: 'chest',
  delts: 'shoulders', delt: 'shoulders', quads: 'quadriceps', quad: 'quadriceps',
  hams: 'hamstrings', hammies: 'hamstrings', glute: 'glutes', abs: 'core', ab: 'core',
  tri: 'triceps', tris: 'triceps', bi: 'biceps', bis: 'biceps', calf: 'calves', calves: 'calf',
}

// Equipment shorthands whose letters would otherwise match inside other words ("bb" in "dumbbell").
const EXACT_ALIAS = new Set(['db', 'dbs', 'bb', 'kb', 'bw'])

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const compact = (s: string) => norm(s).replace(/\s+/g, '')

const muscleLabel = (slug: string) => MUSCLE_OPTIONS.find((m) => m.slug === slug)?.label ?? slug

/** Everything an exercise can be found by, pre-joined for cheap matching. */
export const searchText = (e: Exercise): { name: string; all: string } => {
  const name = compact(e.name)
  const extra = [e.muscle, e.equipment, ...(e.primary ?? []).map(muscleLabel), ...(e.secondary ?? []).map(muscleLabel), e.custom ? 'custom' : '']
  return { name, all: name + ' ' + compact(extra.join(' ')) }
}

/**
 * Returns a relevance score for a query against an exercise, or -1 for no match.
 * Every query word (after alias expansion) must appear somewhere; words can be in any
 * order and punctuation/spacing is ignored, so "pull up", "pull-up" and "pullup" all match.
 */
export const matchScore = (query: string, text: { name: string; all: string }): number => {
  const words = norm(query).split(' ').filter(Boolean)
  if (words.length === 0) return 0
  // Each typed word may match as typed or via its alias (aliases are compacted so
  // multi-word expansions like "romanian deadlift" act as one token).
  const options = words.map((w) =>
    EXACT_ALIAS.has(w) ? [compact(ALIASES[w])] : ALIASES[w] ? [w, compact(ALIASES[w])] : [w],
  )
  const joined = words.join('')
  if (text.name.startsWith(joined)) return 0
  if (text.name.includes(joined)) return 1
  if (options.every((opts) => opts.some((o) => text.name.includes(o)))) return 2
  if (options.every((opts) => opts.some((o) => text.all.includes(o)))) return 3
  return -1
}
