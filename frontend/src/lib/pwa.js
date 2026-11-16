import { useCallback, useEffect, useState } from 'react';

let deferredPrompt = null;
const listeners = new Set();

/** Registers the offline-capable service worker and captures the browser's install prompt. */
export const setupPwa = () => {
  if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('[pwa] service worker not registered', err));
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    for (const cb of listeners) cb();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    for (const cb of listeners) cb();
  });
};

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

/**
 * `{ canInstall, installed, ios, install }` — `install` shows the native prompt where the
 * browser offers one (Chrome / Edge / Android); iOS Safari only supports "Share → Add to Home Screen".
 */
export const usePwaInstall = () => {
  const [, bump] = useState(0);
  useEffect(() => {
    const cb = () => bump((n) => n + 1);
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable';
    const prompt = deferredPrompt;
    deferredPrompt = null;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    for (const cb of listeners) cb();
    return outcome;
  }, []);

  return { canInstall: Boolean(deferredPrompt), installed: isStandalone(), ios: isIos(), install };
};
