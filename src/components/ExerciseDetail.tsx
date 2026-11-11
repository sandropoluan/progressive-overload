import { useMemo, useState } from 'react'
import { goBack, navigate } from '../lib/router'
import { bestE1RM, fmtWeight, relativeDay, sessionVolume, sortByDateDesc, suggestNext, topSet } from '../lib/utils'
import { useStore } from '../store'
import type { Session } from '../types'
import { ExerciseForm } from './ExerciseForm'
import { HistoryList } from './HistoryList'
import { HowTo } from './HowTo'
import { ChevronLeft, Edit, Target, Trash } from './Icons'
import { ProgressChart } from './ProgressChart'
import { SetLogger } from './SetLogger'
import { Sheet } from './Sheet'
import { StatTile } from './StatTile'

interface Props { id: string; toast: (msg: string) => void }

export function ExerciseDetail({ id, toast }: Props) {
  const exercise = useStore((s) => s.exercises.find((e) => e.id === id))
  const allSessions = useStore((s) => s.sessions)
  const unit = useStore((s) => s.unit)
  const { addSession, updateSession, deleteSession, updateExercise, deleteExercise } = useStore.getState()

  const [editing, setEditing] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Session | 'exercise' | null>(null)
  const [saveKey, setSaveKey] = useState(0)

  const sessions = useMemo(() => allSessions.filter((s) => s.exerciseId === id).sort(sortByDateDesc), [allSessions, id])
  const last = sessions[0]
  const prev = sessions[1]

  const range = exercise ? { repMin: exercise.repMin, repMax: exercise.repMax, sets: exercise.sets } : { repMin: 8, repMax: 12, sets: 3 }
  const suggestion = suggestNext(last, unit, range)
  const initialSets = last ? last.sets.map((s) => ({ ...s })) : suggestion.sets

  if (!exercise) {
    return (
      <>
        <header className="topbar">
          <button className="icon-btn" onClick={goBack} aria-label="Back"><ChevronLeft /></button>
          <div className="grow"><h1>Not found</h1></div>
        </header>
        <div className="empty">This exercise no longer exists.</div>
      </>
    )
  }

  const bestWeight = sessions.reduce((m, s) => Math.max(m, topSet(s.sets)?.weight ?? 0), 0)
  const bestE1 = sessions.reduce((m, s) => Math.max(m, bestE1RM(s.sets)), 0)
  const lastTop = last ? topSet(last.sets) : undefined
  const prevTop = prev ? topSet(prev.sets) : undefined
  const lastVol = last ? sessionVolume(last.sets) : 0
  const prevVol = prev ? sessionVolume(prev.sets) : undefined

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={goBack} aria-label="Back"><ChevronLeft /></button>
        <div className="grow">
          <h1>{exercise.name}</h1>
          <div className="sub">{exercise.muscle} · {exercise.equipment}</div>
        </div>
        <button className="icon-btn" aria-label="Edit exercise" onClick={() => setEditing(true)}><Edit /></button>
        <button className="icon-btn danger" aria-label="Delete exercise" onClick={() => setConfirmDelete('exercise')}><Trash /></button>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="rec num"><Target /> Target {exercise.sets} × {exercise.repMin}–{exercise.repMax} reps</span>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Add weight once every set hits {exercise.repMax}.</span>
      </div>

      <HowTo exercise={exercise} defaultOpen={sessions.length === 0} />
      <div style={{ height: 12 }} />

      <div className="stats">
        <StatTile
          label="Last top set"
          value={lastTop ? `${fmtWeight(lastTop.weight)}×${lastTop.reps}` : '—'}
          delta={lastTop && prevTop ? lastTop.weight - prevTop.weight : undefined}
          deltaUnit={unit}
        />
        <StatTile label="Best weight" value={bestWeight ? fmtWeight(bestWeight) : '—'} unit={bestWeight ? unit : undefined} />
        <StatTile label="Est. 1RM" value={bestE1 ? fmtWeight(Math.round(bestE1 * 2) / 2) : '—'} unit={bestE1 ? unit : undefined} />
      </div>

      <div className="section-title">
        <span>Log today</span>
        {last && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>Last: {relativeDay(last.date)} · {fmtWeight(lastVol)} {unit}{prevVol !== undefined && ` (${lastVol - prevVol >= 0 ? '+' : ''}${fmtWeight(lastVol - prevVol)})`}</span>}
      </div>
      <SetLogger
        key={`${id}-${saveKey}`}
        unit={unit}
        suggestion={suggestion}
        initialSets={initialSets}
        onSave={(sets, note) => {
          addSession(id, sets, undefined, note)
          setSaveKey((k) => k + 1)
          toast('Session saved')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />

      <div className="section-title">History</div>
      <ProgressChart sessions={sessions} unit={unit} />
      <div style={{ height: 12 }} />
      <HistoryList sessions={sessions} unit={unit} onEdit={setEditingSession} onDelete={setConfirmDelete} />

      <ExerciseForm
        open={editing}
        initial={exercise}
        onClose={() => setEditing(false)}
        onSubmit={(v) => { updateExercise(id, v); setEditing(false); toast('Exercise updated') }}
      />

      <Sheet open={editingSession !== null} onClose={() => setEditingSession(null)} title="Edit session">
        {editingSession && (
          <SetLogger
            unit={unit}
            suggestion={{ kind: 'first', title: relativeDay(editingSession.date), detail: new Date(editingSession.date).toLocaleString(), sets: [] }}
            initialSets={editingSession.sets}
            initialNote={editingSession.note}
            saveLabel="Save changes"
            onCancel={() => setEditingSession(null)}
            onSave={(sets, note) => { updateSession(editingSession.id, { sets, note: note.trim() || undefined }); setEditingSession(null); toast('Session updated') }}
          />
        )}
      </Sheet>

      <Sheet open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title={confirmDelete === 'exercise' ? 'Delete exercise?' : 'Delete session?'}>
        <p style={{ color: 'var(--text-2)', marginBottom: 18, fontSize: 14.5 }}>
          {confirmDelete === 'exercise'
            ? `This removes "${exercise.name}" and all ${sessions.length} logged session${sessions.length === 1 ? '' : 's'}. This cannot be undone.`
            : 'This session will be permanently removed from your history.'}
        </p>
        <div className="sheet-actions">
          <button className="btn" onClick={() => setConfirmDelete(null)}>Keep</button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirmDelete === 'exercise') { deleteExercise(id); navigate({ name: 'home' }); toast('Exercise deleted') }
              else if (confirmDelete) { deleteSession(confirmDelete.id); toast('Session deleted') }
              setConfirmDelete(null)
            }}
          >
            Delete
          </button>
        </div>
      </Sheet>
    </>
  )
}
