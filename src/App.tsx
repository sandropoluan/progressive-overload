import { useCallback, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ExerciseDetail } from './components/ExerciseDetail'
import { Home } from './components/Home'
import { PageOverlay } from './components/PageOverlay'
import { Settings } from './components/Settings'
import { useRoute } from './lib/router'

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

  return (
    <>
      {/* The home screen is always mounted; detail pages open as a layer above it. */}
      <div className="app" aria-hidden={route.name !== 'home'}>
        <Home />
      </div>
      {route.name === 'exercise' && (
        <PageOverlay key={route.id}>
          <ExerciseDetail id={route.id} toast={toast} />
        </PageOverlay>
      )}
      {route.name === 'settings' && (
        <PageOverlay key="settings">
          <Settings toast={toast} />
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
