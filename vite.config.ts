import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import os from 'node:os'

// Workaround for Termux/Android: on some devices os.cpus() returns an empty
// array because the kernel exposes no parseable CPU info (verified here:
// os.cpus().length === 0 while os.availableParallelism() === 7). workbox-build
// bundles the service worker with @rollup/plugin-terser, which sizes its worker
// pool as `maxWorkers || os.cpus().length`; a pool sized 0 never spawns a
// worker, so its renderChunk hook never resolves and the build fails with
// "Unable to write the service worker file / Unexpected early exit /
// Unfinished hook action(s) on exit: (terser) renderChunk".
// Restoring a non-empty cpus() list lets the pool spawn workers again, keeping
// the service worker minified. No-op on hosts where os.cpus() works normally.
if (os.cpus().length === 0) {
  const virtualCpus = Array.from({ length: 1 }, () => ({
    model: 'virtual',
    speed: 0,
    times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }
  }))
  os.cpus = () => virtualCpus
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'TimeMark PWA',
        short_name: 'TimeMark',
        description: 'Aplicación de gestión de tiempo',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
})