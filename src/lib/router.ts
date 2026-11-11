import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'exercise'; id: string }
  | { name: 'settings' }

const parse = (hash: string): Route => {
  const path = hash.replace(/^#/, '')
  const ex = path.match(/^\/exercise\/([^/]+)/)
  if (ex) return { name: 'exercise', id: decodeURIComponent(ex[1]) }
  if (path.startsWith('/settings')) return { name: 'settings' }
  return { name: 'home' }
}

export const toHash = (r: Route): string => {
  switch (r.name) {
    case 'exercise':
      return `#/exercise/${encodeURIComponent(r.id)}`
    case 'settings':
      return '#/settings'
    default:
      return '#/'
  }
}

export const navigate = (r: Route): void => {
  window.location.hash = toHash(r)
}

export const goBack = (): void => {
  if (window.history.length > 1) window.history.back()
  else navigate({ name: 'home' })
}

export const useRoute = (): Route => {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
