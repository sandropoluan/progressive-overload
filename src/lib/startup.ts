/** Called once when the app has rendered, so Settings can report how long launch took. */
export const markAppReady = (): void => {
  if (performance.getEntriesByName('app-ready').length === 0) performance.mark('app-ready')
}

/**
 * Timings of this launch, measured from the moment the page started loading.
 * They cannot include the time the phone itself needs to open the app before that.
 */
export const startupSummary = (): string | null => {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (!nav) return null
  const ms = (v: number | undefined) => (v === undefined ? '–' : `${Math.round(v)} ms`)
  const paint = performance.getEntriesByName('first-contentful-paint')[0]?.startTime
  const ready = performance.getEntriesByName('app-ready')[0]?.startTime
  const cached = 'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'on' : 'off'
  return `page ${ms(nav.responseEnd)} · first paint ${ms(paint)} · ready ${ms(ready)} · offline cache ${cached}`
}
