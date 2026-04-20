import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Detect Lovable preview iframe / preview hosts — never run SW there
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com') ||
  window.location.hostname.includes('lovable.app');

if (isPreviewHost || isInIframe) {
  // Unregister any leftover service workers that may be serving stale builds
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
    // Also clear caches
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
} else {
  // Only register SW in production-like environments outside iframes
  registerSW({
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
