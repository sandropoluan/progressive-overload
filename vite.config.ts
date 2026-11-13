import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// For GitHub Pages the base must match the repository name:
//   https://<user>.github.io/<repo>/  ->  base: '/<repo>/'
// Override with VITE_BASE=/other-name/ when building if your repo is named differently.
const base = process.env.VITE_BASE ?? '/progressive-overload/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Overload – Progressive Overload Tracker',
        short_name: 'Overload',
        description: 'Track weight and reps per exercise and watch your progressive overload.',
        theme_color: '#0b0d12',
        background_color: '#0b0d12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache only the app shell. The service worker installs all-or-nothing, and
        // with the ~400 exercise images in this list the install took minutes and kept
        // failing on GitHub Pages, so the app was never served from cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['exercises/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Exercise images are cached as they are seen; src/lib/warmImages.ts fetches the
        // rest in the background so they still work offline. Keep cacheName in sync with it.
        runtimeCaching: [
          {
            urlPattern: /\/exercises\/.+\.webp$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'exercise-images', cacheableResponse: { statuses: [200] } },
          },
        ],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
