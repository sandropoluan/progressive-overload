import { useState } from 'react'
import { fmtWeight, sessionVolume, weightStep, type Suggestion } from '../lib/utils'
import type { SetEntry, Unit } from '../types'
import { Check, Plus, Sparkle, Trash } from './Icons'

interface Props {
  unit: Unit
  suggestion: Suggestion
  initialSets: SetEntry[]
  onSave: (sets: SetEntry[], note: string) => void
  saveLabel?: string
  onCancel?: () => void
  initialNote?: string
}

interface Draft { weight: string; reps: string }

const toDraft = (sets: SetEntry[]): Draft[] =>
  sets.map((s) => ({ weight: s.weight ? fmtWeight(s.weight) : '', reps: s.reps ? String(s.reps) : '' }))

const parse = (d: Draft[]): SetEntry[] =>
  d.map((s) => ({ weight: parseFloat(s.weight.replace(',', '.')) || 0, reps: parseInt(s.reps, 10) || 0 })).filter((s) => s.reps > 0)

export function SetLogger({ unit, suggestion, initialSets, onSave, saveLabel = 'Save session', onCancel, initialNote = '' }: Props) {
  const [sets, setSets] = useState<Draft[]>(() => toDraft(initialSets))
  const [note, setNote] = useState(initialNote)
  const [applied, setApplied] = useState(false)

  const step = weightStep(unit)
  const update = (i: number, patch: Partial<Draft>) =>
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const bump = (i: number, key: keyof Draft, delta: number) => {
    const cur = parseFloat(sets[i][key].replace(',', '.')) || 0
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100)
    update(i, { [key]: key === 'weight' ? fmtWeight(next) : String(Math.round(next)) })
  }
  const addSet = () =>
    setSets((prev) => [...prev, prev.length ? { ...prev[prev.length - 1] } : { weight: '', reps: '' }])
  const removeSet = (i: number) => setSets((prev) => prev.filter((_, idx) => idx !== i))

  const parsed = parse(sets)
  const valid = parsed.length > 0
  const volume = sessionVolume(parsed)

  return (
    <div className="card">
      {suggestion.kind !== 'first' && (
        <div className="suggest">
          <div className="ic"><Sparkle /></div>
          <div>
            <div className="t">{suggestion.title}</div>
            <div className="d">{suggestion.detail}</div>
          </div>
          <button
            type="button"
            className="btn sm apply"
            onClick={() => { setSets(toDraft(suggestion.sets)); setApplied(true) }}
            disabled={applied}
          >
            {applied ? <Check /> : 'Apply'}
          </button>
        </div>
      )}
      {suggestion.kind === 'first' && (
        <div className="suggest">
          <div className="ic"><Sparkle /></div>
          <div>
            <div className="t">{suggestion.title}</div>
            <div className="d">{suggestion.detail}</div>
          </div>
        </div>
      )}

      <div className="set-grid">
        <div className="head">Set</div>
        <div className="head">{unit}</div>
        <div className="head">Reps</div>
        <div />
        {sets.map((s, i) => (
          <SetRow
            key={i}
            index={i}
            draft={s}
            canRemove={sets.length > 1}
            onChange={(p) => update(i, p)}
            onBump={(k, d) => bump(i, k, d)}
            onRemove={() => removeSet(i)}
            step={step}
          />
        ))}
      </div>

      <div className="logger-actions">
        <button type="button" className="btn block" onClick={addSet}><Plus /> Add set</button>
      </div>

      <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
        <input className="input" placeholder="Note (optional) — e.g. felt strong, seat position 4" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="logger-summary num">
        <span>{parsed.length} set{parsed.length === 1 ? '' : 's'}</span>
        <span>Volume <b>{fmtWeight(volume)} {unit}</b></span>
      </div>

      <div className="logger-actions">
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
        <button type="button" className="btn primary block lg" disabled={!valid} onClick={() => onSave(parsed, note)}>
          <Check /> {saveLabel}
        </button>
      </div>
    </div>
  )
}

interface RowProps {
  index: number
  draft: Draft
  canRemove: boolean
  step: number
  onChange: (p: Partial<Draft>) => void
  onBump: (key: keyof Draft, delta: number) => void
  onRemove: () => void
}

function SetRow({ index, draft, canRemove, step, onChange, onBump, onRemove }: RowProps) {
  return (
    <>
      <div className="set-idx num">{index + 1}</div>
      <div className="stepper">
        <button type="button" aria-label="Decrease weight" onClick={() => onBump('weight', -step)}>−</button>
        <input
          className="num"
          inputMode="decimal"
          placeholder="0"
          value={draft.weight}
          onChange={(e) => onChange({ weight: e.target.value })}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" aria-label="Increase weight" onClick={() => onBump('weight', step)}>+</button>
      </div>
      <div className="stepper">
        <button type="button" aria-label="Decrease reps" onClick={() => onBump('reps', -1)}>−</button>
        <input
          className="num"
          inputMode="numeric"
          placeholder="0"
          value={draft.reps}
          onChange={(e) => onChange({ reps: e.target.value.replace(/\D/g, '') })}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" aria-label="Increase reps" onClick={() => onBump('reps', 1)}>+</button>
      </div>
      <button type="button" className="set-remove" aria-label="Remove set" onClick={onRemove} disabled={!canRemove}>
        <Trash />
      </button>
    </>
  )
}
