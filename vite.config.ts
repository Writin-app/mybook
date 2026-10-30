import crypto from 'node:crypto'
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: crypto })
}

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import bookmarkMetadata from './server/bookmarkMetadata'

export default defineConfig({
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/harper.js/') || id.includes('/node_modules/harper.js/node_modules/fflate/')) {
            return 'harper-engine'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  plugins: [{
    name: 'bookmark-metadata',
    configureServer(server) {
      server.middlewares.use('/api/bookmark-metadata', bookmarkMetadata)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/bookmark-metadata', bookmarkMetadata)
    },
  }, react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    includeAssets: [
      'pwa-192.svg',
      'pwa-512.svg',
      'pwa-maskable.svg',
      'pwa-192.png',
      'pwa-512.png',
      'pwa-maskable.png',
      'apple-touch-icon.png',
      'favicon-32x32.png',
      'favicon-16x16.png',
    ],
    manifest: {
      name: 'Writin',
      short_name: 'Writin',
      id: '/',
      description: 'Writin file and document workspace',
      theme_color: '#f7f4ee',
      background_color: '#f7f4ee',
      display: 'standalone',
      orientation: 'any',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
        { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        { src: '/pwa-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    workbox: {
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api\//],
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      globIgnores: ['**/proofreading.worker-*.js', '**/harper-engine-*.js', '**/__vite-browser-external-*.js'],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.origin === (globalThis as unknown as { location: { origin: string } }).location.origin && /^\/assets\/(?:proofreading\.worker|harper-engine)-[\w-]+\.js$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'writin-harper-runtime' },
        },
        {
          urlPattern: ({ url }) => url.origin === (globalThis as unknown as { location: { origin: string } }).location.origin && /^\/assets\/harper_wasm_bg-[\w-]+\.wasm$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'writin-harper-wasm' },
        },
        { urlPattern: /^https:\/\/www\.googleapis\.com\/drive\//, handler: 'NetworkOnly' },
        { urlPattern: /^https:\/\/accounts\.google\.com\//, handler: 'NetworkOnly' },
      ],
    },
  })],
})
