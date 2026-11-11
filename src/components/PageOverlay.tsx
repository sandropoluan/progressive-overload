import { useEffect, type ReactNode } from 'react'

/**
 * Full-screen layer for detail pages. The home screen stays mounted (and painted)
 * underneath, so closing the layer is instant and keeps the list's scroll position.
 */
export function PageOverlay({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('overlay-open')
    return () => root.classList.remove('overlay-open')
  }, [])
  return (
    <div className="page-overlay">
      <div className="app">{children}</div>
    </div>
  )
}
