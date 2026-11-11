import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ExerciseDetail } from './components/ExerciseDetail'
import { Home } from './components/Home'
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

  useEffect(() => {
    // Scroll to top when opening a detail/settings page. The home screen restores
    // its own list position so filters and scroll survive a round trip.
    if (route.name !== 'home') window.scrollTo({ top: 0 })
  }, [route])

  return (
    <div className="app">
      {route.name === 'home' && <Home />}
      {route.name === 'exercise' && <ExerciseDetail key={route.id} id={route.id} toast={toast} />}
      {route.name === 'settings' && <Settings toast={toast} />}

      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      {needRefresh && (
        <div className="toast" role="status">
          Update available
          <button className="btn primary" onClick={() => void updateServiceWorker(true)}>Reload</button>
        </div>
      )}
    </div>
  )
}
