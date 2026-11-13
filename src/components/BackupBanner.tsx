import { useState } from 'react'
import { backupNow, usePendingChanges } from '../lib/backup'
import { useStore } from '../store'

/**
 * Shown on the home screen whenever something has changed since the last backup file.
 * Everything lives only in this device's browser storage, so this file is the only
 * protection against the app's data being wiped.
 */
export function BackupBanner() {
  const pending = usePendingChanges()
  const hasSessions = useStore((s) => s.sessions.length > 0)
  const never = useStore((s) => !s.lastBackupAt)
  // Backed up by an older version of the app, which did not record what the backup contained.
  const untracked = useStore((s) => !!s.lastBackupAt && !s.backupSnapshot)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (pending <= 0 || !hasSessions) return null

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await backupNow()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The backup could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="backup-banner" role="status">
      <div className="grow">
        <div className="t">
          {never ? 'Your data is not backed up' : untracked ? 'Back up once more' : `${pending} change${pending === 1 ? '' : 's'} not backed up`}
        </div>
        <div className="s">
          {error ?? (untracked ? 'After this backup the app tracks exactly what has changed.' : 'It is stored only on this device. Save a copy to Files.')}
        </div>
      </div>
      <button className="btn sm primary" disabled={busy} onClick={() => void run()}>Back up</button>
    </div>
  )
}
