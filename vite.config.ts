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
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
