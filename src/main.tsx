import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Ask the browser not to evict this origin's storage under pressure. This does not protect
// against the user removing the app; only a backup file does (see src/lib/backup.ts).
void navigator.storage?.persist?.().catch(() => false)

// Well after startup, so it never competes with the first paint.
if (import.meta.env.PROD) {
  window.setTimeout(() => void import('./lib/warmImages').then((m) => m.warmExerciseImages()), 5000)
}
