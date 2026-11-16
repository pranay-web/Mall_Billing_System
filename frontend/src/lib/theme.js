import { useCallback, useSyncExternalStore } from 'react';
import { safeStorage } from './api.js';

const KEY = 'flashcart.theme';
export const THEMES = ['system', 'light', 'dark'];
const listeners = new Set();
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

const stored = () => {
  const v = safeStorage.get(KEY);
  return THEMES.includes(v) ? v : 'system';
};

/** `light` or `dark`: the preference resolved against the OS setting. */
export const resolveTheme = (pref = stored()) => (pref === 'system' ? (media?.matches ? 'dark' : 'light') : pref);

/** Writes the resolved theme onto <html> so CSS and the browser UI (scrollbars, form controls) follow. */
export const applyTheme = (pref = stored()) => {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#09090b' : '#fafafa');
  return resolved;
};

export const setTheme = (pref) => {
  safeStorage.set(KEY, pref === 'system' ? null : pref);
  applyTheme(pref);
  for (const cb of listeners) cb();
};

const subscribe = (cb) => {
  listeners.add(cb);
  const onMedia = () => {
    applyTheme();
    cb();
  };
  media?.addEventListener?.('change', onMedia);
  return () => {
    listeners.delete(cb);
    media?.removeEventListener?.('change', onMedia);
  };
};

/** `{ theme, resolved, setTheme, toggle }` — `toggle` flips between light and dark. */
export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, stored, () => 'system');
  const resolved = resolveTheme(theme);
  const toggle = useCallback(() => setTheme(resolveTheme() === 'dark' ? 'light' : 'dark'), []);
  return { theme, resolved, setTheme, toggle };
};
