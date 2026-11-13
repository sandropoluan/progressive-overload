import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Well after startup, so it never competes with the first paint.
if (import.meta.env.PROD) {
  window.setTimeout(() => void import('./lib/warmImages').then((m) => m.warmExerciseImages()), 5000)
}
