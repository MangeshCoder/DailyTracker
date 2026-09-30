// ─────────────────────────────────────────────────────────────────────────────
//  FILE 6:  frontend/src/main.tsx
//  ACTION:  REPLACE entire file
//
//  Change from original:
//  Added PWAUpdatePrompt to the app root so update notifications appear
//  site-wide regardless of which page the user is on.
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { PWAUpdatePrompt } from './components/pwa/PWAUpdatePrompt.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Shows a toast when a new app version is deployed */}
    <PWAUpdatePrompt />
  </StrictMode>
);
// The old face-model cache may hold a web page instead of the model files
// (see vite.config.ts face-api-cache-v2) — remove it once.
if ('caches' in window) caches.delete('face-api-cache').catch(() => { /* not there */ });
