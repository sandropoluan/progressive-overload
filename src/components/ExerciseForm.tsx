import { useState } from 'react'
import { EQUIPMENT, MUSCLE_GROUPS, MUSCLE_OPTIONS, REP_GOALS, type Equipment, type Exercise, type Muscle, type MuscleGroup } from '../types'
import { Sheet } from './Sheet'

export interface ExerciseValues {
  name: string
  muscle: MuscleGroup
  equipment: Equipment
  repMin: number
  repMax: number
  sets: number
  primary: Muscle[]
  secondary: Muscle[]
  unilateral: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (values: ExerciseValues) => void
  initial?: Exercise
}

export function ExerciseForm({ open, onClose, onSubmit, initial }: Props) {
  // Sheet unmounts its children when closed, so the body re-initialises on every open.
  return (
    <Sheet open={open} onClose={onClose} title={initial ? 'Edit exercise' : 'New exercise'}>
      <Body onClose={onClose} onSubmit={onSubmit} initial={initial} />
    </Sheet>
  )
}

const clampInt = (v: string, lo: number, hi: number, fallback: number) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

function Body({ onClose, onSubmit, initial }: Omit<Props, 'open'>) {
  const [name, setName] = useState(initial?.name ?? '')
  const [muscle, setMuscle] = useState<MuscleGroup>(initial?.muscle ?? 'Chest')
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'Machine')
  const [repMin, setRepMin] = useState(String(initial?.repMin ?? 8))
  const [repMax, setRepMax] = useState(String(initial?.repMax ?? 12))
  const [sets, setSets] = useState(String(initial?.sets ?? 3))
  const [primary, setPrimary] = useState<Muscle[]>(initial?.primary ?? [])
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondary ?? [])
  const [unilateral, setUnilateral] = useState(initial?.unilateral ?? false)
  // Each chip cycles: none -> primary -> secondary -> none.
  const cycleMuscle = (m: Muscle) => {
    if (primary.includes(m)) { setPrimary((p) => p.filter((x) => x !== m)); setSecondary((p) => [...p, m]) }
    else if (secondary.includes(m)) setSecondary((p) => p.filter((x) => x !== m))
    else setPrimary((p) => [...p, m])
  }

  const lo = clampInt(repMin, 1, 100, 8)
  const hi = Math.max(lo, clampInt(repMax, 1, 100, 12))
  const nSets = clampInt(sets, 1, 10, 3)
  const valid = name.trim().length > 0
  const activeGoal = REP_GOALS.find((g) => g.min === lo && g.max === hi)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit({ name: name.trim(), muscle, equipment, repMin: lo, repMax: hi, sets: nSets, primary, secondary, unilateral })
      }}
    >
      <div className="field">
        <label htmlFor="ex-name">Name</label>
        <input
          id="ex-name"
          className="input"
          placeholder="e.g. Incline Chest Press (Technogym)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="ex-muscle">Muscle group</label>
        <select id="ex-muscle" className="select" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup)}>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ex-equipment">Equipment</label>
        <select id="ex-equipment" className="select" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
          {EQUIPMENT.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Rep goal</label>
        <div className="goal-grid">
          {REP_GOALS.map((g) => (
            <button
              type="button"
              key={g.label}
              className={`goal ${activeGoal?.label === g.label ? 'active' : ''}`}
              onClick={() => { setRepMin(String(g.min)); setRepMax(String(g.max)); setSets(String(g.sets)) }}
            >
              <div className="g1">{g.label}<span className="num">{g.min}–{g.max}</span></div>
              <div className="g2">{g.hint}</div>
            </button>
          ))}
        </div>
        <label className="check-row">
          <input type="checkbox" checked={unilateral} onChange={(e) => setUnilateral(e.target.checked)} />
          <span>Reps are per side (one arm / one leg at a time)</span>
        </label>
        <div className="range-row">
          <input className="input num" inputMode="numeric" aria-label="Sets" value={sets} onChange={(e) => setSets(e.target.value.replace(/\D/g, ''))} />
          <span className="x">sets ×</span>
          <input className="input num" inputMode="numeric" aria-label="Minimum reps" value={repMin} onChange={(e) => setRepMin(e.target.value.replace(/\D/g, ''))} />
          <span className="x">to</span>
          <input className="input num" inputMode="numeric" aria-label="Maximum reps" value={repMax} onChange={(e) => setRepMax(e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>
      {(initial === undefined || initial.custom) && (
        <div className="field">
          <label>Target muscles <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(optional, for the body map)</span></label>
          <div className="muscle-chips">
            {MUSCLE_OPTIONS.map((m) => {
              const state = primary.includes(m.slug) ? 'primary' : secondary.includes(m.slug) ? 'secondary' : 'off'
              return (
                <button
                  type="button"
                  key={m.slug}
                  className={`chip ${state === 'primary' ? 'active' : state === 'secondary' ? 'secondary' : ''}`}
                  aria-pressed={state !== 'off'}
                  title={state === 'off' ? 'Tap: primary' : state === 'primary' ? 'Tap: secondary' : 'Tap: remove'}
                  onClick={() => cycleMuscle(m.slug)}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          <div className="muscle-key">
            <span><i className="sw primary" /> Primary</span>
            <span><i className="sw secondary" /> Secondary</span>
            <span className="hint">Tap a muscle once for primary, twice for secondary, again to clear.</span>
          </div>
        </div>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={!valid}>{initial ? 'Save' : 'Add exercise'}</button>
      </div>
    </form>
  )
}
