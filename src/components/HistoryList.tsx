import { fmtSets, fmtWeight, prSessionIds, relativeDay, sessionVolume, sortByDateDesc } from '../lib/utils'
import type { Session, Unit } from '../types'
import { Edit, Trash, Trophy } from './Icons'

interface Props {
  sessions: Session[]
  unit: Unit
  onEdit: (s: Session) => void
  onDelete: (s: Session) => void
}

export function HistoryList({ sessions, unit, onEdit, onDelete }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="empty">
        <strong>No sessions yet</strong>
        Log your first set above and it will show up here.
      </div>
    )
  }
  const sorted = [...sessions].sort(sortByDateDesc)
  const prIds = prSessionIds(sessions)

  return (
    <div className="hist">
      {sorted.map((s) => (
        <div className="hist-row" key={s.id}>
          <div className="date">
            <div className="d1">{relativeDay(s.date)}</div>
            <div className="d2 num">{new Date(s.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</div>
          </div>
          <div className="sets">
            <div className="line num">
              {fmtSets(s.sets, unit)}
              {prIds.has(s.id) && <span className="pr-tag"><Trophy /> PR</span>}
            </div>
            <div className="vol num">{s.sets.length} sets · {fmtWeight(sessionVolume(s.sets))} {unit}</div>
            {s.note && <div className="note">{s.note}</div>}
          </div>
          <div className="hist-actions">
            <button className="icon-btn" aria-label="Edit session" onClick={() => onEdit(s)}><Edit /></button>
            <button className="icon-btn danger" aria-label="Delete session" onClick={() => onDelete(s)}><Trash /></button>
          </div>
        </div>
      ))}
    </div>
  )
}
