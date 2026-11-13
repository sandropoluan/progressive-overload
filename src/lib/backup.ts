import { exportData, useStore } from '../store'
import { serializeBackup, type BackupCounts } from './backupFormat'

export interface BackupResult {
  outcome: 'shared' | 'downloaded' | 'cancelled'
  /** What the file contains. */
  counts: BackupCounts
  /** Entries that would not survive a restore; empty when the backup is complete. */
  problems: string[]
}

/**
 * Writes everything to a JSON file outside the app's own storage, which is the only
 * copy that survives the browser or iOS wiping the app's data (for example when the
 * home-screen icon is removed).
 *
 * The file text is read back and checked against the data before it is handed over
 * (see serializeBackup); if that check fails this throws and nothing is marked as backed up.
 *
 * On phones this opens the share sheet so the file can go to Files / iCloud Drive;
 * elsewhere, or if sharing is not possible, it downloads the file.
 * Must be called from a tap: both paths need a user gesture.
 */
export async function backupNow(): Promise<BackupResult> {
  const { json, counts, problems } = serializeBackup(exportData())
  const name = `overload-backup-${new Date().toISOString().slice(0, 10)}.json`
  const { markBackedUp } = useStore.getState()

  const touch = window.matchMedia('(pointer: coarse)').matches
  if (touch && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([json], name, { type: 'application/json' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Overload backup' })
        markBackedUp()
        return { outcome: 'shared', counts, problems }
      } catch (e) {
        // Closing the share sheet is not a backup; anything else falls back to a download.
        if (e instanceof DOMException && e.name === 'AbortError') return { outcome: 'cancelled', counts, problems }
      }
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  markBackedUp()
  return { outcome: 'downloaded', counts, problems }
}

/** One-line result for a toast. */
export const describeBackup = (r: BackupResult): string => {
  const what = `${r.counts.sessions} session${r.counts.sessions === 1 ? '' : 's'}`
  if (r.problems.length > 0) return `Backup saved, but ${r.problems[0]}`
  return r.outcome === 'shared' ? `Backup saved · ${what}` : `Backup downloaded · ${what}`
}
