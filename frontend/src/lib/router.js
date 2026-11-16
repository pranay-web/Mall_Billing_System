import { useSyncExternalStore } from 'react';

/** Minimal hash router — keeps deep links (e.g. #/receipt/TX-…?s=token) working on any static host. */
const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash.replace(/^#/, '') || '/';

export const useRoute = () => {
  const hash = useSyncExternalStore(subscribe, getHash, () => '/');
  const [path, search = ''] = hash.split('?');
  return { path: path || '/', segments: (path || '/').split('/').filter(Boolean), query: new URLSearchParams(search) };
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

/** Absolute URL for an in-app path such as `/receipt/TX-…?s=…`. */
export const absoluteUrl = (path) => `${window.location.origin}${window.location.pathname}#${path}`;
