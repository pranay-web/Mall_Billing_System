import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// `npm run dev:https` serves over HTTPS so phones on the same Wi-Fi can use the camera
// (browsers only expose getUserMedia on secure origins or localhost).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_PROXY_TARGET || 'http://localhost:5005';

  return {
    plugins: [react(), tailwindcss(), mode === 'https' && basicSsl()].filter(Boolean),
    server: {
      host: true,
      port: 5173,
      proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    },
    preview: {
      host: true,
      port: 4173,
      proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 900,
    },
  };
});
