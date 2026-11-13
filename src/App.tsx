import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Home } from './components/Home'
import { PageOverlay } from './components/PageOverlay'
import { useRoute } from './lib/router'
import { markAppReady } from './lib/startup'

// Detail pages (and the instruction texts and muscle map they pull in) load separately
// so the home screen does not wait for them.
const loadExerciseDetail = () => import('./components/ExerciseDetail').then((m) => ({ default: m.ExerciseDetail }))
const loadSettings = () => import('./components/Settings').then((m) => ({ default: m.Settings }))
const ExerciseDetail = lazy(loadExerciseDetail)
const Settings = lazy(loadSettings)

export default function App() {
  const route = useRoute()
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToastMsg(null), 2200)
  }, [])

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  // Fetch the detail pages right after startup so opening one is instant.
  useEffect(() => {
    markAppReady()
    const t = window.setTimeout(() => { void loadExerciseDetail(); void loadSettings() }, 1200)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <>
      {/* The home screen is always mounted; detail pages open as a layer above it. */}
      <div className="app" aria-hidden={route.name !== 'home'}>
        <Home />
      </div>
      {route.name === 'exercise' && (
        <PageOverlay key={route.id}>
          <Suspense fallback={null}><ExerciseDetail id={route.id} toast={toast} /></Suspense>
        </PageOverlay>
      )}
      {route.name === 'settings' && (
        <PageOverlay key="settings">
          <Suspense fallback={null}><Settings toast={toast} /></Suspense>
        </PageOverlay>
      )}

      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      {needRefresh && (
        <div className="toast" role="status">
          Update available
          <button className="btn primary" onClick={() => void updateServiceWorker(true)}>Reload</button>
        </div>
      )}
    </>
  )
}
