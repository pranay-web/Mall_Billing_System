import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { setupPwa } from './lib/pwa.js';
import { applyTheme } from './lib/theme.js';

applyTheme();
setupPwa();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
