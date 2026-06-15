import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Switched from 'autoUpdate' to 'prompt' so a new version doesn't
      // silently activate in the background. With 'autoUpdate', users
      // stayed on the stale bundle until they happened to fully close
      // every tab — leading to the "I had to refresh 4 times" reports.
      // With 'prompt', the new SW installs into `waiting`, we surface
      // an "Update Available" toast from src/lib/pwa-register.ts, and
      // the user gets the new code as soon as they click Update.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'SampleHub',
        short_name: 'SampleHub',
        description: 'Marble Sampling Management System for tracking sample requests',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Pull our Web Push handlers (push / notificationclick) into the
        // generated service worker. push-sw.js lives in /public.
        importScripts: ['push-sw.js'],
        // Default Workbox behaviour: install -> waiting; we trigger
        // skipWaiting + clientsClaim only on user confirmation via the
        // SKIP_WAITING postMessage from updateSW(true). Explicit false
        // so a future config tweak doesn't accidentally re-enable
        // silent auto-activation.
        skipWaiting: false,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable PWA in development for testing
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
