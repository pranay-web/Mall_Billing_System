// frontend/src/config.js
export const API_BASE = `http://${typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost'}:5005`;
