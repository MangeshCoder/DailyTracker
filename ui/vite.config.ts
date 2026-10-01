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
        name:             'DailyTracker · Montcrest Software',
        short_name:       'DailyTracker',
        description:      'Employee Management System — track attendance, leave, tasks and more',
        theme_color:      '#081028',   // page background (Dashdark navy)
        background_color: '#081028',
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
        // phone / browser push notifications: show them and open the page when tapped
        importScripts: ['push-sw.js'],
        // face-api is only needed for face check-in — cache it on first use instead
        globIgnores: ['**/face-api-*.js'],
        // Hosted, the API shares this address: links to it (downloads, health
        // checks …) must reach the server, not get the app's index.html
        // Real files (the PDF guides, images …) too: the guide viewer loads the PDF in a frame,
        // and without this the frame showed the app itself instead of the document
        navigateFallbackDenylist: [/^\/api\//, /^\/hubs\//, /^\/uploads\//, /^\/models\//, /^\/health/, /^\/swagger/,
          /^[^?]*\.[a-z0-9]{2,5}(\?.*)?$/i],

        runtimeCaching: [
          // ── face-api.js chunk + ML models — CacheFirst (hashed / static files)
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/models/') ||
              /\/assets\/face-api-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              // v2: the old cache may hold a web page instead of the model files
              // (the server used to answer them with index.html) — start fresh
              cacheName: 'face-api-cache-v2',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
              cacheableResponse: { statuses: [200] },
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