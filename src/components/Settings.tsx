import { useRef, useState } from 'react'
import { backupNow, describeBackup } from '../lib/backup'
import { BackupError, compareBackup, parseBackup, type BackupComparison, type ParsedBackup } from '../lib/backupFormat'
import { goBack } from '../lib/router'
import { startupSummary } from '../lib/startup'
import { relativeDay, shortDate } from '../lib/utils'
import { useStore } from '../store'
import type { Unit } from '../types'
import { ChevronLeft, Download, Upload } from './Icons'
import { Sheet } from './Sheet'

interface Props { toast: (msg: string) => void }

/** A backup file that has been opened and checked, waiting for the user to decide what to do with it. */
interface OpenedBackup { parsed: ParsedBackup; cmp: BackupComparison }

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

export function Settings({ toast }: Props) {
  const unit = useStore((s) => s.unit)
  const setUnit = useStore((s) => s.setUnit)
  const sessions = useStore((s) => s.sessions)
  const exercises = useStore((s) => s.exercises)
  const { importData, resetAll } = useStore.getState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  // Read once per mount; the numbers describe the launch, not this render.
  const [startup] = useState(startupSummary)

  const lastBackupAt = useStore((s) => s.lastBackupAt)
  const pendingBackup = useStore((s) => s.pendingBackup)

  const [opened, setOpened] = useState<OpenedBackup | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const doExport = async () => {
    try {
      const result = await backupNow()
      if (result.outcome !== 'cancelled') toast(describeBackup(result))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The backup could not be created.')
    }
  }

  // Opening a file only reads and checks it. Nothing on the device changes until the
  // user picks "Add" or "Replace" in the sheet, so this doubles as "check my backup".
  const openBackup = async (file: File) => {
    try {
      const parsed = parseBackup(await file.text())
      const { unit: u, exercises: ex, sessions: ses } = useStore.getState()
      setConfirmReplace(false)
      setOpened({ parsed, cmp: compareBackup({ unit: u, exercises: ex, sessions: ses }, parsed.data) })
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'That file could not be read.')
    }
  }

  const restore = (mode: 'merge' | 'replace') => {
    if (!opened) return
    importData(opened.parsed.data, mode)
    setOpened(null)
    toast(`${mode === 'replace' ? 'Backup restored' : 'Backup added'} · ${n(useStore.getState().sessions.length, 'session')} on this device`)
  }

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={goBack} aria-label="Back"><ChevronLeft /></button>
        <div className="grow"><h1>Settings</h1><div className="sub">{exercises.filter((e) => e.custom).length} custom exercises · {sessions.length} sessions</div></div>
      </header>

      <div className="section-title">Units</div>
      <div className="card">
        <div className="seg">
          {(['kg', 'lb'] as Unit[]).map((u) => (
            <button key={u} className={unit === u ? 'active' : ''} onClick={() => setUnit(u)}>{u === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)'}</button>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
          Switching only changes the label and the +/− step. Existing numbers are not converted.
        </p>
      </div>

      <div className="section-title">Backup</div>
      <div className="card">
        <div className="row">
          <div>
            <div className="l">Back up data</div>
            <div className="s">
              {lastBackupAt
                ? `Last backup ${relativeDay(lastBackupAt).toLowerCase()}${pendingBackup > 0 ? ` · ${pendingBackup} change${pendingBackup === 1 ? '' : 's'} since` : ' · up to date'}`
                : 'Never backed up.'}
            </div>
          </div>
          <button className={`btn sm ${pendingBackup > 0 ? 'primary' : ''}`} onClick={() => void doExport()}><Download /> Back up</button>
        </div>
        <div className="row">
          <div><div className="l">Restore or check a backup</div><div className="s">Open a backup file to see what is in it. Nothing changes until you confirm.</div></div>
          <button className="btn sm" onClick={() => fileRef.current?.click()}><Upload /> Open</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void openBackup(f); e.target.value = '' }} />
        </div>
      </div>

      <p className="backup-warning">
        Everything is stored only on this device. Removing the app from the Home Screen, deleting it, or clearing
        website data erases all of it for good. Back up first and keep the file in Files or iCloud Drive, then use
        "Restore or check a backup" to confirm the file is complete.
      </p>

      <div className="section-title">Danger zone</div>
      <div className="card">
        <div className="row">
          <div><div className="l">Reset everything</div><div className="s">Deletes all sessions and custom exercises.</div></div>
          <button className="btn sm danger" onClick={() => setConfirmReset(true)}>Reset</button>
        </div>
      </div>

      <div className="section-title">About</div>
      <div className="card">
        <p style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
          Overload stores everything on this device and works fully offline. Install it from your browser's
          "Add to Home Screen" menu for the best experience. Back up before removing the app or clearing browser data.
        </p>
        {startup && (
          <p className="num" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            Last launch: {startup}
          </p>
        )}
      </div>

      <Sheet open={opened !== null} onClose={() => setOpened(null)} title="Backup file">
        {opened && (() => {
          const { parsed, cmp } = opened
          const { counts, problems, firstSession, lastSession } = parsed
          const savedAt = Date.parse(parsed.data.exportedAt) > 0 ? new Date(parsed.data.exportedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null
          const nothingNew = cmp.newSessions === 0 && cmp.newCustomExercises === 0
          return (
            <div className="backup-file">
              <div className="stats">
                <div className="stat"><div className="label">Sessions</div><div className="value num">{counts.sessions}</div></div>
                <div className="stat"><div className="label">Sets</div><div className="value num">{counts.sets}</div></div>
                <div className="stat"><div className="label">Custom exercises</div><div className="value num">{counts.customExercises}</div></div>
              </div>
              <p className="meta">
                {savedAt ? `Saved ${savedAt}.` : 'Save date unknown.'}
                {firstSession && lastSession ? ` Sessions from ${shortDate(firstSession)} to ${shortDate(lastSession)}.` : ' No sessions.'}
              </p>

              {problems.length === 0 ? (
                <p className="check ok">File check passed: every session and exercise in it is readable.</p>
              ) : (
                <div className="check bad">
                  <strong>This file is damaged.</strong>
                  <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              )}

              <ul className="cmp">
                <li>
                  {nothingNew
                    ? 'Everything in this file is already on this device.'
                    : `Not on this device yet: ${n(cmp.newSessions, 'session')}${cmp.newCustomExercises > 0 ? ` and ${n(cmp.newCustomExercises, 'custom exercise')}` : ''}.`}
                </li>
                {(cmp.deviceOnlySessions > 0 || cmp.deviceOnlyCustomExercises > 0) && (
                  <li>
                    Only on this device, not in the file: {n(cmp.deviceOnlySessions, 'session')}
                    {cmp.deviceOnlyCustomExercises > 0 ? ` and ${n(cmp.deviceOnlyCustomExercises, 'custom exercise')}` : ''}. Replacing would delete them.
                  </li>
                )}
                {cmp.changedSessions > 0 && <li>{n(cmp.changedSessions, 'session')} differ between the two. Adding keeps this device's version.</li>}
              </ul>

              {confirmReplace ? (
                <>
                  <p className="meta">
                    Replace erases everything on this device and loads only what is in this file
                    {cmp.deviceOnlySessions > 0 ? `, deleting ${n(cmp.deviceOnlySessions, 'session')} that are not in it` : ''}.
                  </p>
                  <div className="sheet-actions">
                    <button className="btn" onClick={() => setConfirmReplace(false)}>Go back</button>
                    <button className="btn danger" onClick={() => restore('replace')}>Yes, replace</button>
                  </div>
                </>
              ) : (
                <>
                  <button className="btn primary block" disabled={counts.sessions === 0 && counts.customExercises === 0} onClick={() => restore('merge')}>
                    Add to this device
                  </button>
                  <div className="sheet-actions">
                    <button className="btn" onClick={() => setOpened(null)}>Close</button>
                    <button className="btn danger" onClick={() => setConfirmReplace(true)}>Replace everything</button>
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </Sheet>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset everything?">
        <p style={{ color: 'var(--text-2)', marginBottom: 18, fontSize: 14.5 }}>All sessions and custom exercises on this device will be erased. Back up first if you want to keep them.</p>
        <div className="sheet-actions">
          <button className="btn" onClick={() => setConfirmReset(false)}>Keep my data</button>
          <button className="btn danger" onClick={() => { resetAll(); setConfirmReset(false); toast('All data cleared') }}>Reset</button>
        </div>
      </Sheet>
    </>
  )
}
