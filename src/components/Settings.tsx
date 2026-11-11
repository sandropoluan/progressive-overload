import { useRef, useState } from 'react'
import { goBack } from '../lib/router'
import { exportData, isExportData, useStore } from '../store'
import type { Unit } from '../types'
import { ChevronLeft, Download, Upload } from './Icons'
import { Sheet } from './Sheet'

interface Props { toast: (msg: string) => void }

export function Settings({ toast }: Props) {
  const unit = useStore((s) => s.unit)
  const setUnit = useStore((s) => s.setUnit)
  const sessions = useStore((s) => s.sessions)
  const exercises = useStore((s) => s.exercises)
  const { importData, resetAll } = useStore.getState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `overload-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Backup downloaded')
  }

  const doImport = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!isExportData(data)) throw new Error('bad')
      const replace = window.confirm('Replace all current data with this backup?\n\nPress Cancel to merge instead.')
      importData(data, replace ? 'replace' : 'merge')
      toast(replace ? 'Backup restored' : 'Backup merged')
    } catch {
      toast('That file is not a valid backup')
    }
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
          <div><div className="l">Export data</div><div className="s">Download a JSON file with everything.</div></div>
          <button className="btn sm" onClick={doExport}><Download /> Export</button>
        </div>
        <div className="row">
          <div><div className="l">Import data</div><div className="s">Restore or merge a backup file.</div></div>
          <button className="btn sm" onClick={() => fileRef.current?.click()}><Upload /> Import</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = '' }} />
        </div>
      </div>

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
          "Add to Home Screen" menu for the best experience. Export a backup before clearing browser data.
        </p>
      </div>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset everything?">
        <p style={{ color: 'var(--text-2)', marginBottom: 18, fontSize: 14.5 }}>All sessions and custom exercises on this device will be erased. Export a backup first if you want to keep them.</p>
        <div className="sheet-actions">
          <button className="btn" onClick={() => setConfirmReset(false)}>Keep my data</button>
          <button className="btn danger" onClick={() => { resetAll(); setConfirmReset(false); toast('All data cleared') }}>Reset</button>
        </div>
      </Sheet>
    </>
  )
}
