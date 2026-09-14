// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Exposes to local network automatically (for mobile testing)
    port: 5173,
    open: false,
    cors: true
  }
})
