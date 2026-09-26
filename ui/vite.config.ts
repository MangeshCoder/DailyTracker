// ─────────────────────────────────────────────────────────────────────────────
//  FILE 1:  vite.config.ts
//  ACTION:  REPLACE entire file
//
//  Changes from original:
//  1. Fixed API cache URL: localhost:5000 → localhost:7096
//  2. Added all critical pages to cache (not just 3 endpoints)
//  3. Added orientation, description, categories to manifest
//  4. Added workbox pre-caching for static assets
//  5. Added devOptions so SW works in dev mode for testing
//  6. Vendor code split into stable chunks (react / router / query / …) so
//     app updates don't force users to re-download unchanged libraries
//  7. face-api.js + TensorFlow (~650 kB) no longer precached for every user;
//     cached on first face check instead, together with /models
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // Pre-cache all static assets on install
      includeAssets: ['favicon.ico', 'favicon.svg', 'robots.txt', 'icons/*.png'],

      // ── Web App Manifest ────────────────────────────────────────────────────
      manifest: {
        name:             'Daily Tracker EMS',
        short_name:       'EMS',
        description:      'Employee Management System — track attendance, leave, tasks and more',
        theme_color:      '#0f172a',   // slate-950 — matches your sidebar
        background_color: '#0f172a',
        display:          'standalone', // hides browser chrome, feels like a native app
        orientation:      'portrait',
        start_url:        '/',
        scope:            '/',
        categories:       ['productivity', 'business'],
        icons: [
          {
            src:   '/icons/icon-192.png',
            sizes: '192x192',
            type:  'image/png',
          },
          {
            src:   '/icons/icon-512.png',
            sizes: '512x512',
            type:  'image/png',
          },
          {
            src:     '/icons/icon-maskable-512.png',  // full-bleed, logo inside the safe zone
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'maskable',  // Android adaptive icon — fills the circle
          },
        ],
      },

      // ── Workbox (Service Worker caching strategy) ───────────────────────────
      workbox: {
        // Pre-cache all JS/CSS/HTML built by Vite
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // face-api is only needed for face check-in — cache it on first use instead
        globIgnores: ['**/face-api-*.js'],

        runtimeCaching: [
          // ── face-api.js chunk + ML models — CacheFirst (hashed / static files)
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/models/') ||
              /\/assets\/face-api-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'face-api-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Google Fonts — cache forever ─────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── API: Dashboard + Daily Log — NetworkFirst (fresh data, offline fallback)
          {
            urlPattern: /^https:\/\/localhost:7096\/api\/(dashboard|dailylog\/today|tasks\/today|notifications\/count)/i,
            handler: 'NetworkFirst',
            options: {
              cacheName:  'api-core-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 5 * 60 }, // 5 min
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── API: Mostly-static data — StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/localhost:7096\/api\/(holidays|announcements|directory|team\/calendar)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName:  'api-static-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 10 * 60 }, // 10 min
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Uploaded files (avatars, documents) — CacheFirst ────────────
          {
            urlPattern: /^https:\/\/localhost:7096\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName:  'uploads-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // ── Enable SW in development for testing ────────────────────────────────
      devOptions: {
        enabled: true,
        type:    'module',
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        // Split third-party libraries into long-lived cacheable chunks
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](face-api\.js|@tensorflow)[\\/]/.test(id)) return 'face-api';
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'router';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('@microsoft/signalr')) return 'signalr';
          if (id.includes('sweetalert2')) return 'sweetalert';
          if (/[\\/]node_modules[\\/]axios[\\/]/.test(id)) return 'axios';
        },
      },
    },
    // face-api.js + TensorFlow is one ~650 kB library that can't be split
    // further; it loads only on face check-in, so allow it without a warning.
    chunkSizeWarningLimit: 700,
  },

  server: {
    port: 3000,
    host: true,
  },
});