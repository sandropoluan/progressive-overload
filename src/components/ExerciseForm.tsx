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
  const toggleMuscle = (m: Muscle) => setPrimary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))

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
        onSubmit({ name: name.trim(), muscle, equipment, repMin: lo, repMax: hi, sets: nSets, primary })
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
            {MUSCLE_OPTIONS.map((m) => (
              <button type="button" key={m.slug} className={`chip ${primary.includes(m.slug) ? 'active' : ''}`} onClick={() => toggleMuscle(m.slug)}>
                {m.label}
              </button>
            ))}
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
