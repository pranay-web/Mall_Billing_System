import { useSyncExternalStore } from 'react';

/** Minimal hash router — keeps deep links (e.g. #/receipt/TX-…) working on any static host. */
const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getPath = () => window.location.hash.replace(/^#/, '').split('?')[0] || '/';

export const useRoute = () => {
  const path = useSyncExternalStore(subscribe, getPath, () => '/');
  return { path, segments: path.split('/').filter(Boolean) };
};

export const navigate = (to, { replace = false } = {}) => {
  const target = `#${to}`;
  if (window.location.hash === target) return;
  if (replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = to;
  }
};
