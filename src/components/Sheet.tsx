import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * Bottom sheet. While open it freezes whatever is behind it: the document (home
 * screen) via the position:fixed technique iOS honours, and any open page layer
 * via a class that sets its overflow to hidden.
 */
export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)

    const root = document.documentElement
    const body = document.body
    const y = window.scrollY
    const prev = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width }
    root.classList.add('sheet-open')
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    return () => {
      window.removeEventListener('keydown', onKey)
      root.classList.remove('sheet-open')
      Object.assign(body.style, prev)
      window.scrollTo(0, y)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}
