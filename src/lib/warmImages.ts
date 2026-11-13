import { PRESET_EXERCISES } from '../data/presets'
import { exerciseImage } from './utils'

/** Must match the runtimeCaching cacheName in vite.config.ts. */
const CACHE = 'exercise-images'
const PARALLEL = 2

/**
 * Downloads the exercise illustrations that are not cached yet, a couple at a time,
 * so they work offline without making the service worker install wait for them.
 * Safe to call on every launch: once everything is cached it only lists the cache.
 */
export async function warmExerciseImages(): Promise<void> {
  if (!('caches' in window) || !navigator.onLine) return
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
  try {
    const cache = await caches.open(CACHE)
    const have = new Set((await cache.keys()).map((r) => r.url))
    const missing = PRESET_EXERCISES.filter((e) => e.image)
      .flatMap((e) => [exerciseImage(e.id, 'start'), exerciseImage(e.id, 'end')])
      .map((path) => new URL(path, window.location.href).href)
      .filter((url) => !have.has(url))

    let failures = 0
    const worker = async () => {
      // Give up quietly when the network is clearly not cooperating; the next launch resumes.
      while (missing.length > 0 && failures < 5) {
        const url = missing.pop()!
        try {
          await cache.add(url)
        } catch {
          failures += 1
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker))
  } catch {
    // Cache storage can be unavailable (private mode, quota); images then load on demand.
  }
}
