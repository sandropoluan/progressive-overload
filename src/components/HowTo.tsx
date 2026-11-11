import { useState } from 'react'
import { INSTRUCTIONS } from '../data/instructions'
import { exerciseImage } from '../lib/utils'
import type { Exercise } from '../types'
import { ChevronRight } from './Icons'
import { MuscleMap } from './MuscleMap'

interface Props { exercise: Exercise; defaultOpen?: boolean }

export function HowTo({ exercise, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [zoom, setZoom] = useState<'start' | 'end' | null>(null)
  const [imgFailed, setImgFailed] = useState(false)
  const steps = INSTRUCTIONS[exercise.id]
  const hasMuscles = (exercise.primary?.length ?? 0) + (exercise.secondary?.length ?? 0) > 0
  if (!exercise.image && !steps && !hasMuscles) return null
  const frames: ('start' | 'end')[] = exercise.single ? ['start'] : ['start', 'end']

  return (
    <div className="card">
      <button type="button" className={`howto-toggle ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="section-title" style={{ margin: 0 }}>How to do it</span>
        <ChevronRight />
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {exercise.image && !imgFailed && (
            <div className={`howto-imgs ${exercise.single ? 'single' : ''} ${exercise.wide ? 'wide' : ''}`}>
              {frames.map((f) => (
                <button type="button" key={f} className="frame" onClick={() => setZoom(f)} aria-label={f === 'start' ? 'Start position' : 'End position'}>
                  <img src={exerciseImage(exercise.id, f)} alt={`${exercise.name} – ${f} position`} loading="lazy" onError={() => setImgFailed(true)} />
                  <span className="cap">{exercise.single ? 'Hold' : f}</span>
                </button>
              ))}
            </div>
          )}
          {hasMuscles && <MuscleMap primary={exercise.primary ?? []} secondary={exercise.secondary ?? []} />}
          {steps && (
            <ol className="howto-steps">
              {steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
        </div>
      )}
      {zoom !== null && (
        <div className="lightbox" onClick={() => setZoom(null)} role="dialog" aria-label="Exercise illustration">
          <img src={exerciseImage(exercise.id, zoom)} alt="" />
        </div>
      )}
    </div>
  )
}
